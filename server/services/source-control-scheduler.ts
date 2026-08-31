import { readFile, rm, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { SourceControlService, sourceControlEnabled } from './source-control-service';

export interface SourceControlSchedulerOptions {
  service?: SourceControlService;
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  pollMs?: number;
  wakePollMs?: number;
}

export class SourceControlScheduler {
  private readonly service: SourceControlService;
  private readonly env: NodeJS.ProcessEnv;
  private readonly pollMs: number;
  private readonly wakePollMs: number;
  private readonly wakePath: string;
  private pollTimer?: NodeJS.Timeout;
  private wakeTimer?: NodeJS.Timeout;
  private running = false;
  private stopped = true;
  private lastWakeMtimeMs = 0;

  constructor(options: SourceControlSchedulerOptions = {}) {
    const rootDir = options.rootDir || process.cwd();
    this.env = options.env || process.env;
    this.service = options.service || new SourceControlService({ rootDir, env: this.env });
    this.pollMs = options.pollMs || Number(this.env.SOURCE_CONTROL_POLL_MS || 300_000);
    this.wakePollMs = options.wakePollMs || Number(this.env.SOURCE_CONTROL_WAKE_POLL_MS || 5_000);
    const configuredWakePath = this.env.SOURCE_CONTROL_WAKE_FILE || '.local/source-control-wake';
    this.wakePath = isAbsolute(configuredWakePath)
      ? configuredWakePath
      : resolve(rootDir, configuredWakePath);
  }

  start(): boolean {
    if (!sourceControlEnabled(this.env) || this.env.SOURCE_CONTROL_SCHEDULER_ENABLED === 'false') {
      console.log('[SourceControl] Development scheduler disabled.');
      return false;
    }
    if (!this.stopped) return true;
    this.stopped = false;
    this.pollTimer = setInterval(() => void this.run('scheduler'), this.pollMs);
    this.wakeTimer = setInterval(() => void this.checkWakeFile(), this.wakePollMs);
    this.pollTimer.unref();
    this.wakeTimer.unref();
    void this.run('scheduler-startup');
    console.log(`[SourceControl] Scheduler started (${this.pollMs}ms interval).`);
    return true;
  }

  stop(): void {
    this.stopped = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.wakeTimer) clearInterval(this.wakeTimer);
    this.pollTimer = undefined;
    this.wakeTimer = undefined;
  }

  wake(actor = 'post-merge'): void {
    if (this.stopped) return;
    void this.run(actor);
  }

  private async checkWakeFile(): Promise<void> {
    if (this.stopped) return;
    try {
      const metadata = await stat(this.wakePath);
      if (metadata.mtimeMs <= this.lastWakeMtimeMs) return;
      this.lastWakeMtimeMs = metadata.mtimeMs;
      let actor = 'post-merge';
      try {
        const requested = (await readFile(this.wakePath, 'utf8')).trim();
        if (/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(requested)) actor = requested;
      } catch {
        // Default attribution is explicit when the wake payload is unreadable.
      }
      await rm(this.wakePath, { force: true });
      this.wake(actor);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.warn('[SourceControl] Wake-file check failed:', error?.message || error);
      }
    }
  }

  private async run(actor: string): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const result = await this.service.sync(actor);
      if (!result.ok && result.state !== 'dirty' && result.state !== 'retrying') {
        console.warn(`[SourceControl] ${actor} sync ended in ${result.state}: ${result.error || 'unknown error'}`);
      }
    } catch (error: any) {
      console.error('[SourceControl] Scheduler run failed:', error?.message || error);
    } finally {
      this.running = false;
    }
  }
}

let scheduler: SourceControlScheduler | undefined;

export function startSourceControlScheduler(): SourceControlScheduler {
  scheduler ||= new SourceControlScheduler();
  scheduler.start();
  return scheduler;
}

export function stopSourceControlScheduler(): void {
  scheduler?.stop();
}