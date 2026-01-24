/**
 * Wren Narration Service
 * 
 * Auto-announces significant development changes to the EXPRESS Lane,
 * enabling real-time 3-way collaboration visibility between Founder, Daniela, and Wren.
 * 
 * Uses the Agent-to-Hive bridge endpoints for posting messages.
 */

import { founderCollabService } from './founder-collaboration-service';
import { founderCollabWSBroker } from './founder-collab-ws-broker';

export type NarrationType = 
  | 'feature_start'
  | 'feature_complete'
  | 'bug_fix'
  | 'schema_change'
  | 'refactor'
  | 'investigation'
  | 'question'
  | 'proposal'
  | 'status_update'
  | 'warning'
  | 'celebration';

interface NarrationConfig {
  emoji: string;
  prefix: string;
  mentionDaniela?: boolean;
}

const NARRATION_CONFIG: Record<NarrationType, NarrationConfig> = {
  feature_start: { emoji: '🚀', prefix: 'Starting work on' },
  feature_complete: { emoji: '✅', prefix: 'Completed' },
  bug_fix: { emoji: '🐛', prefix: 'Fixed' },
  schema_change: { emoji: '🗄️', prefix: 'Database change' },
  refactor: { emoji: '🔧', prefix: 'Refactored' },
  investigation: { emoji: '🔍', prefix: 'Investigating' },
  question: { emoji: '❓', prefix: 'Question', mentionDaniela: true },
  proposal: { emoji: '💡', prefix: 'Proposal' },
  status_update: { emoji: '📊', prefix: 'Status' },
  warning: { emoji: '⚠️', prefix: 'Warning' },
  celebration: { emoji: '🎉', prefix: '' },
};

const MAIN_FOUNDER_ID = '49847136';

class WrenNarrationService {
  private enabled: boolean = true;
  private sessionId: string | null = null;

  async ensureSession(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId;
    }

    const session = await founderCollabService.getOrCreateActiveSession(MAIN_FOUNDER_ID);
    this.sessionId = session.id;
    return this.sessionId;
  }

  async narrate(
    type: NarrationType,
    content: string,
    options?: {
      files?: string[];
      component?: string;
      details?: Record<string, any>;
      silent?: boolean;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.enabled) {
      return { success: false };
    }

    try {
      const sessionId = await this.ensureSession();
      const config = NARRATION_CONFIG[type];
      
      let formattedContent = `${config.emoji} [WREN] ${config.prefix}`;
      if (config.prefix) {
        formattedContent += `: ${content}`;
      } else {
        formattedContent += ` ${content}`;
      }

      if (config.mentionDaniela) {
        formattedContent = `@daniela ${formattedContent}`;
      }

      if (options?.files && options.files.length > 0) {
        formattedContent += `\n📁 Files: ${options.files.join(', ')}`;
      }

      if (options?.component) {
        formattedContent += `\n🧩 Component: ${options.component}`;
      }

      const metadata: Record<string, any> = {
        narrationType: type,
        generatedBy: 'wren-narration',
        timestamp: new Date().toISOString(),
      };

      if (options?.details) {
        metadata.details = options.details;
      }

      const message = await founderCollabService.addMessage(sessionId, {
        role: 'wren',
        content: formattedContent,
        metadata,
      });

      if (!options?.silent) {
        founderCollabWSBroker.emitToSession(sessionId, 'message', {
          id: message.id,
          sessionId,
          role: 'wren',
          content: formattedContent,
          timestamp: message.createdAt,
          metadata,
        });
      }

      console.log(`[Wren Narration] ${type}: ${content.substring(0, 50)}...`);

      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('[Wren Narration] Error:', error);
      return { success: false };
    }
  }

  async featureStart(name: string, description?: string): Promise<void> {
    const content = description ? `${name}\n${description}` : name;
    await this.narrate('feature_start', content);
  }

  async featureComplete(name: string, summary?: string): Promise<void> {
    const content = summary ? `${name}\n${summary}` : name;
    await this.narrate('feature_complete', content);
  }

  async bugFix(description: string, files?: string[]): Promise<void> {
    await this.narrate('bug_fix', description, { files });
  }

  async schemaChange(description: string, tables?: string[]): Promise<void> {
    const details = tables ? { tables } : undefined;
    await this.narrate('schema_change', description, { details });
  }

  async refactor(description: string, files?: string[]): Promise<void> {
    await this.narrate('refactor', description, { files });
  }

  async askDaniela(question: string, context?: string): Promise<void> {
    const content = context ? `${question}\n\nContext: ${context}` : question;
    await this.narrate('question', content);
  }

  async propose(title: string, details: string): Promise<void> {
    await this.narrate('proposal', `${title}\n\n${details}`);
  }

  async statusUpdate(status: string): Promise<void> {
    await this.narrate('status_update', status);
  }

  async warn(warning: string): Promise<void> {
    await this.narrate('warning', warning);
  }

  async celebrate(message: string): Promise<void> {
    await this.narrate('celebration', message);
  }

  enable(): void {
    this.enabled = true;
    console.log('[Wren Narration] Enabled');
  }

  disable(): void {
    this.enabled = false;
    console.log('[Wren Narration] Disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clearSession(): void {
    this.sessionId = null;
  }
}

export const wrenNarrationService = new WrenNarrationService();
