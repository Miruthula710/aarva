import { OfflineSyncItem } from '../types';

const QUEUE_KEY = 'gramincare_offline_queue';

export function getOfflineQueue(): OfflineSyncItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineSyncItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save offline queue:', e);
  }
}

export function enqueueOfflineItem(item: Omit<OfflineSyncItem, 'id' | 'timestamp'>) {
  const fullItem: OfflineSyncItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    ...item,
  };
  const current = getOfflineQueue();
  current.push(fullItem);
  saveOfflineQueue(current);
  return fullItem;
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function flushOfflineQueue(token: string): Promise<{ syncedCount: number; message: string }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, message: 'Queue is empty.' };
  }

  try {
    const res = await fetch('/api/victim/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ queue }),
    });

    if (res.ok) {
      const data = await res.json();
      clearOfflineQueue();
      return { syncedCount: data.syncedCount, message: data.message };
    }
  } catch (e) {
    console.warn('Flush offline queue failed, will retry when network is steady:', e);
  }

  return { syncedCount: 0, message: 'Sync paused until connection stabilizes.' };
}
