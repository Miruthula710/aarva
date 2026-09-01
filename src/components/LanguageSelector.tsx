import React from 'react';
import { Globe } from 'lucide-react';
import { Language } from '../types';

interface LanguageSelectorProps {
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  className?: string;
}

const LANGUAGES: { code: Language; label: string; script: string }[] = [
  { code: 'ENGLISH', label: 'English', script: 'EN' },
  { code: 'TAMIL', label: 'தமிழ்', script: 'Tamil' },
  { code: 'HINDI', label: 'हिन्दी', script: 'Hindi' },
  { code: 'TELUGU', label: 'తెలుగు', script: 'Telugu' },
  { code: 'MALAYALAM', label: 'മലയാളം', script: 'Malayalam' },
  { code: 'KANNADA', label: 'ಕನ್ನಡ', script: 'Kannada' },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <Globe className="w-4 h-4 text-emerald-700" />
      <select
        id="language-picker"
        value={currentLanguage}
        onChange={(e) => onSelectLanguage(e.target.value as Language)}
        className="bg-white text-slate-800 text-sm font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label} ({lang.script})
          </option>
        ))}
      </select>
    </div>
  );
};
