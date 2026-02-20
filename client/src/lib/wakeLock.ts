let wakeLockSentinel: WakeLockSentinel | null = null;
let wakeLockActive = false;
let listenerAttached = false;

export async function acquireWakeLock(): Promise<boolean> {
  if (wakeLockActive && wakeLockSentinel) return true;

  if (!('wakeLock' in navigator)) {
    console.log('[WakeLock] API not supported on this device');
    return false;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockActive = true;
    console.log('[WakeLock] Screen wake lock acquired');

    wakeLockSentinel.addEventListener('release', () => {
      wakeLockActive = false;
      wakeLockSentinel = null;
    });

    if (!listenerAttached) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      listenerAttached = true;
    }
    return true;
  } catch (err) {
    console.warn('[WakeLock] Failed to acquire:', err);
    return false;
  }
}

export function releaseWakeLock(): void {
  if (listenerAttached) {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    listenerAttached = false;
  }

  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
  wakeLockActive = false;
}

async function handleVisibilityChange(): Promise<void> {
  if (document.visibilityState === 'visible' && !wakeLockActive) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockActive = true;

      wakeLockSentinel.addEventListener('release', () => {
        wakeLockActive = false;
        wakeLockSentinel = null;
      });
    } catch (err) {
      console.warn('[WakeLock] Failed to re-acquire:', err);
    }
  }
}

export function isWakeLockActive(): boolean {
  return wakeLockActive;
}
