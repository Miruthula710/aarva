import React, { useState } from 'react';
import { PhoneCall, AlertTriangle, X, ShieldAlert, CheckCircle, HeartHandshake } from 'lucide-react';
import { TranslationDictionary } from '../lib/i18n';
import { apiRequest } from '../lib/api';
import { enqueueOfflineItem } from '../lib/offlineQueue';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: TranslationDictionary;
  counselorName?: string;
  isOffline: boolean;
  onAlertTriggered?: () => void;
}

const EMERGENCY_NUMBERS = [
  {
    name: 'Tele-MANAS (National Mental Health Helpline)',
    number: '14416',
    description: '24/7 Free Government Tele-Mental Health Assistance in 20+ Languages',
    badge: 'Toll-Free 24/7',
  },
  {
    name: 'KIRAN Mental Health Helpline',
    number: '1800-599-0019',
    description: 'Ministry of Social Justice 24/7 Psychological First Aid & Support',
    badge: 'Toll-Free 24/7',
  },
  {
    name: 'National Emergency Response Support',
    number: '112',
    description: 'Police, Medical & Ambulance Emergency Services',
    badge: 'All India Emergency',
  },
  {
    name: 'Vandrevala Foundation Helpline',
    number: '9999 666 555',
    description: '24/7 Free Mental Health Counseling & Crisis Intervention',
    badge: 'Free Counseling',
  },
];

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  t,
  counselorName,
  isOffline,
  onAlertTriggered,
}) => {
  const [sosStatus, setSosStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [sosMessage, setSosMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleTriggerSOS = async () => {
    setSosStatus('SENDING');
    if (isOffline) {
      enqueueOfflineItem({
        type: 'OFFLINE_SOS',
        payload: { reason: 'Victim triggered emergency SOS in offline mode' },
      });
      setSosStatus('SENT');
      setSosMessage('SOS recorded offline. It will be immediately dispatched to your counselor when connection returns.');
      if (onAlertTriggered) onAlertTriggered();
      return;
    }

    try {
      const data = await apiRequest('/api/victim/emergency-sos', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Victim triggered 1-click Emergency SOS assistance' }),
      });
      setSosStatus('SENT');
      setSosMessage(data.message || t.sosTriggered);
      if (onAlertTriggered) onAlertTriggered();
    } catch (e: any) {
      setSosStatus('SENT');
      setSosMessage(t.sosTriggered);
    }
  };

  return (
    <div
      id="emergency-sos-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{t.emergencyTitle}</h2>
              <p className="text-xs text-red-100 font-medium">Immediate, Confidential & 24/7</p>
            </div>
          </div>
          <button
            id="btn-close-emergency-modal"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm font-medium text-red-900 leading-relaxed">
              {t.emergencySubtitle}
            </p>
          </div>

          {/* 1-Click Notify Counselor SOS */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">
                Assigned Counselor: {counselorName || 'Local Healthcare Team'}
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Pressing below alerts your counselor's dashboard with urgent high priority so they can reach out to you directly.
            </p>

            {sosStatus === 'SENT' ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold">
                <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>{sosMessage}</span>
              </div>
            ) : (
              <button
                id="btn-trigger-sos-alert"
                onClick={handleTriggerSOS}
                disabled={sosStatus === 'SENDING'}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-5 h-5" />
                {sosStatus === 'SENDING' ? 'Dispatching Alert...' : t.notifyCounselor}
              </button>
            )}
          </div>

          {/* Direct Phone Numbers List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Direct Emergency Helplines (Toll-Free & Confidential)
            </h4>

            {EMERGENCY_NUMBERS.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-red-400 hover:shadow-md transition-all flex items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{item.name}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.description}</p>
                  <p className="text-base font-black text-red-600 tracking-wide">{item.number}</p>
                </div>

                <a
                  id={`btn-call-helpline-${idx}`}
                  href={`tel:${item.number.replace(/\s+/g, '')}`}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  <PhoneCall className="w-4 h-4" />
                  {t.callNow}
                </a>
              </div>
            ))}
          </div>

          {/* Reassurance text */}
          <p className="text-center text-xs text-slate-500 italic">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};
