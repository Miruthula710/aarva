import React from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { TranslationDictionary } from '../lib/i18n';

interface OfflineBannerProps {
  isOffline: boolean;
  queuedCount: number;
  onSyncNow: () => void;
  isSyncing: boolean;
  t: TranslationDictionary;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  queuedCount,
  onSyncNow,
  isSyncing,
  t,
}) => {
  if (!isOffline && queuedCount === 0) return null;

  return (
    <div
      id="offline-status-banner"
      className={`w-full px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
        isOffline
          ? 'bg-amber-100 border-b border-amber-300 text-amber-900'
          : 'bg-emerald-100 border-b border-emerald-300 text-emerald-900'
      }`}
    >
      <div className="flex items-center gap-2 max-w-2xl">
        {isOffline ? (
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
        )}
        <span>
          {isOffline
            ? `${t.offlineNotice} (${queuedCount} item(s) pending sync)`
            : `Back online! ${queuedCount} offline item(s) ready to sync.`}
        </span>
      </div>

      {queuedCount > 0 && (
        <button
          id="btn-sync-offline-queue"
          onClick={onSyncNow}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-md border border-slate-300 shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
};
