import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Globe,
  ShieldCheck,
  X,
  Check,
  Heart,
  Edit2,
  Save,
  LogOut,
} from 'lucide-react';
import { TranslationDictionary } from '../lib/i18n';
import { Language, User, Victim } from '../types';
import { apiRequest } from '../lib/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  victim: Victim;
  t: TranslationDictionary;
  onProfileUpdated: (updatedUser: User, updatedVictim: Victim) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  victim,
  t,
  onProfileUpdated,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [village, setVillage] = useState(victim.village || '');
  const [district, setDistrict] = useState(victim.district || '');
  const [preferredLanguage, setPreferredLanguage] = useState<Language>(user.preferredLanguage || 'TAMIL');
  const [emergencyContactName, setEmergencyContactName] = useState(victim.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(victim.emergencyContactPhone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setName(user.name || '');
    setVillage(victim.village || '');
    setDistrict(victim.district || '');
    setPreferredLanguage(user.preferredLanguage || 'TAMIL');
    setEmergencyContactName(victim.emergencyContactName || '');
    setEmergencyContactPhone(victim.emergencyContactPhone || '');
    setIsEditing(false);
    setSuccessMessage('');
    setErrorMessage('');
  }, [user, victim, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const data = await apiRequest('/api/victim/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          village: village.trim(),
          district: district.trim(),
          preferredLanguage,
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactPhone: emergencyContactPhone.trim(),
        }),
      });

      if (data.success) {
        setSuccessMessage('Profile updated successfully.');
        setIsEditing(false);
        onProfileUpdated(data.user, data.victim);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="profile-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="profile-modal-container"
        className="relative w-full max-w-lg bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">User Profile & Account</h2>
              <p className="text-xs text-emerald-200 font-medium">Beneficiary Code: {victim.victimCode}</p>
            </div>
          </div>
          <button
            id="btn-close-profile-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-900">
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Account Overview Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{user.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {user.phoneNumber ? `Phone: ${user.phoneNumber}` : user.email ? `Email: ${user.email}` : 'Community Member'}
                  </p>
                </div>
              </div>

              {!isEditing && (
                <button
                  id="btn-edit-profile-toggle"
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
              <div className="p-2 bg-white rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium block">Location</span>
                <span className="font-bold text-slate-800">{victim.village || 'Not specified'}, {victim.district || ''}</span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium block">Preferred Language</span>
                <span className="font-bold text-slate-800">{user.preferredLanguage || 'TAMIL'}</span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Full Name
                </label>
                <input
                  id="input-profile-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Village / Town
                  </label>
                  <input
                    id="input-profile-village"
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="Enter village"
                    className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    District
                  </label>
                  <input
                    id="input-profile-district"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Enter district"
                    className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Preferred Language
                </label>
                <select
                  id="input-profile-lang"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as Language)}
                  className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs cursor-pointer"
                >
                  <option value="TAMIL">தமிழ் (Tamil)</option>
                  <option value="HINDI">हिन्दी (Hindi)</option>
                  <option value="TELUGU">తెలుగు (Telugu)</option>
                  <option value="MALAYALAM">മലയാളം (Malayalam)</option>
                  <option value="KANNADA">ಕನ್ನಡ (Kannada)</option>
                  <option value="ENGLISH">English</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Emergency Contact Name
                  </label>
                  <input
                    id="input-profile-emg-name"
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="e.g. Family member"
                    className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    Emergency Contact Phone
                  </label>
                  <input
                    id="input-profile-emg-phone"
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Mobile number"
                    className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  id="btn-save-profile"
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
                </button>
                <button
                  id="btn-cancel-edit-profile"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registered Contact & Care Details
              </h4>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Mobile / Identifier:</span>
                  <span className="font-bold text-slate-900">{user.phoneNumber || user.email || 'None'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Village / Community:</span>
                  <span className="font-bold text-slate-900">{victim.village || 'Rural Community'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">District & State:</span>
                  <span className="font-bold text-slate-900">{victim.district || 'District'}, {victim.state || 'State'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Emergency Contact:</span>
                  <span className="font-bold text-slate-900">
                    {victim.emergencyContactName ? `${victim.emergencyContactName} (${victim.emergencyContactPhone || 'No phone'})` : 'Not set'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  id="btn-profile-logout"
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of this Account</span>
                </button>

                <button
                  id="btn-close-profile-done"
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
