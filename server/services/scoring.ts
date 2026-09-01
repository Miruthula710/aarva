import { db } from '../db/store';
import { RiskLevel, DistressAssessment, Alert, RiskEvent, VoiceFeature } from '../db/types';

export interface AssessmentCalculationInput {
  victimId: string;
  checkInId?: string;
  answers: { questionCode?: string; rawAnswer: string; numericValue?: number }[];
  voiceFeatures?: Partial<VoiceFeature>;
  safetyConcernFlag?: boolean;
}

export function computeRiskLevel(score: number): RiskLevel {
  const config = db.adminConfig;
  if (score <= config.distressThresholdLow) return 'LOW';
  if (score <= config.distressThresholdMild) return 'MILD';
  if (score <= config.distressThresholdElev) return 'ELEVATED';
  return 'HIGH';
}

export function processDistressAssessment(input: AssessmentCalculationInput): {
  assessment: DistressAssessment;
  alertCreated?: Alert;
  riskEventCreated?: RiskEvent;
} {
  const victim = db.getVictimById(input.victimId);
  if (!victim) {
    throw new Error(`Victim not found with ID ${input.victimId}`);
  }

  const previousScore = victim.currentDistressScore || 20;
  let calculatedScore = 20; // baseline
  const factors: string[] = [];

  // Analyze textual / numeric answers
  let scoreSum = 0;
  let count = 0;

  input.answers.forEach((ans) => {
    if (typeof ans.numericValue === 'number') {
      // 0-10 mapped to 0-100
      scoreSum += ans.numericValue * 10;
      count++;
    } else {
      const lower = ans.rawAnswer.toLowerCase();
      let answerDistress = 30;

      if (lower.includes('good') || lower.includes('peace') || lower.includes('fine') || lower.includes('நல்ல') || lower.includes('अच्छा') || lower.includes('బాగుంది') || lower.includes('നല്ലത്') || lower.includes('ಚೆನ್ನಾಗಿದೆ')) {
        answerDistress = 15;
      } else if (lower.includes('tired') || lower.includes('exhausted') || lower.includes('களைப்பு') || lower.includes('थकान') || lower.includes('అలసట') || lower.includes('ക്ഷീണം') || lower.includes('ದಣಿವು')) {
        answerDistress = 45;
        factors.push('Reported physical exhaustion and tiredness');
      } else if (lower.includes('cant sleep') || lower.includes('insomnia') || lower.includes('no sleep') || lower.includes('தூக்கமில்லை') || lower.includes('नींद नहीं') || lower.includes('నిద్ర లేదు') || lower.includes('ഉറക്കമില്ല') || lower.includes('ನಿದ್ದೆ ಇಲ್ಲ')) {
        answerDistress = 70;
        factors.push('Significant sleep disturbance (<4 hours or insomnia)');
      } else if (lower.includes('debt') || lower.includes('money') || lower.includes('crop') || lower.includes('loan') || lower.includes('கடன்') || lower.includes('कर्ज') || lower.includes('అప్పు') || lower.includes('കടം') || lower.includes('ಸಾಲ')) {
        answerDistress = 75;
        factors.push('Economic / Agricultural debt stress');
      } else if (lower.includes('hopeless') || lower.includes('heavy') || lower.includes('give up') || lower.includes('பாரமாக') || lower.includes('निराश') || lower.includes('భారం') || lower.includes('നിരാശ') || lower.includes('ಭಾರ')) {
        answerDistress = 85;
        factors.push('Expressed deep feelings of emotional burden');
      }

      scoreSum += answerDistress;
      count++;
    }
  });

  if (count > 0) {
    calculatedScore = Math.round(scoreSum / count);
  }

  // Voice acoustic contribution if present
  if (input.voiceFeatures) {
    const vf = input.voiceFeatures;
    if (vf.speechRate && vf.speechRate < 95) {
      calculatedScore += 8;
      factors.push('Acoustic signal: Slowed speech rate with prolonged pauses');
    }
    if (vf.energyLevel && vf.energyLevel < 0.25) {
      calculatedScore += 7;
      factors.push('Acoustic signal: Low vocal acoustic energy');
    }
    if (vf.acousticSignal === 'HIGH') {
      calculatedScore = Math.max(calculatedScore, 75);
    }
  }

  // Safety trigger override
  if (input.safetyConcernFlag) {
    calculatedScore = Math.max(calculatedScore, 85);
    factors.push('Direct safety concern or crisis indicator detected');
  }

  calculatedScore = Math.min(100, Math.max(0, calculatedScore));

  // Determine trend
  let trend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
  const delta = calculatedScore - previousScore;
  if (delta > 5) trend = 'INCREASING';
  else if (delta < -5) trend = 'DECREASING';

  const riskLevel = computeRiskLevel(calculatedScore);

  let confidence: 'Low' | 'Moderate' | 'High' = 'Moderate';
  if (input.answers.length >= 3 || input.voiceFeatures) {
    confidence = 'High';
  }

  if (factors.length === 0) {
    if (riskLevel === 'LOW') factors.push('Consistent healthy baseline', 'Positive emotional coping');
    else if (riskLevel === 'MILD') factors.push('Routine daily fatigue', 'Manageable workloads');
    else factors.push('General reported stress');
  }

  // Reason summary
  let reason = '';
  if (riskLevel === 'HIGH') {
    reason = `Significant spike in distress score (${calculatedScore}/100). Contributing indicators include ${factors.slice(0, 2).join(', ')}.`;
  } else if (riskLevel === 'ELEVATED') {
    reason = `Elevated distress observed (${calculatedScore}/100). Contributing factors: ${factors.slice(0, 2).join(', ')}.`;
  } else if (riskLevel === 'MILD') {
    reason = `Mild situational stress reported (${calculatedScore}/100). Coping mechanisms appear functioning.`;
  } else {
    reason = `Low distress score (${calculatedScore}/100). Stable wellbeing and social engagement reported.`;
  }

  // Create Distress Assessment
  const assessment: DistressAssessment = {
    id: `ast-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    victimId: victim.id,
    checkInId: input.checkInId || null,
    score: calculatedScore,
    previousScore,
    trend,
    riskLevel,
    confidence,
    reason,
    contributingFactors: factors,
    createdAt: new Date().toISOString(),
  };

  db.assessments.unshift(assessment);

  // Update Victim state
  victim.currentDistressScore = calculatedScore;
  victim.currentRiskLevel = riskLevel;
  victim.lastCheckInAt = new Date().toISOString();
  victim.lastInteractionAt = new Date().toISOString();
  victim.updatedAt = new Date().toISOString();

  let alertCreated: Alert | undefined;
  let riskEventCreated: RiskEvent | undefined;

  // Emergency Escalation Workflow if High Risk or Elevated with sharp rise
  if (riskLevel === 'HIGH' || (riskLevel === 'ELEVATED' && delta >= 15) || input.safetyConcernFlag) {
    // 1. Create RiskEvent
    riskEventCreated = {
      id: `re-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      victimId: victim.id,
      severity: riskLevel,
      eventType: input.safetyConcernFlag ? 'SAFETY_CONCERN_DETECTED' : 'DISTRESS_SCORE_SPIKE',
      description: reason,
      isResolved: false,
      createdAt: new Date().toISOString(),
    };
    db.riskEvents.unshift(riskEventCreated);

    // 2. Create Alert
    const title = input.safetyConcernFlag
      ? `Urgent Safety Escalation: ${victim.victimCode}`
      : `High Distress Spike (${calculatedScore}/100): ${victim.victimCode}`;

    alertCreated = {
      id: `alt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      victimId: victim.id,
      riskEventId: riskEventCreated.id,
      assessmentId: assessment.id,
      counselorId: victim.assignedCounselorId || null,
      priority: riskLevel,
      status: 'PENDING',
      title,
      currentScore: calculatedScore,
      previousScore,
      trend: `${trend} (${delta > 0 ? `+${delta}` : delta} pts)`,
      signals: factors,
      recommendedAction: input.safetyConcernFlag
        ? 'Immediate counselor crisis contact & local PHC doctor notification'
        : 'Priority counselor check-in call within 12 hours',
      acknowledgedAt: null,
      resolvedAt: null,
      resolutionNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.alerts.unshift(alertCreated);

    // 3. Log Audit
    db.logAudit(
      victim.userId,
      'EMERGENCY_ESCALATION_TRIGGERED',
      'Alert',
      alertCreated.id,
      {
        victimCode: victim.victimCode,
        score: calculatedScore,
        delta,
        factors,
        safetyFlag: input.safetyConcernFlag,
      }
    );
  }

  return { assessment, alertCreated, riskEventCreated };
}
