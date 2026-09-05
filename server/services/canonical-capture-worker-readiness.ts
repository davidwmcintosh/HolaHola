export type CanonicalCaptureWorkerReadiness = {
  phase: 'stopped' | 'arming' | 'armed';
  armed: boolean;
  startedAt: number | null;
  armedAt: number | null;
};

let readiness: CanonicalCaptureWorkerReadiness = {
  phase: 'stopped',
  armed: false,
  startedAt: null,
  armedAt: null,
};

export function beginCanonicalCaptureWorkerStartup(now = Date.now()): boolean {
  if (readiness.phase !== 'stopped') return false;
  readiness = {
    phase: 'arming',
    armed: false,
    startedAt: now,
    armedAt: null,
  };
  return true;
}

export function markCanonicalCaptureWorkerArmed(now = Date.now()): void {
  readiness = {
    ...readiness,
    phase: 'armed',
    armed: true,
    startedAt: readiness.startedAt ?? now,
    armedAt: now,
  };
}

export function getCanonicalCaptureWorkerReadiness(): CanonicalCaptureWorkerReadiness {
  return { ...readiness };
}

export function isCanonicalCaptureAvailable(
  workspaceReady: boolean,
  worker: CanonicalCaptureWorkerReadiness = readiness,
): boolean {
  return workspaceReady && worker.armed;
}

export function evaluateCanonicalCaptureHealth(
  workspaceReady: boolean,
  worker: CanonicalCaptureWorkerReadiness = readiness,
): { status: 200 | 503; ok: boolean } {
  const ok = isCanonicalCaptureAvailable(workspaceReady, worker);
  return { status: ok ? 200 : 503, ok };
}

export function resetCanonicalCaptureWorkerReadinessForTest(): void {
  readiness = {
    phase: 'stopped',
    armed: false,
    startedAt: null,
    armedAt: null,
  };
}