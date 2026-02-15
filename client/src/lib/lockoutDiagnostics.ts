import type { DebugTimingState } from './debugTimingState';

interface TimelineEvent {
  t: number;
  event: string;
  data?: Record<string, any>;
}

interface DiagnosticSnapshot {
  trigger: string;
  triggerTimestamp: number;
  sessionDurationMs: number | null;
  
  session: {
    conversationId: string | null;
    userId: string | null;
    language: string | null;
    inputMode: string | null;
    ttsProvider: string | null;
  };

  device: {
    userAgent: string;
    platform: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    online: boolean;
    connectionType: string | null;
    cookiesEnabled: boolean;
    hardwareConcurrency: number;
  };

  audio: {
    globalPlaybackState: string;
    audioContextState: string;
    isLoopRunning: boolean;
    loopTickCount: number;
    totalAudioChunksReceived: number;
    audioChunksPerSentence: Record<string, number>;
    currentCtxTime: number;
  };

  sentenceTracking: {
    expectedSentenceCount: number | null;
    sentenceScheduleSize: number;
    sentencesReceived: number;
    sentencesStarted: number;
    sentencesEnded: number;
    allSentencesEnded: boolean;
    lastCheckAllResult: boolean | null;
    lastCheckAllReason: string;
    checkAllCallCount: number;
    sentenceScheduleEntries: Array<{
      sentenceIndex: number;
      started: boolean;
      ended: boolean;
      hasEndCtxTime: boolean;
      totalDuration: number;
    }>;
  };

  hookState: {
    isProcessing: boolean;
    pendingAudioCount: number;
    audioReceivedInTurn: boolean;
    responseCompleteReceived: boolean;
    isSwitchingTutor: boolean;
  };

  ws: {
    connectionStatus: string;
    wsResponseCompleteReceived: boolean;
    wsLastMessageType: string;
    wsMessageCount: number;
    recentMessageTypes: string[];
  };

  timing: {
    timeSinceResponseComplete: number | null;
    timeSinceFirstAudio: number | null;
    timeSinceConnect: number | null;
    failsafeTier: string | null;
  };

  timeline: TimelineEvent[];
}

declare global {
  interface Window {
    __voiceSessionDiag?: {
      lastReportTime: number;
      reportCount: number;
      conversationId: string | null;
      userId: string | null;
      language: string | null;
      inputMode: string | null;
      ttsProvider: string | null;
      responseCompleteTimestamp: number | null;
      firstAudioTimestamp: number | null;
      connectTimestamp: number | null;
      timeline: TimelineEvent[];
      isProcessingFn: (() => boolean) | null;
      pendingAudioCountFn: (() => number) | null;
      audioReceivedInTurnFn: (() => boolean) | null;
      responseCompleteFn: (() => boolean) | null;
      isSwitchingTutorFn: (() => boolean) | null;
    };
  }
}

const MAX_TIMELINE_EVENTS = 50;
const MIN_REPORT_INTERVAL_MS = 30000;

export interface SofiaUserNotification {
  trigger: string;
  title: string;
  message: string;
  suggestion: string;
}

const SOFIA_USER_MESSAGES: Record<string, Omit<SofiaUserNotification, 'trigger'>> = {
  lockout_watchdog_8s: {
    title: "Microphone paused",
    message: "It looks like your microphone got stuck. I've freed it up for you.",
    suggestion: "Try speaking again. If it keeps happening, refresh the page.",
  },
  failsafe_tier1_20s: {
    title: "Audio hiccup",
    message: "The audio got interrupted. This can happen on mobile when your screen locks or another app takes over.",
    suggestion: "Try tapping the screen first, then speak again. Keeping the app in the foreground helps.",
  },
  failsafe_tier2_45s: {
    title: "Session recovered",
    message: "Your voice session ran into a snag, but I've reset things so you can keep going.",
    suggestion: "If this keeps happening, try refreshing the page or switching to a different browser.",
  },
  greeting_silence_15s: {
    title: "Taking longer than usual",
    message: "The tutor's greeting is taking a while to come through.",
    suggestion: "Check your internet connection. If there's no sound after a few more seconds, try disconnecting and reconnecting.",
  },
  error: {
    title: "Something went wrong",
    message: "There was a brief connection issue with your voice session.",
    suggestion: "This usually resolves on its own. If it doesn't, try refreshing the page.",
  },
  tts_error: {
    title: "Audio issue",
    message: "There was a problem generating the tutor's voice.",
    suggestion: "The system will try again automatically. If you don't hear anything, try refreshing.",
  },
  mismatch_recovery: {
    title: "Audio recovered",
    message: "A small audio sync issue was automatically fixed.",
    suggestion: "Everything should be working now. No action needed.",
  },
};

type SofiaNotificationCallback = (notification: SofiaUserNotification) => void;
type RemediationCallback = () => void;
let sofiaNotifyCallback: SofiaNotificationCallback | null = null;
let remediationCallback: RemediationCallback | null = null;
let sofiaNotifiedThisSession = false;

export function setSofiaNotificationCallback(cb: SofiaNotificationCallback | null): void {
  sofiaNotifyCallback = cb;
}

export function setRemediationCallback(cb: RemediationCallback | null): void {
  remediationCallback = cb;
}

export function resetSofiaNotificationState(): void {
  sofiaNotifiedThisSession = false;
}

function notifyUserViaSofia(trigger: string): void {
  if (sofiaNotifiedThisSession || !sofiaNotifyCallback) return;
  const msg = SOFIA_USER_MESSAGES[trigger];
  if (!msg) return;
  sofiaNotifiedThisSession = true;
  sofiaNotifyCallback({ trigger, ...msg });
  const LOCKOUT_TRIGGERS = ['lockout_watchdog_8s', 'failsafe_tier1_20s', 'failsafe_tier2_45s'];
  if (remediationCallback && LOCKOUT_TRIGGERS.includes(trigger)) {
    console.log(`[VoiceDiag] Auto-remediation: force-resetting mic for trigger=${trigger}`);
    remediationCallback();
  }
}

function getDiagStore() {
  if (!window.__voiceSessionDiag) {
    window.__voiceSessionDiag = {
      lastReportTime: 0,
      reportCount: 0,
      conversationId: null,
      userId: null,
      language: null,
      inputMode: null,
      ttsProvider: null,
      responseCompleteTimestamp: null,
      firstAudioTimestamp: null,
      connectTimestamp: null,
      timeline: [],
      isProcessingFn: null,
      pendingAudioCountFn: null,
      audioReceivedInTurnFn: null,
      responseCompleteFn: null,
      isSwitchingTutorFn: null,
    };
  }
  return window.__voiceSessionDiag;
}

export function diagSetSession(opts: {
  conversationId: string | null;
  userId: string | null;
  language?: string | null;
  inputMode?: string | null;
  ttsProvider?: string | null;
}) {
  const store = getDiagStore();
  store.conversationId = opts.conversationId;
  store.userId = opts.userId;
  if (opts.language !== undefined) store.language = opts.language;
  if (opts.inputMode !== undefined) store.inputMode = opts.inputMode;
  if (opts.ttsProvider !== undefined) store.ttsProvider = opts.ttsProvider;
}

export function diagSetHookRefs(opts: {
  isProcessingFn: () => boolean;
  pendingAudioCountFn: () => number;
  audioReceivedInTurnFn: () => boolean;
  responseCompleteFn: () => boolean;
  isSwitchingTutorFn: () => boolean;
}) {
  const store = getDiagStore();
  store.isProcessingFn = opts.isProcessingFn;
  store.pendingAudioCountFn = opts.pendingAudioCountFn;
  store.audioReceivedInTurnFn = opts.audioReceivedInTurnFn;
  store.responseCompleteFn = opts.responseCompleteFn;
  store.isSwitchingTutorFn = opts.isSwitchingTutorFn;
}

export function diagEvent(event: string, data?: Record<string, any>) {
  const store = getDiagStore();
  const entry: TimelineEvent = { t: Date.now(), event };
  if (data) entry.data = data;
  store.timeline.push(entry);
  if (store.timeline.length > MAX_TIMELINE_EVENTS) {
    store.timeline = store.timeline.slice(-MAX_TIMELINE_EVENTS);
  }
}

export function diagMarkConnect() {
  const store = getDiagStore();
  store.connectTimestamp = Date.now();
  store.firstAudioTimestamp = null;
  store.responseCompleteTimestamp = null;
  store.timeline = [];
  diagEvent('session_connect');
}

export function diagMarkFirstAudio() {
  const store = getDiagStore();
  if (!store.firstAudioTimestamp) {
    store.firstAudioTimestamp = Date.now();
    const latency = store.connectTimestamp ? Date.now() - store.connectTimestamp : null;
    diagEvent('first_audio', { latencyMs: latency });
  }
}

export function diagMarkResponseComplete(totalSentences: number) {
  const store = getDiagStore();
  store.responseCompleteTimestamp = Date.now();
  diagEvent('response_complete', { totalSentences });
}

export function diagMarkDisconnect(reason?: string) {
  diagEvent('disconnect', { reason });
}

export function diagMarkTurnStart() {
  const store = getDiagStore();
  store.responseCompleteTimestamp = null;
  store.firstAudioTimestamp = null;
  diagEvent('turn_start');
}

export function diagMarkError(code: string, message: string) {
  diagEvent('error', { code, message: message.substring(0, 200) });
}

export function diagMarkTtsError(code: string, message: string) {
  diagEvent('tts_error', { code, message: message.substring(0, 200) });
}

export function diagMarkFailsafe(tier: string, details?: Record<string, any>) {
  diagEvent('failsafe_fired', { tier, ...details });
}

export function diagMarkMismatchRecovery(expected: number, actual: number) {
  diagEvent('mismatch_recovery', { expected, actual });
}

function getConnectionInfo(): string | null {
  try {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      return conn.effectiveType || conn.type || null;
    }
  } catch {}
  return null;
}

function captureSnapshot(trigger: string): DiagnosticSnapshot {
  const debugState = window.__debugTimingState;
  const store = getDiagStore();
  const playbackStore = window.__playbackStateStore;

  const scheduleEntries = (debugState?.sentenceSchedule || []).map((entry: any) => ({
    sentenceIndex: entry.sentenceIndex,
    started: entry.started,
    ended: entry.ended,
    hasEndCtxTime: entry.endCtxTime !== undefined,
    totalDuration: entry.totalDuration,
  }));

  return {
    trigger,
    triggerTimestamp: Date.now(),
    sessionDurationMs: store.connectTimestamp ? Date.now() - store.connectTimestamp : null,

    session: {
      conversationId: store.conversationId,
      userId: store.userId,
      language: store.language,
      inputMode: store.inputMode,
      ttsProvider: store.ttsProvider,
    },

    device: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || 'unknown',
      screenWidth: window.screen?.width || 0,
      screenHeight: window.screen?.height || 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      online: navigator.onLine,
      connectionType: getConnectionInfo(),
      cookiesEnabled: navigator.cookieEnabled,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
    },

    audio: {
      globalPlaybackState: playbackStore?.state || 'unknown',
      audioContextState: debugState?.audioContextState || 'unknown',
      isLoopRunning: debugState?.isLoopRunning ?? false,
      loopTickCount: debugState?.loopTickCount ?? 0,
      totalAudioChunksReceived: debugState?.totalAudioChunksReceived ?? 0,
      audioChunksPerSentence: debugState?.audioChunksReceived ? { ...debugState.audioChunksReceived } : {},
      currentCtxTime: debugState?.currentCtxTime ?? 0,
    },

    sentenceTracking: {
      expectedSentenceCount: debugState?.expectedSentenceCount ?? null,
      sentenceScheduleSize: scheduleEntries.length,
      sentencesReceived: debugState?.sentencesReceived ?? 0,
      sentencesStarted: debugState?.sentencesStarted ?? 0,
      sentencesEnded: debugState?.sentencesEnded ?? 0,
      allSentencesEnded: debugState?.allSentencesEnded ?? false,
      lastCheckAllResult: debugState?.lastCheckAllResult ?? null,
      lastCheckAllReason: debugState?.lastCheckAllReason || '',
      checkAllCallCount: debugState?.checkAllCallCount ?? 0,
      sentenceScheduleEntries: scheduleEntries,
    },

    hookState: {
      isProcessing: store.isProcessingFn?.() ?? false,
      pendingAudioCount: store.pendingAudioCountFn?.() ?? -1,
      audioReceivedInTurn: store.audioReceivedInTurnFn?.() ?? false,
      responseCompleteReceived: store.responseCompleteFn?.() ?? false,
      isSwitchingTutor: store.isSwitchingTutorFn?.() ?? false,
    },

    ws: {
      connectionStatus: debugState?.connectionStatus || 'unknown',
      wsResponseCompleteReceived: debugState?.wsResponseCompleteReceived ?? false,
      wsLastMessageType: debugState?.wsLastMessageType || '',
      wsMessageCount: debugState?.wsMessageCount ?? 0,
      recentMessageTypes: debugState?.wsMessageTypes || [],
    },

    timing: {
      timeSinceResponseComplete: store.responseCompleteTimestamp
        ? Date.now() - store.responseCompleteTimestamp
        : null,
      timeSinceFirstAudio: store.firstAudioTimestamp
        ? Date.now() - store.firstAudioTimestamp
        : null,
      timeSinceConnect: store.connectTimestamp
        ? Date.now() - store.connectTimestamp
        : null,
      failsafeTier: null,
    },

    timeline: [...store.timeline],
  };
}

async function sendSnapshot(snapshot: DiagnosticSnapshot): Promise<void> {
  try {
    const response = await fetch('/api/voice/client-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) {
      console.warn(`[VoiceDiag] Failed to send report: ${response.status}`);
    } else {
      console.log(`[VoiceDiag] Report sent: trigger=${snapshot.trigger}, conversation=${snapshot.session.conversationId}`);
    }
  } catch (err) {
    console.warn('[VoiceDiag] Failed to send report:', err);
  }
}

function shouldReport(): boolean {
  const store = getDiagStore();
  return Date.now() - store.lastReportTime >= MIN_REPORT_INTERVAL_MS;
}

function markReported() {
  const store = getDiagStore();
  store.lastReportTime = Date.now();
  store.reportCount++;
}

export function reportDiagnostic(trigger: string, extras?: { failsafeTier?: string }): void {
  if (!shouldReport()) {
    console.log(`[VoiceDiag] Skipping report (throttled): ${trigger}`);
    return;
  }
  markReported();
  const snapshot = captureSnapshot(trigger);
  if (extras?.failsafeTier) {
    snapshot.timing.failsafeTier = extras.failsafeTier;
  }
  console.log(`[VoiceDiag] Capturing snapshot: ${trigger}`, {
    expected: snapshot.sentenceTracking.expectedSentenceCount,
    scheduleSize: snapshot.sentenceTracking.sentenceScheduleSize,
    reason: snapshot.sentenceTracking.lastCheckAllReason,
    playback: snapshot.audio.globalPlaybackState,
    processing: snapshot.hookState.isProcessing,
  });
  void sendSnapshot(snapshot);
  notifyUserViaSofia(trigger);
}

export function startLockoutWatchdog(): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    const store = getDiagStore();
    if (!store.responseCompleteTimestamp) return;
    const timeSince = Date.now() - store.responseCompleteTimestamp;
    if (timeSince < 7000) return;

    const isProc = store.isProcessingFn?.() ?? false;
    const playbackState = window.__playbackStateStore?.state;
    if (isProc && playbackState !== 'playing') {
      reportDiagnostic('lockout_watchdog_8s');
    }
  }, 8000);
}

export function startGreetingSilenceWatchdog(): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    const store = getDiagStore();
    if (!store.firstAudioTimestamp && store.connectTimestamp) {
      const elapsed = Date.now() - store.connectTimestamp;
      if (elapsed > 14000) {
        reportDiagnostic('greeting_silence_15s');
      }
    }
  }, 15000);
}
