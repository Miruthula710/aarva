import React, { useState, useEffect } from 'react';
import { User, Victim, Counselor, Language } from './types';
import { apiRequest, getAuthToken, clearAuthToken } from './lib/api';
import { AuthModal } from './components/AuthModal';
import { VictimDashboard } from './components/VictimDashboard';
import { CounselorDashboard } from './components/CounselorDashboard';
import { Heart, ShieldCheck, Sparkles } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [victim, setVictim] = useState<Victim | null>(null);
  const [counselor, setCounselor] = useState<Counselor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user);
      setVictim(data.victim);
      setCounselor(data.counselor);
    } catch (e) {
      clearAuthToken();
      setUser(null);
      setVictim(null);
      setCounselor(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuthSuccess = (data: any) => {
    setUser(data.user);
    setVictim(data.victim);
    setCounselor(data.counselor);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    clearAuthToken();
    setUser(null);
    setVictim(null);
    setCounselor(null);
  };

  const handleLanguageChange = (newLang: Language) => {
    if (user) {
      setUser({ ...user, preferredLanguage: newLang });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center animate-pulse">
          <Heart className="w-7 h-7 text-white" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold tracking-tight">Aarva Health Care</p>
          <p className="text-xs text-slate-400">Loading rural mental health & care coordination system...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated State -> Show Auth / Demo Switcher Modal
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl" />

        <div className="text-center max-w-md space-y-3 z-10 mb-8">
          <div className="w-14 h-14 rounded-3xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg">
            <Heart className="w-8 h-8 fill-white/20" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Aarva Health Care
          </h1>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            First-line mental health support and care-coordination connecting rural communities with healthcare professionals.
          </p>
        </div>

        <AuthModal
          isOpen={true}
          onSuccess={handleAuthSuccess}
          defaultRole="VICTIM"
        />
      </div>
    );
  }

  // Role: VICTIM
  if (user.role === 'VICTIM' && victim) {
    return (
      <VictimDashboard
        user={user}
        victim={victim}
        onLogout={handleLogout}
        onLanguageChange={handleLanguageChange}
      />
    );
  }

  // Role: COUNSELOR or ADMIN
  if ((user.role === 'COUNSELOR' || user.role === 'ADMIN') && counselor) {
    return (
      <CounselorDashboard
        user={user}
        counselor={counselor}
        onLogout={handleLogout}
      />
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <p className="text-sm font-bold text-slate-800">Account profile loaded.</p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default App;
