import React, { useState, useEffect } from 'react';
import {
  Mic,
  MessageSquare,
  HeartHandshake,
  ShieldAlert,
  PhoneCall,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LogOut,
  User,
  Activity,
  Heart,
  ChevronRight,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { TranslationDictionary, translations } from '../lib/i18n';
import { Language, Victim, User as UserType } from '../types';
import { LanguageSelector } from './LanguageSelector';
import { OfflineBanner } from './OfflineBanner';
import { VoiceModal } from './VoiceModal';
import { ChatModal } from './ChatModal';
import { CheckInModal } from './CheckInModal';
import { EmergencyModal } from './EmergencyModal';
import { ProfileModal } from './ProfileModal';
import { apiRequest } from '../lib/api';
import { getOfflineQueue, flushOfflineQueue } from '../lib/offlineQueue';

interface VictimDashboardProps {
  user: UserType;
  victim: Victim;
  onLogout: () => void;
  onLanguageChange: (lang: Language) => void;
}

export const VictimDashboard: React.FC<VictimDashboardProps> = ({
  user: initialUser,
  victim: initialVictim,
  onLogout,
  onLanguageChange,
}) => {
  const [currentUser, setCurrentUser] = useState<UserType>(initialUser);
  const [currentVictim, setCurrentVictim] = useState<Victim>(initialVictim);
  const [currentLang, setCurrentLang] = useState<Language>(initialUser.preferredLanguage || 'TAMIL');
  const t: TranslationDictionary = translations[currentLang] || translations.ENGLISH;

  const [profileData, setProfileData] = useState<any>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(getOfflineQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchProfile = async () => {
    try {
      const data = await apiRequest('/api/victim/profile');
      setProfileData(data);
      if (data.victim) setCurrentVictim(data.victim);
      if (data.user) setCurrentUser((prev) => ({ ...prev, ...data.user }));
    } catch (e) {
      console.warn('Failed to load victim profile from network:', e);
    }
  };

  useEffect(() => {
    fetchProfile();

    const handleOnline = () => {
      setIsOffline(false);
      handleSyncNow();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSyncNow = async () => {
    const token = localStorage.getItem('gramincare_auth_token');
    if (!token) return;

    setIsSyncing(true);
    await flushOfflineQueue(token);
    setQueuedCount(getOfflineQueue().length);
    setIsSyncing(false);
    fetchProfile();
  };

  const handleLangSelect = async (lang: Language) => {
    setCurrentLang(lang);
    onLanguageChange(lang);
    try {
      await apiRequest('/api/victim/language', {
        method: 'POST',
        body: JSON.stringify({ language: lang }),
      });
    } catch (e) {}
  };

  const isCompletedToday = profileData?.status?.todayCheckInCompleted || false;
  const currentRisk = profileData?.victim?.currentRiskLevel || initialVictim.currentRiskLevel || 'LOW';
  const currentScore = profileData?.victim?.currentDistressScore ?? initialVictim.currentDistressScore ?? 20;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-base">
      {/* Offline sync banner */}
      <OfflineBanner
        isOffline={isOffline}
        queuedCount={queuedCount}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        t={t}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Heart className="w-6 h-6 fill-white/20" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                {t.appTitle}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <LanguageSelector
              currentLanguage={currentLang}
              onSelectLanguage={handleLangSelect}
            />

            <button
              id="btn-victim-profile"
              onClick={() => setIsProfileOpen(true)}
              className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200 hover:border-emerald-300"
              title="View & Edit Account Profile"
            >
              <User className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold hidden sm:inline text-slate-800">Profile</span>
            </button>

            <button
              id="btn-victim-logout"
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title={t.logout}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Welcome Greeting & Status Pill */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900 text-white rounded-3xl shadow-md space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="text-left group cursor-pointer"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 group-hover:underline">
                  {t.hello} {currentUser.name} 👤
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {t.howAreYou}
                </h2>
              </button>
            </div>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
              {isOffline ? t.offline : t.online}
            </span>
          </div>

          <div className="pt-2 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-300" />
              <span>{t.nextReminder}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-300" />
              <span>Counselor: {profileData?.counselor?.name || 'Dr. Kavitha S.'}</span>
            </div>
          </div>
        </div>

        {/* 4 Big Main Action Cards (Mobile-First Accessible Design) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: TALK (Voice Assistant) */}
          <button
            id="card-action-talk"
            onClick={() => setIsVoiceOpen(true)}
            className="group p-5 bg-white hover:bg-emerald-50/50 rounded-3xl border-2 border-emerald-500/30 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                <Mic className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-900">
                  {t.talk}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {t.talkSubtitle}
                </p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transform group-hover:translate-x-1 transition-all" />
          </button>

          {/* Card 2: CHAT (Empathetic AI) */}
          <button
            id="card-action-chat"
            onClick={() => setIsChatOpen(true)}
            className="group p-5 bg-white hover:bg-teal-50/50 rounded-3xl border-2 border-teal-500/30 hover:border-teal-500 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 group-hover:bg-teal-600 text-teal-700 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-900">
                  {t.chat}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {t.chatSubtitle}
                </p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-teal-600 transform group-hover:translate-x-1 transition-all" />
          </button>

          {/* Card 3: DAILY CHECK-IN */}
          <button
            id="card-action-checkin"
            onClick={() => setIsCheckInOpen(true)}
            className="group p-5 bg-white hover:bg-indigo-50/50 rounded-3xl border-2 border-indigo-500/30 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                <HeartHandshake className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-900">
                    {t.dailyCheckIn}
                  </h3>
                  {isCompletedToday && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      ✓ Done
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {t.dailyCheckInSubtitle}
                </p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transform group-hover:translate-x-1 transition-all" />
          </button>

          {/* Card 4: GET HELP / EMERGENCY SOS */}
          <button
            id="card-action-emergency"
            onClick={() => setIsEmergencyOpen(true)}
            className="group p-5 bg-red-50/70 hover:bg-red-100/80 rounded-3xl border-2 border-red-400 hover:border-red-600 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md animate-pulse">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-red-900">
                  {t.getHelp}
                </h3>
                <p className="text-xs text-red-700 font-medium">
                  {t.getHelpSubtitle}
                </p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-red-400 group-hover:text-red-700 transform group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Today's Wellbeing Status Summary Card */}
        <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              {t.wellbeingStatus}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                currentRisk === 'HIGH'
                  ? 'bg-red-100 text-red-800'
                  : currentRisk === 'ELEVATED'
                  ? 'bg-amber-100 text-amber-800'
                  : currentRisk === 'MILD'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {currentRisk === 'HIGH'
                ? t.high
                : currentRisk === 'ELEVATED'
                ? t.elevated
                : currentRisk === 'MILD'
                ? t.mild
                : t.low}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-800">
                {isCompletedToday ? t.completed : t.notAssessed}
              </p>
              <p className="text-xs text-slate-500">
                Beneficiary ID: <strong className="text-slate-700">{initialVictim.victimCode}</strong> ({initialVictim.village || 'Village'})
              </p>
            </div>

            <button
              onClick={() => setIsCheckInOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              {isCompletedToday ? 'Check in Again' : 'Start Check-in'}
            </button>
          </div>
        </div>

        {/* Reassurance Footer */}
        <div className="text-center py-2">
          <p className="text-xs text-slate-400 font-medium">
            {t.disclaimer}
          </p>
        </div>
      </main>

      {/* Modals */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSwitchToChat={() => {
          setIsVoiceOpen(false);
          setIsChatOpen(true);
        }}
        language={currentLang}
        t={t}
      />

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        language={currentLang}
        t={t}
        onOpenEmergency={() => {
          setIsChatOpen(false);
          setIsEmergencyOpen(true);
        }}
      />

      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        language={currentLang}
        t={t}
        isOffline={isOffline}
        onCheckInCompleted={fetchProfile}
      />

      <EmergencyModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        t={t}
        counselorName={profileData?.counselor?.name}
        isOffline={isOffline}
        onAlertTriggered={fetchProfile}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        victim={currentVictim}
        t={t}
        onProfileUpdated={(updatedUser, updatedVictim) => {
          setCurrentUser(updatedUser);
          setCurrentVictim(updatedVictim);
          if (updatedUser.preferredLanguage) {
            setCurrentLang(updatedUser.preferredLanguage);
            onLanguageChange(updatedUser.preferredLanguage);
          }
          fetchProfile();
        }}
        onLogout={onLogout}
      />
    </div>
  );
};
