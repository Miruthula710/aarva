import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Heart,
  KeyRound,
  Phone,
  Mail,
  ArrowRight,
  Sparkles,
  Users,
  Building2,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Role, Language } from '../types';
import { apiRequest, setAuthToken } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (data: any) => void;
  defaultRole?: Role;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onSuccess,
  defaultRole = 'VICTIM',
}) => {
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [role, setRole] = useState<Role>(defaultRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>('TAMIL');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password: password.trim(), role }),
      });

      if (data.token) {
        setAuthToken(data.token);
        onSuccess(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: identifier.trim(),
          password: password.trim(),
          preferredLanguage,
          village: village.trim(),
          district: district.trim(),
        }),
      });

      if (data.token) {
        setAuthToken(data.token);
        onSuccess(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (userType: 'VICTIM' | 'COUNSELOR', codeOrBadge: string) => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      const data = await apiRequest('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({
          userType,
          victimCode: userType === 'VICTIM' ? codeOrBadge : undefined,
          counselorBadge: userType === 'COUNSELOR' ? codeOrBadge : undefined,
        }),
      });

      if (data.token) {
        setAuthToken(data.token);
        onSuccess(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Aarva Health Care</h2>
              <p className="text-xs text-emerald-200 font-medium">Safe & Confidential Mental Health Portal</p>
            </div>
          </div>
        </div>

        {/* Portal Switcher (Victim vs Counselor) */}
        <div className="px-6 pt-5 pb-2 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 p-1 bg-slate-200 rounded-xl">
            <button
              id="tab-role-victim"
              type="button"
              onClick={() => {
                setRole('VICTIM');
                setIdentifier('');
                setPassword('');
                setErrorMessage('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'VICTIM'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Heart className="w-4 h-4 text-emerald-600" />
              <span>Community Member</span>
            </button>
            <button
              id="tab-role-counselor"
              type="button"
              onClick={() => {
                setRole('COUNSELOR');
                setIdentifier('');
                setPassword('');
                setErrorMessage('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'COUNSELOR'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <span>Counselor / Officer</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-900">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={activeTab === 'LOGIN' ? handleLogin : handleRegister} className="space-y-4">
            {activeTab === 'REGISTER' && (
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  />
                </div>
              </div>
            )}

            {/* Email / Mobile ID Input with high contrast dark text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  {role === 'COUNSELOR' ? 'Email Address' : 'Email Address or Mobile Number'}
                </label>
                {role === 'COUNSELOR' && (
                  <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md">
                    Officer / Staff ID
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  {role === 'COUNSELOR' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </div>
                <input
                  id="input-auth-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={role === 'COUNSELOR' ? 'kavitha.sundaram@gramincare.in or admin@gramincare.in' : 'Enter mobile number or email'}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            {/* Password Input with high contrast dark text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Password <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Default: Password123!
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password (e.g. Password123!)"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            {activeTab === 'REGISTER' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">Preferred Language</label>
                  <select
                    id="input-reg-lang"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as Language)}
                    className="w-full px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  >
                    <option value="TAMIL">தமிழ் (Tamil)</option>
                    <option value="HINDI">हिन्दी (Hindi)</option>
                    <option value="TELUGU">తెలుగు (Telugu)</option>
                    <option value="MALAYALAM">മലയാളം (Malayalam)</option>
                    <option value="KANNADA">ಕನ್ನಡ (Kannada)</option>
                    <option value="ENGLISH">English</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">Village / Town</label>
                  <input
                    id="input-reg-village"
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Village Name"
                    className="w-full px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  />
                </div>
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>
                {isLoading
                  ? 'Authenticating...'
                  : role === 'COUNSELOR'
                  ? 'Open Counselor Clinical Portal'
                  : activeTab === 'LOGIN'
                  ? 'Sign In Securely'
                  : 'Create Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {role === 'VICTIM' && (
            <div className="text-center pt-1 border-t border-slate-200">
              <button
                id="btn-toggle-auth-tab"
                type="button"
                onClick={() => {
                  setActiveTab(activeTab === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                  setErrorMessage('');
                }}
                className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                {activeTab === 'LOGIN' ? "Don't have an account? Register here" : 'Already registered? Log in'}
              </button>
            </div>
          )}

          {/* Collapsible Sample Accounts for Testing */}
          <div className="pt-2 border-t border-slate-100">
            <button
              id="btn-toggle-demo-profiles"
              type="button"
              onClick={() => setShowDemoProfiles(!showDemoProfiles)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 py-1.5 px-1 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>1-Click Fast Access / Demo Accounts</span>
              </div>
              {showDemoProfiles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDemoProfiles && (
              <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in">
                <p className="text-[11px] text-slate-500">
                  Click any profile below for instant access without typing:
                </p>
                {role === 'VICTIM' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      id="btn-demo-selvi"
                      type="button"
                      onClick={() => handleDemoLogin('VICTIM', 'V-1001')}
                      disabled={isLoading}
                      className="p-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 block">Selvi M.</span>
                      <span className="text-[10px] text-amber-700 font-semibold block">Elevated Distress</span>
                      <span className="text-[10px] text-slate-500">Tamil (V-1001)</span>
                    </button>

                    <button
                      id="btn-demo-ramesh"
                      type="button"
                      onClick={() => handleDemoLogin('VICTIM', 'V-1002')}
                      disabled={isLoading}
                      className="p-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 block">Ramesh P.</span>
                      <span className="text-[10px] text-blue-700 font-semibold block">Mild Risk</span>
                      <span className="text-[10px] text-slate-500">Hindi (V-1002)</span>
                    </button>

                    <button
                      id="btn-demo-lakshmi"
                      type="button"
                      onClick={() => handleDemoLogin('VICTIM', 'V-1003')}
                      disabled={isLoading}
                      className="p-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 block">Lakshmi D.</span>
                      <span className="text-[10px] text-emerald-700 font-semibold block">Low / Stable</span>
                      <span className="text-[10px] text-slate-500">Telugu (V-1003)</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      id="btn-demo-kavitha"
                      type="button"
                      onClick={() => handleDemoLogin('COUNSELOR', 'CNS-TN-401')}
                      disabled={isLoading}
                      className="p-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 block">Dr. Kavitha Sundaram</span>
                      <span className="text-[10px] text-teal-800 font-semibold block">Senior Psychologist</span>
                      <span className="text-[10px] text-slate-500">Thanjavur PHC (CNS-TN-401)</span>
                    </button>

                    <button
                      id="btn-demo-amit"
                      type="button"
                      onClick={() => handleDemoLogin('COUNSELOR', 'CNS-MH-108')}
                      disabled={isLoading}
                      className="p-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 block">Dr. Amit Sharma</span>
                      <span className="text-[10px] text-teal-800 font-semibold block">District Health Officer</span>
                      <span className="text-[10px] text-slate-500">Tele-MANAS (CNS-MH-108)</span>
                    </button>

                    <button
                      id="btn-demo-admin"
                      type="button"
                      onClick={() => handleDemoLogin('COUNSELOR', 'ADMIN')}
                      disabled={isLoading}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-left shadow-2xs transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-900 block">District Admin</span>
                      <span className="text-[10px] text-indigo-700 font-semibold block">System Administrator</span>
                      <span className="text-[10px] text-slate-500">admin@gramincare.in</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
