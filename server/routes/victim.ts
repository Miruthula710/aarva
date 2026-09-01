import { Router, Response } from 'express';
import { db } from '../db/store';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../services/auth';
import { generateEmpatheticResponse, generateNextCheckInQuestion } from '../services/gemini';
import { processDistressAssessment } from '../services/scoring';
import { Language, RiskLevel, VoiceFeature, VoiceSession } from '../db/types';

export const victimRouter = Router();

// Protect all victim routes
victimRouter.use(authenticateToken);
victimRouter.use(requireRole('VICTIM'));

// GET /api/victim/profile
victimRouter.get('/profile', (req: AuthenticatedRequest, res: Response) => {
  const victim = db.getVictimById(req.victimId!);
  if (!victim) return res.status(404).json({ error: 'Victim profile not found.' });

  const counselor = victim.assignedCounselorId ? db.getCounselorById(victim.assignedCounselorId) : null;
  const counselorUser = counselor ? db.findUserById(counselor.userId) : null;

  // Check if check-in was completed today
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const completedToday = victim.lastCheckInAt ? new Date(victim.lastCheckInAt).getTime() >= todayStart : false;

  res.json({
    victim,
    user: {
      name: req.user!.name,
      phoneNumber: req.user!.phoneNumber,
      email: req.user!.email,
      preferredLanguage: req.user!.preferredLanguage,
    },
    counselor: counselor
      ? {
          name: counselorUser?.name || 'Dr. Kavitha Sundaram',
          badgeNumber: counselor.badgeNumber,
          specialization: counselor.specialization,
          assignedDistrict: counselor.assignedDistrict,
        }
      : null,
    status: {
      todayCheckInCompleted: completedToday,
      currentRiskLevel: victim.currentRiskLevel,
      currentDistressScore: victim.currentDistressScore,
      emergencyHotlines: db.adminConfig.emergencyHotlines,
    },
  });
});

// PATCH /api/victim/profile (Update victim personal profile)
victimRouter.patch('/profile', (req: AuthenticatedRequest, res: Response) => {
  const victim = db.getVictimById(req.victimId!);
  if (!victim) return res.status(404).json({ error: 'Victim not found.' });

  const user = db.findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const { name, village, district, preferredLanguage, emergencyContactName, emergencyContactPhone } = req.body;

  if (name !== undefined && name.trim()) user.name = name.trim();
  if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage as Language;
  user.updatedAt = new Date().toISOString();

  if (village !== undefined) victim.village = village.trim();
  if (district !== undefined) victim.district = district.trim();
  if (emergencyContactName !== undefined) victim.emergencyContactName = emergencyContactName.trim();
  if (emergencyContactPhone !== undefined) victim.emergencyContactPhone = emergencyContactPhone.trim();
  victim.updatedAt = new Date().toISOString();

  db.logAudit(user.id, 'UPDATE_PROFILE', 'User', user.id, req.body, req.ip);

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      preferredLanguage: user.preferredLanguage,
      role: user.role,
    },
    victim,
  });
});

// POST /api/victim/language
victimRouter.post('/language', (req: AuthenticatedRequest, res: Response) => {
  const { language } = req.body;
  if (!language) return res.status(400).json({ error: 'Language is required.' });

  const user = db.findUserById(req.user!.id);
  if (user) {
    user.preferredLanguage = language as Language;
    user.updatedAt = new Date().toISOString();
  }

  res.json({ message: 'Language preference updated.', preferredLanguage: language });
});

// GET /api/victim/conversation
victimRouter.get('/conversation', (req: AuthenticatedRequest, res: Response) => {
  let conv = db.conversations.find((c) => c.victimId === req.victimId && !c.isArchived);
  if (!conv) {
    conv = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      victimId: req.victimId!,
      title: 'Daily Supportive Conversation',
      language: req.user!.preferredLanguage,
      isArchived: false,
      summary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.conversations.push(conv);
  }

  const messages = db.messages
    .filter((m) => m.conversationId === conv.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({ conversation: conv, messages });
});

// POST /api/victim/message (Empathetic AI conversation)
victimRouter.post('/message', async (req: AuthenticatedRequest, res: Response) => {
  const { content, conversationId } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  const victim = db.getVictimById(req.victimId!)!;
  let conv = conversationId ? db.conversations.find((c) => c.id === conversationId) : null;
  if (!conv) {
    conv = db.conversations.find((c) => c.victimId === req.victimId && !c.isArchived);
  }
  if (!conv) {
    conv = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      victimId: req.victimId!,
      title: 'Daily Supportive Conversation',
      language: req.user!.preferredLanguage,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.conversations.push(conv);
  }

  // Record user message
  const userMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    conversationId: conv.id,
    sender: 'USER' as const,
    content: content.trim(),
    language: req.user!.preferredLanguage,
    safetyFlag: false,
    createdAt: new Date().toISOString(),
  };
  db.messages.push(userMsg);

  // Retrieve message history for context
  const history = db.messages
    .filter((m) => m.conversationId === conv.id)
    .slice(-8)
    .map((m) => ({ sender: m.sender as 'USER' | 'AI', content: m.content }));

  // Call Gemini AI
  const aiOutcome = await generateEmpatheticResponse(
    content.trim(),
    history,
    req.user!.preferredLanguage,
    {
      name: req.user!.name,
      village: victim.village || 'Rural Village',
      recentDistress: victim.currentDistressScore,
    }
  );

  // Record AI response
  const aiMsg = {
    id: `msg-${Date.now() + 1}-${Math.random().toString(36).substr(2, 6)}`,
    conversationId: conv.id,
    sender: 'AI' as const,
    content: aiOutcome.reply,
    language: req.user!.preferredLanguage,
    distressScore: aiOutcome.distressScoreEstimated,
    safetyFlag: aiOutcome.safetyConcernDetected,
    createdAt: new Date().toISOString(),
  };
  db.messages.push(aiMsg);

  conv.updatedAt = new Date().toISOString();
  victim.lastInteractionAt = new Date().toISOString();

  // If safety concern detected or acute distress, trigger assessment & escalation
  let alertCreated = null;
  if (aiOutcome.safetyConcernDetected || aiOutcome.distressScoreEstimated >= 75) {
    const result = processDistressAssessment({
      victimId: victim.id,
      answers: [{ rawAnswer: content.trim(), numericValue: aiOutcome.distressScoreEstimated / 10 }],
      safetyConcernFlag: aiOutcome.safetyConcernDetected,
    });
    alertCreated = result.alertCreated;
  }

  res.json({
    userMessage: userMsg,
    aiMessage: aiMsg,
    safetyConcernDetected: aiOutcome.safetyConcernDetected,
    dangerThreatDetected: Boolean(aiOutcome.dangerThreatDetected),
    promptCounselorAlert: Boolean(aiOutcome.promptCounselorAlert),
    emergencyHotlines: aiOutcome.safetyConcernDetected ? db.adminConfig.emergencyHotlines : undefined,
    alertCreated: Boolean(alertCreated),
  });
});

// POST /api/victim/alert-counselor (Explicit patient approval to alert counselor & share location)
victimRouter.post('/alert-counselor', (req: AuthenticatedRequest, res: Response) => {
  const victim = db.getVictimById(req.victimId!);
  if (!victim) return res.status(404).json({ error: 'Victim profile not found.' });

  const user = db.findUserById(victim.userId);
  const counselor = victim.assignedCounselorId ? db.counselors.find((c) => c.id === victim.assignedCounselorId) : db.counselors[0];
  const counselorUser = counselor ? db.findUserById(counselor.userId) : null;

  const reqLoc = req.body.location || {};
  const loc = {
    latitude: reqLoc.latitude || 10.7870,
    longitude: reqLoc.longitude || 79.1378,
    accuracy: reqLoc.accuracy || 15,
    village: reqLoc.village || victim.village || 'Thanjavur Rural Block',
    district: reqLoc.district || victim.district || 'Thanjavur',
    state: victim.state || 'Tamil Nadu',
    address: reqLoc.address || `${victim.village || 'Rural Village'}, ${victim.district || 'Thanjavur District'}`,
    mapsUrl: reqLoc.latitude && reqLoc.longitude
      ? `https://maps.google.com/?q=${reqLoc.latitude},${reqLoc.longitude}`
      : `https://maps.google.com/?q=10.7870,79.1378`,
  };

  const alert = {
    id: `alt-danger-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    victimId: victim.id,
    counselorId: counselor ? counselor.id : 'cns-1',
    priority: 'HIGH' as const,
    status: 'PENDING' as const,
    title: '🚨 DANGER/THREAT REPORTED: Patient Confirmed Alert & Location Shared',
    currentScore: 95,
    previousScore: victim.currentDistressScore,
    trend: 'CRITICAL_SPIKE',
    signals: ['PATIENT_CONFIRMED_DANGER', 'LOCATION_SHARED_BY_PATIENT', 'URGENT_DISPATCH_REQUESTED'],
    recommendedAction: `URGENT: Patient reported danger/threat. Dispatch emergency field response / contact patient at ${user?.phoneNumber || '+91 94432 11001'}. Location: ${loc.address}. Coordinates: ${loc.latitude}, ${loc.longitude}.`,
    location: loc,
    dangerDetails: {
      threatDetected: true,
      patientApprovedDispatch: true,
      timestamp: new Date().toISOString(),
    },
    acknowledgedAt: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.alerts.unshift(alert);

  // Update victim record
  victim.currentDistressScore = 95;
  victim.currentRiskLevel = 'HIGH';
  victim.lastInteractionAt = new Date().toISOString();
  victim.updatedAt = new Date().toISOString();

  // Create urgent follow-up for counselor
  const followUp = {
    id: `fol-danger-${Date.now()}`,
    victimId: victim.id,
    counselorId: counselor ? counselor.id : 'cns-1',
    dueDate: new Date().toISOString(),
    status: 'PENDING' as const,
    priority: 'HIGH' as const,
    notes: 'Emergency response: Patient confirmed threat and authorized location dispatch',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.followUps.unshift(followUp);

  // Log SMS
  db.smsLogs.push({
    id: `sms-${Date.now()}`,
    victimId: victim.id,
    recipientPhone: counselorUser?.phoneNumber || '+91 98401 23456',
    message: `🚨 [URGENT DISPATCH] Patient ${victim.victimCode} (${user?.name || 'Community Member'}) reported danger. Location: ${loc.mapsUrl}. Contact: ${user?.phoneNumber || 'N/A'}`,
    purpose: 'PATIENT_CONFIRMED_DANGER_DISPATCH',
    status: 'SENT',
    sentAt: new Date().toISOString(),
  });

  db.logAudit(
    req.user!.id,
    'PATIENT_CONFIRMED_DANGER_ALERT_DISPATCHED',
    'Alert',
    alert.id,
    { alertId: alert.id, location: loc },
    req.ip
  );

  res.json({
    success: true,
    alert,
    counselorName: counselorUser?.name || 'Dr. Kavitha Sundaram',
    message: 'Counselor has been alerted and your location has been shared safely.',
  });
});

// GET /api/victim/checkin/start
victimRouter.get('/checkin/start', async (req: AuthenticatedRequest, res: Response) => {
  const victim = db.getVictimById(req.victimId!)!;
  const firstQuestion = await generateNextCheckInQuestion([], req.user!.preferredLanguage, victim.currentDistressScore);

  res.json({
    step: 1,
    question: firstQuestion.nextQuestion,
    category: firstQuestion.category,
    isFinal: false,
  });
});

// POST /api/victim/checkin/step (Process step and return next dynamic question or complete)
victimRouter.post('/checkin/step', async (req: AuthenticatedRequest, res: Response) => {
  const { currentStep, answers, currentAnswer } = req.body;
  const victim = db.getVictimById(req.victimId!)!;

  const allAnswers = [...(answers || []), { questionCode: `Q_STEP_${currentStep}`, answer: currentAnswer }];

  if (allAnswers.length >= 3) {
    // Complete check-in and compute score
    const result = processDistressAssessment({
      victimId: victim.id,
      answers: allAnswers.map((a: any) => ({ rawAnswer: a.answer })),
    });

    const checkInRecord = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      victimId: victim.id,
      checkInDate: new Date().toISOString(),
      isCompleted: true,
      completionSource: 'WEB_APP' as const,
      distressScore: result.assessment.score,
      riskLevel: result.assessment.riskLevel,
      notes: result.assessment.reason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.checkIns.push(checkInRecord);
    result.assessment.checkInId = checkInRecord.id;

    return res.json({
      isCompleted: true,
      assessment: result.assessment,
      alertCreated: Boolean(result.alertCreated),
      reflectionMessage: result.assessment.reason,
    });
  }

  const next = await generateNextCheckInQuestion(allAnswers, req.user!.preferredLanguage, victim.currentDistressScore);

  res.json({
    step: currentStep + 1,
    question: next.nextQuestion,
    category: next.category,
    isFinal: next.isFinal,
    answersSoFar: allAnswers,
  });
});

// POST /api/victim/voice/analyze (Analyze spoken voice acoustic features)
victimRouter.post('/voice/analyze', (req: AuthenticatedRequest, res: Response) => {
  const { transcript, durationSec, speechRate, pauseFrequency, energyLevel, pitchVariation } = req.body;
  const victim = db.getVictimById(req.victimId!)!;

  const rate = speechRate || (transcript ? Math.round((transcript.split(' ').length / (durationSec || 20)) * 60) : 115);
  const pauses = pauseFrequency || 6.5;
  const energy = energyLevel || 0.4;
  const pitch = pitchVariation || 10.5;

  let acousticSignal: RiskLevel = 'LOW';
  if (rate < 85 || (pauses > 12 && energy < 0.25)) {
    acousticSignal = 'HIGH';
  } else if (rate < 100 || pauses > 9) {
    acousticSignal = 'ELEVATED';
  } else if (rate < 115) {
    acousticSignal = 'MILD';
  }

  const vs: VoiceSession = {
    id: `vs-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    victimId: victim.id,
    durationSec: durationSec || 25,
    language: req.user!.preferredLanguage,
    transcript: transcript || 'Spoken voice input',
    summary: `Voice session (${acousticSignal} acoustic signal indicators)`,
    createdAt: new Date().toISOString(),
  };
  db.voiceSessions.push(vs);

  const vf: VoiceFeature = {
    id: `vf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    voiceSessionId: vs.id,
    speechRate: rate,
    pauseFrequency: pauses,
    pitchVariation: pitch,
    energyLevel: energy,
    voiceStability: Math.round(75 - (acousticSignal === 'HIGH' ? 30 : acousticSignal === 'ELEVATED' ? 15 : 0)),
    acousticSignal,
    createdAt: new Date().toISOString(),
  };
  db.voiceFeatures.push(vf);

  res.json({
    voiceSession: vs,
    voiceFeatures: vf,
    acousticSignal,
    disclaimer: 'Vocal acoustic signals are supplementary wellbeing indicators and do not constitute a clinical diagnosis.',
  });
});

// POST /api/victim/emergency-sos
victimRouter.post('/emergency-sos', (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const victim = db.getVictimById(req.victimId!)!;

  const result = processDistressAssessment({
    victimId: victim.id,
    answers: [{ rawAnswer: reason || 'Victim pressed Emergency SOS button for immediate crisis help', numericValue: 9.5 }],
    safetyConcernFlag: true,
  });

  res.json({
    success: true,
    message: 'Emergency SOS activated. Your assigned counselor and local health team have been notified.',
    alert: result.alertCreated,
    hotlines: db.adminConfig.emergencyHotlines,
  });
});

// POST /api/victim/sync (Offline PWA Queue Sync)
victimRouter.post('/sync', (req: AuthenticatedRequest, res: Response) => {
  const { queue } = req.body;
  if (!Array.isArray(queue) || queue.length === 0) {
    return res.json({ syncedCount: 0, message: 'Sync queue empty.' });
  }

  const victim = db.getVictimById(req.victimId!)!;
  let synced = 0;

  queue.forEach((item: any) => {
    if (item.type === 'OFFLINE_CHECKIN') {
      const result = processDistressAssessment({
        victimId: victim.id,
        answers: item.payload.answers || [{ rawAnswer: item.payload.notes || 'Offline Check-in' }],
      });

      db.checkIns.push({
        id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        victimId: victim.id,
        checkInDate: item.timestamp || new Date().toISOString(),
        isCompleted: true,
        completionSource: 'PWA_OFFLINE_SYNC',
        distressScore: result.assessment.score,
        riskLevel: result.assessment.riskLevel,
        notes: item.payload.notes || 'Synchronized from offline local queue',
        createdAt: item.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      synced++;
    } else if (item.type === 'OFFLINE_SOS') {
      processDistressAssessment({
        victimId: victim.id,
        answers: [{ rawAnswer: 'Offline SOS triggered by victim' }],
        safetyConcernFlag: true,
      });
      synced++;
    }
  });

  db.logAudit(req.user!.id, 'OFFLINE_SYNC_COMPLETED', 'Victim', victim.id, { syncedItemsCount: synced }, req.ip);

  res.json({
    success: true,
    syncedCount: synced,
    message: `Successfully synchronized ${synced} offline item(s).`,
  });
});
