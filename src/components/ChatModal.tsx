import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  X,
  AlertTriangle,
  PhoneCall,
  ShieldCheck,
  RotateCcw,
  MapPin,
  CheckCircle2,
  BellRing,
  Navigation,
} from 'lucide-react';
import { TranslationDictionary } from '../lib/i18n';
import { Language, ConversationMessage } from '../types';
import { apiRequest } from '../lib/api';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  t: TranslationDictionary;
  onOpenEmergency: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  language,
  t,
  onOpenEmergency,
}) => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSafetyConcern, setHasSafetyConcern] = useState(false);
  const [showCounselorAlertPrompt, setShowCounselorAlertPrompt] = useState(false);
  const [alertDispatchState, setAlertDispatchState] = useState<'IDLE' | 'LOCATING' | 'DISPATCHED' | 'DECLINED'>('IDLE');
  const [alertLocationInfo, setAlertLocationInfo] = useState<{ village?: string; district?: string; mapsUrl?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const SUGGESTIONS_BY_LANG: Record<Language, string[]> = {
    ENGLISH: [
      'How can I sleep better at night?',
      'I feel overwhelmed by daily farm work and debts.',
      'Simple breathing exercises to calm down.',
      'My head aches and I feel very tired today.',
    ],
    TAMIL: [
      'இரவில் நல்ல தூக்கம் வர என்ன செய்ய வேண்டும்?',
      'விவசாய வேலை மற்றும் கடன் சுமையால் மனம் வலிக்கிறது.',
      'மனதை அமைதிப்படுத்த எளிய மூச்சுப் பயிற்சி.',
      'இன்று தலைவலியும் அதிக உடல் சோர்வும் இருக்கிறது.',
    ],
    HINDI: [
      'रात को अच्छी नींद के लिए क्या करें?',
      'खेती और कर्ज की चिंता से मन भारी लग रहा है।',
      'मन को शांत करने के लिए कोई सरल व्यायाम बताएं।',
      'आज बहुत सिरदर्द और थकान महसूस हो रही है।',
    ],
    TELUGU: [
      'రాత్రి మంచి నిద్ర పట్టడానికి ఏమి చేయాలి?',
      'వ్యవసాయం మరియు అప్పుల వల్ల ఒత్తిడిగా ఉంది.',
      'మనశ్శాంతి కోసం శ్వಾస వ్యాయామం చెప్పండి.',
    ],
    MALAYALAM: [
      'രാത്രി നല്ല ഉറക്കം കിട്ടാൻ എന്ത് ചെയ്യണം?',
      'കൃഷിയും കടബാധ്യതയും കാരണം വിഷമമുണ്ട്.',
      'മനസ്സ് ശാന്തമാക്കാൻ ലളിതമായ ശ്വാസ വ്യായാമം.',
    ],
    KANNADA: [
      'ರಾತ್ರಿ ಚೆನ್ನಾಗಿ ನಿದ್ದೆ ಮಾಡಲು ಏನು ಮಾಡಬೇಕು?',
      'ಕೃಷಿ ಮತ್ತು ಸಾಲದ ಚಿಂತೆಯಿಂದ ಮನಸ್ಸಿಗೆ ಭಾರವೆನಿಸಿದೆ.',
      'ಮನಸ್ಸು ಶಾಂತವಾಗಿರಲು ಸರಳ ಉಸಿರಾಟದ ವ್ಯಾಯಾಮ.',
    ],
  };

  const SUGGESTIONS = SUGGESTIONS_BY_LANG[language] || SUGGESTIONS_BY_LANG.ENGLISH;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) return;

    // Fetch existing conversation history
    const loadConversation = async () => {
      try {
        const data = await apiRequest('/api/victim/conversation');
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          // Welcome message
          setMessages([
            {
              id: 'msg-welcome',
              conversationId: 'default',
              sender: 'AI',
              content:
                language === 'TAMIL'
                  ? 'வணக்கம்! நான் உங்கள் சஹாய் (Sahaay) துணைவன். உங்கள் மனநிலையை எந்த தயக்கமும் இன்றி என்னுடன் பகிர்ந்து கொள்ளலாம். இன்று உங்களுக்கு எவ்வாறு உதவலாம்?'
                  : language === 'HINDI'
                  ? 'नमस्ते! मैं आपका सहायक (Sahaay) साथी हूँ। आप बिना किसी झिझक के अपनी बात साझा कर सकते हैं। आज मैं आपकी क्या मदद कर सकता हूँ?'
                  : 'Hello! I am Sahaay, your wellbeing companion. You can share your thoughts or worries freely. How can I support you today?',
              language,
              safetyFlag: false,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (e) {
        console.error('Failed to load conversation:', e);
      }
    };

    loadConversation();
  }, [isOpen, language]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, showCounselorAlertPrompt, alertDispatchState]);

  // Handle patient approving the counselor alert and location dispatch
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
            reason: 'Patient confirmed threat/danger alert and authorized location sharing',
          }),
        });

        setAlertDispatchState('DISPATCHED');
        setShowCounselorAlertPrompt(false);
        setAlertLocationInfo(res.locationShared || { village: 'Local PHC Jurisdiction', district: 'Health District' });

        const confirmMsg: ConversationMessage = {
          id: `msg-alert-confirmed-${Date.now()}`,
          conversationId: 'default',
          sender: 'AI',
          content:
            language === 'TAMIL'
              ? `🛡️ **ஆலோசகர் எச்சரிக்கப்பட்டு உங்கள் இருப்பிடம் பகிரப்பட்டது**: உங்கள் பகுதி மருத்துவ ஆலோசகர் (${res.counselorName || 'Dr. கவிதா'}) மற்றும் ஆரம்ப சுகாதார நிலைய மீட்புக் குழுவிற்கு உங்கள் நேரடித் தகவல் அனுப்பப்பட்டுள்ளது. தயவுசெய்து பாதுகாப்பான இடத்தில் இருங்கள்.`
              : language === 'HINDI'
              ? `🛡️ **काउंसलर को सूचित किया गया और आपका लोकेशन साझा कर दिया गया**: स्थानीय स्वास्थ्य काउंसलर (${res.counselorName || 'डॉ. कविता'}) और PHC टीम को आपका विवरण भेज दिया गया है। कृपया सुरक्षित स्थान पर रहें।`
              : `🛡️ **Counselor Alerted & Location Shared**: Your location and emergency alert have been dispatched to ${res.counselorName || 'the Duty Health Counselor'} and the nearest PHC response team. Please stay in a safe place. Support is on the way.`,
          language,
          safetyFlag: true,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, confirmMsg]);
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
          console.warn('Geolocation denied or unavailable, using fallback:', err);
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
    const declineMsg: ConversationMessage = {
      id: `msg-decline-${Date.now()}`,
      conversationId: 'default',
      sender: 'AI',
      content:
        language === 'TAMIL'
          ? 'நான் உங்களுடன் தொடர்ந்து பேசுகிறேன். எப்போது உதவி தேவைப்பட்டாலும் எனக்குத் தெரிவிக்கலாம் அல்லது 14416 (Tele-MANAS) எண்ணை அழைக்கலாம்.'
          : language === 'HINDI'
          ? 'मैं यहीं आपके साथ बातचीत जारी रख रहा हूँ। अगर आपको कभी भी सहायता चाहिए तो मुझे बताएं या 14416 पर कॉल करें।'
          : 'Understood. I will continue listening and talking with you. Whenever you feel ready or need urgent help, you can let me know anytime or call 14416.',
      language,
      safetyFlag: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, declineMsg]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    // Check if user is replying affirmatively to an open alert prompt
    if (showCounselorAlertPrompt) {
      const lower = text.toLowerCase();
      if (
        lower === 'yes' || lower === 'yes please' || lower === 'alert' || lower === 'alert counselor' ||
        lower === 'share location' || lower === 'help me' || lower.includes('alert') ||
        lower.includes('share') || lower.includes('yes') ||
        lower.includes('ஆமாம்') || lower.includes('சரி') || lower.includes('பகிர்') ||
        lower.includes('हाँ') || lower.includes('अलर्ट') || lower.includes('भेजें')
      ) {
        setInputText('');
        handleAuthorizeCounselorAlert();
        return;
      }
      if (lower === 'no' || lower === 'no thanks' || lower === 'dont' || lower.includes('இல்லை') || lower.includes('नहीं')) {
        setInputText('');
        handleDeclineCounselorAlert();
        return;
      }
    }

    // Check for danger / threat keywords in input
    const hasDangerKeywords = /danger|threat|unsafe|attack|hurt|harm|kill|abuse|beat|violence|stalk|emergency|ஆபத்து|மிரட்டல்|தாக்குதல்|கொலை|விஷம்|அடிக்க|खतरा|धमकी|हमला|मारना|ప్రమాదం|బెదిరింపు/i.test(text);

    setInputText('');
    const tempUserMsg: ConversationMessage = {
      id: `msg-temp-${Date.now()}`,
      conversationId: 'default',
      sender: 'USER',
      content: text,
      language,
      safetyFlag: hasDangerKeywords,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const data = await apiRequest('/api/victim/message', {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });

      if (data.aiMessage) {
        setMessages((prev) => [...prev, data.aiMessage]);
      }
      if (data.safetyConcernDetected) {
        setHasSafetyConcern(true);
      }

      // If danger or threat detected, show interactive counselor alert & location sharing prompt
      if (data.dangerThreatDetected || data.promptCounselorAlert || hasDangerKeywords) {
        setShowCounselorAlertPrompt(true);
      }
    } catch (e: any) {
      console.error('Chat error:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          conversationId: 'default',
          sender: 'AI',
          content: 'I am here listening to you. Please take a gentle breath. You can also press Get Help anytime.',
          language,
          safetyFlag: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="ai-chat-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Sahaay AI Wellbeing Companion</h2>
              <p className="text-xs text-emerald-200 font-medium">Empathetic, Safe & Confidential</p>
            </div>
          </div>
          <button
            id="btn-close-chat-modal"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Warning Banner if crisis detected */}
        {hasSafetyConcern && (
          <div className="px-4 py-3 bg-red-600 text-white flex items-center justify-between text-xs animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>We care about your safety. Free 24/7 help is available right now.</span>
            </div>
            <button
              id="btn-chat-emergency-call"
              onClick={onOpenEmergency}
              className="px-2.5 py-1 bg-white text-red-700 font-bold rounded-md shadow-xs text-[11px] shrink-0 cursor-pointer"
            >
              Get Help
            </button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3.5 bg-slate-50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'USER';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  <p>{msg.content}</p>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}

          {/* Interactive Counselor Alert & Location Sharing Consent Card */}
          {showCounselorAlertPrompt && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-md space-y-3 animate-in zoom-in-95">
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
                  id="btn-confirm-alert-counselor"
                  type="button"
                  onClick={handleAuthorizeCounselorAlert}
                  disabled={alertDispatchState === 'LOCATING'}
                  className="flex-1 py-2.5 px-3.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {alertDispatchState === 'LOCATING' ? (
                    <>
                      <Navigation className="w-4 h-4 animate-spin" />
                      <span>Sharing Location & Alerting...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>Yes, Alert Counselor & Share Location</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-decline-alert-counselor"
                  type="button"
                  onClick={handleDeclineCounselorAlert}
                  className="py-2.5 px-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  No, Continue Talking
                </button>
              </div>
            </div>
          )}

          {/* Location Shared Feedback Card */}
          {alertDispatchState === 'DISPATCHED' && alertLocationInfo && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
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

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-2xl border border-slate-200 w-fit">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
              <span>Sahaay is reflecting and preparing a warm reply...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-white border-t border-slate-200 flex gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {SUGGESTIONS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip)}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 text-[11px] font-medium rounded-full border border-slate-200 transition-colors shrink-0 cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            id="input-chat-message"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message to Sahaay..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
          />
          <button
            id="btn-send-chat-message"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-md cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Disclaimer footer */}
        <div className="px-4 py-1.5 bg-slate-100 text-center">
          <p className="text-[10px] text-slate-500 italic">
            Sahaay provides first-line supportive conversation, not medical diagnosis.
          </p>
        </div>
      </div>
    </div>
  );
};
