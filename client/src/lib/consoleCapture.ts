type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

interface CapturedEntry {
  t: number;
  l: LogLevel;
  m: string;
  s?: string;
}

interface SessionMeta {
  conversationId?: string;
  ttsProvider?: string;
  tutorGender?: string;
  language?: string;
  difficulty?: string;
  inputMode?: string;
  [key: string]: unknown;
}

interface PlatformInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  connectionType?: string;
  connectionDownlink?: number;
  memoryJsHeapUsed?: number;
  memoryJsHeapTotal?: number;
  audioContextState?: string;
  audioContextSampleRate?: number;
  maxTouchPoints: number;
  hardwareConcurrency: number;
  cookieEnabled: boolean;
  onLine: boolean;
  vendor: string;
}

const BUFFER_SIZE = 500;
const MAX_MSG_LENGTH = 800;
const ERROR_FLUSH_THROTTLE_MS = 30_000;
const MAX_FLUSHES_PER_HOUR = 5;

let buffer: CapturedEntry[] = [];
let bufferHead = 0;
let bufferCount = 0;
let installed = false;
let inVoiceSession = false;
let currentSessionMeta: SessionMeta | null = null;
let lastErrorFlush = 0;
let flushCountThisHour = 0;
let flushHourStart = 0;

const originals: Record<LogLevel, (...args: any[]) => void> = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  info: console.info,
};

const PII_PATTERNS: [RegExp, string][] = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'],
  [/\b(Bearer\s+|token[=:]\s*)[A-Za-z0-9._~+/=-]{20,}\b/gi, '$1[REDACTED]'],
  [/\b(sk-|pk_|rk_|key_)[A-Za-z0-9]{10,}\b/g, '[API_KEY]'],
  [/\b(password|passwd|pwd|secret)[=:]\s*\S+/gi, '$1=[REDACTED]'],
  [/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]'],
];

function redactPII(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function serializeArgs(args: any[]): string {
  try {
    const parts = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    });
    const full = parts.join(' ');
    const truncated = full.length > MAX_MSG_LENGTH ? full.substring(0, MAX_MSG_LENGTH) + '…' : full;
    return redactPII(truncated);
  } catch {
    return '[serialization error]';
  }
}

function extractSource(msg: string): string | undefined {
  const match = msg.match(/^\[([A-Za-z0-9_ .-]+)\]/);
  return match ? match[1] : undefined;
}

function pushEntry(level: LogLevel, args: any[]): void {
  const msg = serializeArgs(args);
  const entry: CapturedEntry = {
    t: Date.now(),
    l: level,
    m: msg,
  };
  const source = extractSource(msg);
  if (source) entry.s = source;

  if (bufferCount < BUFFER_SIZE) {
    buffer.push(entry);
    bufferCount++;
  } else {
    buffer[bufferHead] = entry;
    bufferHead = (bufferHead + 1) % BUFFER_SIZE;
  }
}

function getEntries(): CapturedEntry[] {
  if (bufferCount < BUFFER_SIZE) {
    return buffer.slice();
  }
  return [
    ...buffer.slice(bufferHead),
    ...buffer.slice(0, bufferHead),
  ];
}

function collectPlatform(): PlatformInfo {
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const perf = (performance as any);
  const mem = perf?.memory;

  let audioCtxState: string | undefined;
  let audioCtxRate: number | undefined;
  try {
    const player = (window as any).__streamingAudioPlayer;
    if (player?.audioContext) {
      audioCtxState = player.audioContext.state;
      audioCtxRate = player.audioContext.sampleRate;
    }
  } catch { /* ignore */ }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    connectionType: conn?.effectiveType,
    connectionDownlink: conn?.downlink,
    memoryJsHeapUsed: mem?.usedJSHeapSize,
    memoryJsHeapTotal: mem?.totalJSHeapSize,
    audioContextState: audioCtxState,
    audioContextSampleRate: audioCtxRate,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    vendor: navigator.vendor || '',
  };
}

function canFlush(): boolean {
  const now = Date.now();
  if (now - flushHourStart > 3_600_000) {
    flushCountThisHour = 0;
    flushHourStart = now;
  }
  return flushCountThisHour < MAX_FLUSHES_PER_HOUR;
}

function doFlush(trigger: string): void {
  if (!canFlush()) return;
  if (bufferCount === 0) return;

  flushCountThisHour++;

  const entries = getEntries();

  const sendEntries = entries.length > 200 ? entries.slice(-200) : entries;

  const diagnosticWindows: Record<string, any> = {};
  try {
    const w = window as any;
    if (w._contentDedupStats) diagnosticWindows.contentDedup = w._contentDedupStats;
    if (w._dedupStats) diagnosticWindows.chunkDedup = {
      blocked: w._dedupStats.blocked,
      passed: w._dedupStats.passed,
      blockedKeys: w._dedupStats.blockedKeys?.slice?.(-10),
    };
    if (w._turnScheduleLog) diagnosticWindows.turnSchedule = {
      count: w._turnScheduleCount,
      entries: w._turnScheduleLog?.slice?.(-20),
    };
    if (w._chunkStats) diagnosticWindows.chunkStats = w._chunkStats;
  } catch { /* ignore */ }

  const payload = {
    trigger,
    timestamp: Date.now(),
    sessionMeta: currentSessionMeta,
    platform: collectPlatform(),
    diagnostics: Object.keys(diagnosticWindows).length > 0 ? diagnosticWindows : undefined,
    entries: sendEntries,
    totalCaptured: bufferCount,
  };

  fetch('/api/voice/console-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => { /* silently ignore network errors */ });
}

const PRE_SESSION_BUFFER_SIZE = 50;
let preSessionBuffer: CapturedEntry[] = [];

function makeInterceptor(level: LogLevel): (...args: any[]) => void {
  const original = originals[level];
  return function (...args: any[]) {
    original.apply(console, args);

    if (inVoiceSession) {
      pushEntry(level, args);
    } else {
      const msg = serializeArgs(args);
      const entry: CapturedEntry = { t: Date.now(), l: level, m: msg };
      const source = extractSource(msg);
      if (source) entry.s = source;
      if (preSessionBuffer.length >= PRE_SESSION_BUFFER_SIZE) {
        preSessionBuffer.shift();
      }
      preSessionBuffer.push(entry);
    }

    if (level === 'error' && inVoiceSession) {
      const now = Date.now();
      if (now - lastErrorFlush > ERROR_FLUSH_THROTTLE_MS) {
        lastErrorFlush = now;
        doFlush('error_during_session');
      }
    }
  };
}

export function installConsoleCapture(): void {
  if (installed) return;
  installed = true;
  flushHourStart = Date.now();

  console.log = makeInterceptor('log');
  console.warn = makeInterceptor('warn');
  console.error = makeInterceptor('error');
  console.debug = makeInterceptor('debug');
  console.info = makeInterceptor('info');

  window.addEventListener('unhandledrejection', (event) => {
    pushEntry('error', [`[UnhandledRejection] ${event.reason}`]);
    if (inVoiceSession) {
      const now = Date.now();
      if (now - lastErrorFlush > ERROR_FLUSH_THROTTLE_MS) {
        lastErrorFlush = now;
        doFlush('unhandled_rejection');
      }
    }
  });

  window.addEventListener('error', (event) => {
    pushEntry('error', [`[WindowError] ${event.message} at ${event.filename}:${event.lineno}`]);
  });
}

export function startSessionCapture(meta: SessionMeta): void {
  inVoiceSession = true;
  currentSessionMeta = meta;
  buffer = [];
  bufferHead = 0;
  bufferCount = 0;
  for (const entry of preSessionBuffer) {
    pushEntry(entry.l, [entry.m]);
  }
  preSessionBuffer = [];
}

export function endSessionCapture(): void {
  if (inVoiceSession) {
    doFlush('session_end');
  }
  inVoiceSession = false;
  currentSessionMeta = null;
}

export function flushConsoleCapture(trigger: string): void {
  doFlush(trigger);
}
