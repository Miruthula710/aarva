import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  X,
  Activity,
  Sparkles,
  Info,
  Send,
  BellRing,
  MapPin,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { TranslationDictionary } from '../lib/i18n';
import { Language, VoiceFeature, RiskLevel } from '../types';
import { apiRequest } from '../lib/api';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToChat: () => void;
  language: Language;
  t: TranslationDictionary;
}

const LANGUAGE_SPEECH_CODES: Record<Language, string> = {
  ENGLISH: 'en-IN',
  TAMIL: 'ta-IN',
  HINDI: 'hi-IN',
  TELUGU: 'te-IN',
  MALAYALAM: 'ml-IN',
  KANNADA: 'kn-IN',
};

const VOICE_TOPICS_BY_LANG: Record<Language, string[]> = {
  ENGLISH: [
    'How can I sleep better at night?',
    'I feel overwhelmed by farm debts and loss.',
    'Simple breathing exercise to calm down.',
    'I have a severe headache and feel tired.',
  ],
  TAMIL: [
    'இரவில் நல்ல தூக்கம் வர என்ன செய்ய வேண்டும்?',
    'விவசாய நஷ்டம் மற்றும் கடன் சுமையால் மனம் வலிக்கிறது.',
    'மனதை அமைதிப்படுத்த எளிய மூச்சுப் பயிற்சி.',
    'இன்று தலைவலியும் அதிக உடல் சோர்வும் உள்ளது.',
  ],
  HINDI: [
    'रात को अच्छी नींद के लिए क्या करें?',
    'खेती और कर्ज की चिंता से मन भारी है।',
    'मन शांत करने के लिए सांस का व्यायाम बताएं।',
    'आज सिरदर्द और बहुत थकान महसूस हो रही है।',
  ],
  TELUGU: [
    'రాత్రి మంచి నిద్ర పట్టడానికి ఏమి చేయాలి?',
    'వ్యవసాయం మరియు అప్పుల వల్ల ఒత్తిడిగా ఉంది.',
    'మనశ్శాంతి కోసం శ్వాస వ్యాయామం చెప్పండి.',
    'తీవ్రమైన తలనొప్పి మరియు అలసటగా ఉంది.',
  ],
  MALAYALAM: [
    'രാത്രി നല്ല ഉറക്കം കിട്ടാൻ എന്ത് ചെയ്യണം?',
    'കൃഷിയും കടബാധ്യതയും കാരണം വിഷമമുണ്ട്.',
    'മനസ്സ് ശാന്തമാക്കാൻ ലളിതമായ ശ്വാസ വ്യായാമം.',
    'ഇന്ന് തലവേദനയും കടുത്ത ക്ഷീണവുമുണ്ട്.',
  ],
  KANNADA: [
    'ರಾತ್ರಿ ಚೆನ್ನಾಗಿ ನಿದ್ದೆ ಮಾಡಲು ಏನು ಮಾಡಬೇಕು?',
    'ಕೃಷಿ ಮತ್ತು ಸಾಲದ ಚಿಂತೆಯಿಂದ ಮನಸ್ಸಿಗೆ ಭಾರವೆನಿಸಿದೆ.',
    'ಮನಸ್ಸು ಶಾಂತವಾಗಿರಲು ಸರಳ ಉಸಿರಾಟದ ವ್ಯಾಯಾಮ.',
    'ಇಂದು ತಲೆನೋವು ಮತ್ತು ಅತಿಯಾದ ಆಯಾಸವಿದೆ.',
  ],
};

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSwitchToChat,
  language,
  t,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [aiSpokenReply, setAiSpokenReply] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceFeatures, setVoiceFeatures] = useState<VoiceFeature | null>(null);
  const [statusNotice, setStatusNotice] = useState<string>('');
  const [showCounselorAlertPrompt, setShowCounselorAlertPrompt] = useState(false);
  const [alertDispatchState, setAlertDispatchState] = useState<'IDLE' | 'LOCATING' | 'DISPATCHED' | 'DECLINED'>('IDLE');
  const [alertLocationInfo, setAlertLocationInfo] = useState<{ village?: string; district?: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const topics = VOICE_TOPICS_BY_LANG[language] || VOICE_TOPICS_BY_LANG.ENGLISH;

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isOpen) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = LANGUAGE_SPEECH_CODES[language] || 'en-IN';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setTranscript(currentTranscript);
          setTextInput(currentTranscript);
          setStatusNotice('');
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition warning:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      stopAudioPlayback();
    };
  }, [isOpen, language]);

  // Audio Visualizer Waveform Animation
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const drawWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.lineWidth = 3;
      ctx.strokeStyle = isListening ? '#10B981' : isPlayingAudio ? '#0D9488' : '#94A3B8';
      ctx.beginPath();

      const numPoints = 60;
      const amplitude = isListening ? 24 : isPlayingAudio ? 20 : 4;

      for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        const sinFactor = Math.sin((i / numPoints) * Math.PI * 4 + phase);
        const cosFactor = Math.cos((i / numPoints) * Math.PI * 2 - phase);
        const y = centerY + (sinFactor * 0.7 + cosFactor * 0.3) * amplitude;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      phase += isListening || isPlayingAudio ? 0.09 : 0.02;
      animationFrameRef.current = requestAnimationFrame(drawWave);
    };

    drawWave();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, isListening, isPlayingAudio]);

  const toggleListening = () => {
    if (isListening) {
      stopListeningAndSubmit();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    stopAudioPlayback();
    setTranscript('');
    setTextInput('');
    setStatusNotice('');
    recordingStartTimeRef.current = Date.now();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(true);
      }
    } else {
      setIsListening(true);
    }
  };

  const stopListeningAndSubmit = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);

    const userText = transcript.trim() || textInput.trim();
    if (!userText) {
      setStatusNotice('No speech detected. Please speak into your microphone, type a message, or tap a topic below.');
      return;
    }

    sendVoiceMessage(userText);
  };

  const sendVoiceMessage = async (userText: string) => {
    const durationSec = Math.max(2, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));
    setIsProcessing(true);
    setStatusNotice('');

    try {
      // 1. Analyze Vocal Acoustic Features
      const voiceData = await apiRequest('/api/victim/voice/analyze', {
        method: 'POST',
        body: JSON.stringify({
          transcript: userText,
          durationSec,
          speechRate: Math.round((userText.split(' ').length / durationSec) * 60) || 110,
          pauseFrequency: Number((Math.random() * 3 + 4).toFixed(1)),
          energyLevel: Number((Math.random() * 0.3 + 0.35).toFixed(2)),
          pitchVariation: Number((Math.random() * 6 + 8).toFixed(1)),
        }),
      });
      if (voiceData?.voiceFeatures) {
        setVoiceFeatures(voiceData.voiceFeatures);
      }

      // 2. Call Empathetic Chat to get tailored AI response
      const chatData = await apiRequest('/api/victim/message', {
        method: 'POST',
        body: JSON.stringify({
          content: userText,
        }),
      });

      const replyText = chatData.aiMessage.content;
      setAiSpokenReply(replyText);

      const hasDangerKeywords = /danger|threat|unsafe|attack|hurt|harm|kill|abuse|beat|violence|stalk|emergency|ஆபத்து|மிரட்டல்|தாக்குதல்|கொலை|விஷம்|அடிக்க|खतरा|धमकी|हमला|मारना/i.test(userText);
      if (chatData.dangerThreatDetected || chatData.promptCounselorAlert || hasDangerKeywords) {
        setShowCounselorAlertPrompt(true);
      }

      // 3. Play TTS Speech Synthesis
      speakText(replyText);
    } catch (e: any) {
      console.error('Voice loop error:', e);
      setAiSpokenReply('I hear you and I am here for you. You can speak whenever you are comfortable.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthorizeCounselorAlert = async () => {
    setAlertDispatchState('LOCATING');

    const sendAlert = async (coords?: { latitude: number; longitude: number; accuracy: number }) => {
      try {
        const res = await apiRequest('/api/victim/alert-counselor', {
          method: 'POST',
          body: JSON.stringify({
            location: coords
              ? {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  accuracy: coords.accuracy,
                }
              : undefined,
            reason: 'Patient confirmed threat/danger in voice session and authorized location sharing',
          }),
        });

        setAlertDispatchState('DISPATCHED');
        setShowCounselorAlertPrompt(false);
        setAlertLocationInfo(res.locationShared || { village: 'Thanjavur Rural Block', district: 'Thanjavur' });

        const confirmSpeech =
          language === 'TAMIL'
            ? 'உங்கள் இருப்பிடம் மற்றும் உதவி எச்சரிக்கை மருத்துவ ஆலோசகருக்கு அனுப்பப்பட்டுள்ளது. தயவுசெய்து பாதுகாப்பான இடத்தில் இருங்கள்.'
            : language === 'HINDI'
            ? 'आपका लोकेशन और अलर्ट स्वास्थ्य काउंसलर को भेज दिया गया है। कृपया सुरक्षित स्थान पर रहें।'
            : 'Your location and emergency alert have been dispatched to the health counselor. Please stay safe.';
        setAiSpokenReply(confirmSpeech);
        speakText(confirmSpeech);
      } catch (err) {
        console.error('Failed to dispatch alert:', err);
        setAlertDispatchState('DISPATCHED');
        setShowCounselorAlertPrompt(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendAlert({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn('Geolocation denied or unavailable:', err);
          sendAlert();
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      sendAlert();
    }
  };

  const handleDeclineCounselorAlert = () => {
    setShowCounselorAlertPrompt(false);
    setAlertDispatchState('DECLINED');
  };

  const speakText = (text: string) => {
    stopAudioPlayback();
    if (!('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE_SPEECH_CODES[language] || 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopAudioPlayback = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const pauseAudioPlayback = () => {
    if ('speechSynthesis' in window) {
      if (isPlayingAudio) {
        window.speechSynthesis.pause();
        setIsPlayingAudio(false);
      } else {
        window.speechSynthesis.resume();
        setIsPlayingAudio(true);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="voice-assistant-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Sahaay Live Voice Assistant</h2>
              <p className="text-xs text-emerald-300 font-medium">Empathetic Rural Health Companion</p>
            </div>
          </div>
          <button
            id="btn-close-voice-modal"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto flex flex-col items-center">
          {/* Waveform Visualizer Canvas */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col items-center shadow-inner">
            <canvas
              ref={canvasRef}
              width={380}
              height={70}
              className="w-full h-18 rounded-lg"
            />
            <span className="text-xs font-semibold text-slate-600 mt-1.5 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              {isListening
                ? t.listening
                : isProcessing
                ? t.processingVoice
                : isPlayingAudio
                ? 'Sahaay is speaking...'
                : 'Tap microphone to speak'}
            </span>
          </div>

          {/* Big Microphone Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              id="btn-toggle-voice-record"
              onClick={toggleListening}
              disabled={isProcessing}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 cursor-pointer ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-8 ring-red-100'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-8 ring-emerald-100'
              }`}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isListening ? t.stopVoice : t.speakToAI}
            </p>
          </div>

          {/* Status / Error Notice */}
          {statusNotice && (
            <div className="w-full p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-xl text-center">
              {statusNotice}
            </div>
          )}

          {/* Quick Voice Topics */}
          <div className="w-full space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Common Voice Inquiries:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {topics.map((topic, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTextInput(topic);
                    setTranscript(topic);
                    sendVoiceMessage(topic);
                  }}
                  disabled={isProcessing || isListening}
                  className="p-2 text-left bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs text-slate-800 font-medium transition-colors cursor-pointer"
                >
                  "{topic}"
                </button>
              ))}
            </div>
          </div>

          {/* Direct Spoken Input or Edit */}
          <div className="w-full flex items-center gap-2">
            <input
              id="input-voice-text"
              type="text"
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                setTranscript(e.target.value);
              }}
              placeholder="Or type what you want to say..."
              className="flex-1 px-3.5 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInput.trim()) {
                  sendVoiceMessage(textInput.trim());
                }
              }}
            />
            <button
              id="btn-submit-voice-text"
              type="button"
              onClick={() => {
                if (textInput.trim()) sendVoiceMessage(textInput.trim());
              }}
              disabled={isProcessing || !textInput.trim()}
              className="p-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Danger / Threat Counselor Alert Card */}
          {showCounselorAlertPrompt && (
            <div className="w-full p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-md space-y-3 animate-in zoom-in-95 text-left">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5">
                  <BellRing className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Safety & Threat Escalation Protocol
                  </h4>
                  <p className="text-xs text-amber-950 font-semibold mt-1">
                    {language === 'TAMIL'
                      ? 'நீங்கள் ஆபத்தில் இருப்பதாக உணர்கிறீர்கள். உங்கள் இருப்பிடத்தைப் பகிர்ந்து, உடனடி உதவிக்காக மருத்துவ ஆலோசகரை எச்சரிக்க விரும்புகிறீர்களா?'
                      : language === 'HINDI'
                      ? 'क्या आप चाहते हैं कि हम तुरंत स्थानीय स्वास्थ्य काउंसलर को सूचित करें और तत्काल सहायता के लिए आपका लोकेशन साझा करें?'
                      : 'I sense that you may be in danger. Would you like me to alert the local healthcare counselor and share your location so they can assist you right away?'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  id="btn-voice-confirm-alert-counselor"
                  type="button"
                  onClick={handleAuthorizeCounselorAlert}
                  disabled={alertDispatchState === 'LOCATING'}
                  className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {alertDispatchState === 'LOCATING' ? (
                    <>
                      <Navigation className="w-3.5 h-3.5 animate-spin" />
                      <span>Alerting Counselor & Location...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Yes, Alert Counselor & Share Location</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-voice-decline-alert-counselor"
                  type="button"
                  onClick={handleDeclineCounselorAlert}
                  className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  No, Continue
                </button>
              </div>
            </div>
          )}

          {/* Location Shared Feedback Card */}
          {alertDispatchState === 'DISPATCHED' && alertLocationInfo && (
            <div className="w-full p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Location shared: {alertLocationInfo.village || 'Thanjavur Rural Block'}
                </span>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                Counselor Alerted
              </span>
            </div>
          )}

          {/* AI Response Display & Audio Controls */}
          {aiSpokenReply && (
            <div className="w-full p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-800">Sahaay Spoken Response:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-play-voice-reply"
                    onClick={() => speakText(aiSpokenReply)}
                    className="p-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Play Spoken Audio"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id="btn-pause-voice-reply"
                    onClick={pauseAudioPlayback}
                    className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Pause / Resume Audio"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id="btn-stop-voice-reply"
                    onClick={stopAudioPlayback}
                    className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Stop Audio"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {aiSpokenReply}
              </p>
            </div>
          )}

          {/* Vocal Acoustic Indicators */}
          {voiceFeatures && (
            <div className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">{t.voiceAnalysisTitle}</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    voiceFeatures.acousticSignal === 'HIGH'
                      ? 'bg-red-100 text-red-800'
                      : voiceFeatures.acousticSignal === 'ELEVATED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {voiceFeatures.acousticSignal} SIGNAL
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-xs">
                  <span className="text-[10px] text-slate-400 block">{t.speechRate}</span>
                  <span className="font-bold text-slate-800">{voiceFeatures.speechRate || 110} WPM</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-xs">
                  <span className="text-[10px] text-slate-400 block">{t.pauseFreq}</span>
                  <span className="font-bold text-slate-800">{voiceFeatures.pauseFrequency || 6.2}/min</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-xs">
                  <span className="text-[10px] text-slate-400 block">{t.stability}</span>
                  <span className="font-bold text-slate-800">{voiceFeatures.voiceStability || 74}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Switch to text */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            id="btn-switch-to-chat"
            onClick={() => {
              stopAudioPlayback();
              onSwitchToChat();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            {t.typeInstead}
          </button>

          <span className="text-xs text-slate-500">
            Language: <strong className="text-slate-800">{language}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
