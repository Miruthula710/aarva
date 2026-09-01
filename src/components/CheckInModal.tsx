import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  CheckCircle,
  X,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  Moon,
  Sun,
  ShieldCheck,
} from 'lucide-react';
import { TranslationDictionary } from '../lib/i18n';
import { Language, DistressAssessment } from '../types';
import { apiRequest } from '../lib/api';
import { enqueueOfflineItem } from '../lib/offlineQueue';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  t: TranslationDictionary;
  isOffline: boolean;
  onCheckInCompleted: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  onClose,
  language,
  t,
  isOffline,
  onCheckInCompleted,
}) => {
  const [step, setStep] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentCategory, setCurrentCategory] = useState<string>('mood');
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [answersSoFar, setAnswersSoFar] = useState<{ questionCode: string; answer: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedAssessment, setCompletedAssessment] = useState<DistressAssessment | null>(null);
  const [reflectionMessage, setReflectionMessage] = useState<string>('');
  const [alertTriggered, setAlertTriggered] = useState(false);

  // Quick suggestion chips based on category
  const QUICK_CHIPS: Record<string, string[]> = {
    mood: ['Feeling peaceful & steady', 'A bit tired today', 'Worried about family/work', 'Feeling heavy and low'],
    sleep: ['Slept 7-8 hours peacefully', 'Disturbed sleep (<5 hours)', 'Woke up multiple times', 'Unable to sleep at all'],
    stress: ['Workload is normal', 'Farm/financial stress feels high', 'Family disagreements', 'Managing well with support'],
    social: ['Talked with friends/family', 'Felt isolated today', 'Took a short walk', 'Relying on community'],
  };

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setAnswersSoFar([]);
    setCompletedAssessment(null);
    setTextAnswer('');
    setAlertTriggered(false);

    // Fetch initial question
    const fetchInitial = async () => {
      if (isOffline) {
        setCurrentQuestion('How are you feeling in your mind and heart today?');
        setCurrentCategory('mood');
        return;
      }
      try {
        const data = await apiRequest('/api/victim/checkin/start');
        setCurrentQuestion(data.question);
        setCurrentCategory(data.category);
      } catch (e) {
        setCurrentQuestion('How are you feeling in your mind and heart today?');
        setCurrentCategory('mood');
      }
    };

    fetchInitial();
  }, [isOpen, isOffline]);

  const handleNextStep = async (selectedText?: string) => {
    const answer = (selectedText || textAnswer).trim();
    if (!answer) return;

    setIsSubmitting(true);
    setTextAnswer('');

    if (isOffline) {
      const newAnswers = [...answersSoFar, { questionCode: `Q_STEP_${step}`, answer }];
      setAnswersSoFar(newAnswers);

      if (step >= 3) {
        // Enqueue offline
        enqueueOfflineItem({
          type: 'OFFLINE_CHECKIN',
          payload: { answers: newAnswers },
        });

        setCompletedAssessment({
          id: `ast-offline-${Date.now()}`,
          victimId: 'me',
          score: 35,
          trend: 'STABLE',
          riskLevel: 'MILD',
          confidence: 'Moderate',
          reason: 'Offline check-in saved locally. Will synchronize full evaluation when network returns.',
          contributingFactors: ['Saved locally in offline storage'],
          createdAt: new Date().toISOString(),
        });
        setReflectionMessage('Thank you for completing your daily check-in. Your responses are stored safely on your device.');
        setIsSubmitting(false);
        onCheckInCompleted();
        return;
      }

      setStep((s) => s + 1);
      if (step === 1) {
        setCurrentQuestion('How was your sleep last night? Were you able to rest peacefully?');
        setCurrentCategory('sleep');
      } else if (step === 2) {
        setCurrentQuestion('Has any work, farm, or family worry felt unusually heavy today?');
        setCurrentCategory('stress');
      }
      setIsSubmitting(false);
      return;
    }

    try {
      const data = await apiRequest('/api/victim/checkin/step', {
        method: 'POST',
        body: JSON.stringify({
          currentStep: step,
          answers: answersSoFar,
          currentAnswer: answer,
        }),
      });

      if (data.isCompleted) {
        setCompletedAssessment(data.assessment);
        setReflectionMessage(data.reflectionMessage);
        setAlertTriggered(data.alertCreated);
        onCheckInCompleted();
      } else {
        setStep(data.step);
        setCurrentQuestion(data.question);
        setCurrentCategory(data.category);
        setAnswersSoFar(data.answersSoFar);
      }
    } catch (e) {
      console.error('Check-in step error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="checkin-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{t.dailyCheckIn}</h2>
              <p className="text-xs text-emerald-100 font-medium">Step-by-step Daily Wellbeing Reflection</p>
            </div>
          </div>
          <button
            id="btn-close-checkin-modal"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {!completedAssessment ? (
            <div className="space-y-5">
              {/* Progress Indicator */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Step {step} of 3</span>
                <span className="text-emerald-700 uppercase">{currentCategory} REFLECTION</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>

              {/* Dynamic Question Display */}
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Today's Question:
                </span>
                <p className="text-base font-semibold text-slate-900 leading-snug">
                  {currentQuestion || 'Loading your question...'}
                </p>
              </div>

              {/* Quick Select Suggestion Chips */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600">Quick response options:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(QUICK_CHIPS[currentCategory] || QUICK_CHIPS.mood).map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleNextStep(chip)}
                      disabled={isSubmitting}
                      className="p-3 text-left text-xs font-medium text-slate-800 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Free Text Input */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-600">Or describe in your own words:</label>
                <div className="flex gap-2">
                  <input
                    id="input-checkin-text"
                    type="text"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNextStep()}
                    placeholder="Type or speak how you are feeling..."
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-inner"
                  />
                  <button
                    id="btn-submit-checkin-step"
                    onClick={() => handleNextStep()}
                    disabled={!textAnswer.trim() || isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <span>{step === 3 ? 'Complete' : 'Next'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Completed Assessment Result Card */
            <div className="space-y-5 text-center py-2 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Daily Wellbeing Recorded</h3>
                <p className="text-xs text-slate-500">Thank you for taking a moment to check in with yourself.</p>
              </div>

              {/* Score & Risk Badge */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Calculated Distress Score:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      completedAssessment.riskLevel === 'HIGH'
                        ? 'bg-red-100 text-red-800'
                        : completedAssessment.riskLevel === 'ELEVATED'
                        ? 'bg-amber-100 text-amber-800'
                        : completedAssessment.riskLevel === 'MILD'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {completedAssessment.score} / 100 ({completedAssessment.riskLevel} RISK)
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                  {reflectionMessage}
                </p>

                {completedAssessment.contributingFactors.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Key Signals Identified:</span>
                    <ul className="text-xs text-slate-700 space-y-1">
                      {completedAssessment.contributingFactors.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {alertTriggered && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Your responses indicate elevated stress. An automatic notification has been logged for your assigned counselor to provide supportive follow-up.
                  </span>
                </div>
              )}

              <button
                id="btn-close-checkin-result"
                onClick={onClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
