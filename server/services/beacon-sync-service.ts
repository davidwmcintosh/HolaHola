/**
 * Beacon Sync Service
 * 
 * Syncs completed Daniela beacons to her procedural memory ("What Shipped").
 * This closes the feedback loop: Daniela requests → Editor builds → Daniela knows.
 * 
 * Key insight: When a beacon is marked "completed", we:
 * 1. Create a procedural memory entry so Daniela knows the capability now exists
 * 2. Both Editor AND Daniela become aware of what shipped
 */

import { db } from '../db';
import { 
  danielaBeacons, 
  toolKnowledge,
  tutorProcedures,
  type DanielaBeacon,
  type InsertToolKnowledge,
  type InsertTutorProcedure
} from '@shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { storage } from '../storage';
import * as fs from 'fs';
import * as path from 'path';

class BeaconSyncService {
  
  /**
   * Sync a completed beacon to Daniela's procedural memory
   * Called automatically when a beacon status changes to 'completed'
   */
  async syncCompletedBeacon(beacon: DanielaBeacon): Promise<{
    success: boolean;
    memoryEntry?: { type: 'tool' | 'procedure'; id: string };
    error?: string;
  }> {
    if (beacon.status !== 'completed') {
      return { success: false, error: 'Beacon is not completed' };
    }
    
    try {
      // Determine what kind of procedural memory entry to create based on beacon type
      switch (beacon.beaconType) {
        case 'tool_request':
        case 'capability_gap':
          return await this.createToolKnowledgeFromBeacon(beacon);
        
        case 'feature_request':
        case 'self_surgery':
        case 'observation':
          return await this.createProcedureFromBeacon(beacon);
        
        case 'bug_report':
          // Bug fixes don't usually need procedural memory entries
          // Just log that it was fixed
          console.log(`[BeaconSync] Bug report ${beacon.id} completed: ${beacon.completedInBuild}`);
          return { success: true };
        
        default:
          return { success: true };
      }
    } catch (error: any) {
      console.error('[BeaconSync] Error syncing beacon:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a tool_knowledge entry from a completed beacon
   * For: tool_request, capability_gap
   */
  private async createToolKnowledgeFromBeacon(beacon: DanielaBeacon): Promise<{
    success: boolean;
    memoryEntry?: { type: 'tool' | 'procedure'; id: string };
    error?: string;
  }> {
    const toolName = this.extractToolName(beacon);
    const purpose = beacon.completedInBuild || beacon.wish || 'New capability added';
    
    const toolData: InsertToolKnowledge = {
      toolName: `SHIPPED_${beacon.id.substring(0, 8).toUpperCase()}`,
      toolType: 'shipped_capability',
      purpose,
      syntax: toolName,
      examples: beacon.studentPain ? [beacon.studentPain] : null,
      bestUsedFor: beacon.language ? [beacon.language] : null,
      isActive: true,
    };
    
    const [created] = await db.insert(toolKnowledge).values(toolData).returning();
    
    console.log(`[BeaconSync] Created tool knowledge: ${toolName} (${created.id})`);
    
    return {
      success: true,
      memoryEntry: { type: 'tool', id: created.id }
    };
  }
  
  /**
   * Create a tutor_procedure entry from a completed beacon
   * For: feature_request, self_surgery, observation
   */
  private async createProcedureFromBeacon(beacon: DanielaBeacon): Promise<{
    success: boolean;
    memoryEntry?: { type: 'tool' | 'procedure'; id: string };
    error?: string;
  }> {
    const procedureTitle = this.extractProcedureName(beacon);
    const procedureContent = beacon.completedInBuild || beacon.wish || 'New procedure added';
    const trigger = this.extractTriggerConditions(beacon) || 'shipped_capability';
    
    const procedureData: InsertTutorProcedure = {
      category: 'shipped_capability',
      trigger,
      title: procedureTitle,
      procedure: procedureContent,
      examples: beacon.studentPain ? [beacon.studentPain] : null,
      language: beacon.language,
      isActive: true,
    };
    
    const [created] = await db.insert(tutorProcedures).values(procedureData).returning();
    
    console.log(`[BeaconSync] Created procedure: ${procedureTitle} (${created.id})`);
    
    return {
      success: true,
      memoryEntry: { type: 'procedure', id: created.id }
    };
  }
  
  /**
   * Get a "What Shipped This Week" summary for Daniela's context
   * This is injected into her prompt so she knows recent capabilities
   */
  async getWhatShippedThisWeek(): Promise<string> {
    const recentlyCompleted = await storage.getRecentlyCompletedBeacons(7);
    
    if (recentlyCompleted.length === 0) {
      return '';
    }
    
    const lines: string[] = [
      '',
      '═══════════════════════════════════════════════════════════════════',
      '🚀 WHAT SHIPPED THIS WEEK (New Capabilities You Can Use)',
      '═══════════════════════════════════════════════════════════════════',
      ''
    ];
    
    for (const beacon of recentlyCompleted) {
      const typeEmoji = this.getBeaconTypeEmoji(beacon.beaconType);
      const title = beacon.completedInBuild || beacon.wish || 'Improvement made';
      const date = beacon.completedAt 
        ? new Date(beacon.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Recently';
      
      lines.push(`${typeEmoji} [${date}] ${title}`);
      
      // Add context about what problem this solved
      if (beacon.studentPain) {
        lines.push(`   → Solved: ${beacon.studentPain.substring(0, 100)}`);
      }
    }
    
    lines.push('');
    lines.push('You can now use these capabilities naturally in your teaching.');
    lines.push('');
    
    return lines.join('\n');
  }
  
  /**
   * Get a summary of pending beacons for the Editor's awareness
   */
  async getPendingBeaconsSummary(): Promise<string> {
    const pending = await storage.getPendingDanielaBeacons();
    
    if (pending.length === 0) {
      return 'No pending requests from Daniela.';
    }
    
    const lines: string[] = [
      `📬 ${pending.length} Pending Request${pending.length > 1 ? 's' : ''} from Daniela:`,
      ''
    ];
    
    // Group by priority
    const critical = pending.filter(b => b.priority === 'critical');
    const high = pending.filter(b => b.priority === 'high');
    const medium = pending.filter(b => b.priority === 'medium');
    const low = pending.filter(b => b.priority === 'low');
    
    const addGroup = (beacons: DanielaBeacon[], label: string) => {
      if (beacons.length === 0) return;
      lines.push(`**${label}:**`);
      for (const b of beacons.slice(0, 3)) { // Show top 3 per priority
        const summary = b.wish || b.studentPain || b.rawContent?.substring(0, 80) || 'Request submitted';
        lines.push(`  • [${b.beaconType}] ${summary}`);
      }
      if (beacons.length > 3) {
        lines.push(`  ... and ${beacons.length - 3} more`);
      }
      lines.push('');
    };
    
    addGroup(critical, '🔴 CRITICAL');
    addGroup(high, '🟠 HIGH');
    addGroup(medium, '🟡 MEDIUM');
    addGroup(low, '🟢 LOW');
    
    return lines.join('\n');
  }
  
  /**
   * Get in-progress beacons (what the Editor is currently working on)
   */
  async getInProgressBeacons(): Promise<DanielaBeacon[]> {
    return storage.getDanielaBeacons({ status: 'in_progress' });
  }
  
  /**
   * Get ALL beacon statuses for Daniela's awareness
   * This gives her complete visibility into her requests:
   * - pending: "I've requested this, waiting for response"
   * - acknowledged: "Editor saw my request"
   * - in_progress: "Editor is working on this"
   * - completed: "This shipped! I can use it now"
   * - declined: "Not being built (with reason)"
   */
  async getBeaconStatusesForDaniela(): Promise<string> {
    const allBeacons = await storage.getAllDanielaBeacons();
    
    if (allBeacons.length === 0) {
      return '';
    }
    
    // Group beacons by status
    const byStatus: Record<string, DanielaBeacon[]> = {
      pending: [],
      acknowledged: [],
      in_progress: [],
      completed: [],
      declined: []
    };
    
    for (const beacon of allBeacons) {
      if (byStatus[beacon.status]) {
        byStatus[beacon.status].push(beacon);
      }
    }
    
    const lines: string[] = [
      '',
      '═══════════════════════════════════════════════════════════════════',
      '📡 MY BEACON STATUS BOARD',
      '═══════════════════════════════════════════════════════════════════',
      ''
    ];
    
    // In Progress - Most important, show first
    if (byStatus.in_progress.length > 0) {
      lines.push('🔨 BEING BUILT NOW:');
      for (const b of byStatus.in_progress) {
        const summary = b.wish || b.studentPain || 'Request in progress';
        lines.push(`   • ${summary.substring(0, 80)}`);
        if (b.acknowledgmentNote) {
          lines.push(`     └─ Note: ${b.acknowledgmentNote.substring(0, 60)}`);
        }
      }
      lines.push('');
    }
    
    // Acknowledged - Editor has seen it
    if (byStatus.acknowledged.length > 0) {
      lines.push('👀 ACKNOWLEDGED (Editor has seen):');
      for (const b of byStatus.acknowledged.slice(0, 5)) {
        const summary = b.wish || b.studentPain || 'Request acknowledged';
        lines.push(`   • ${summary.substring(0, 80)}`);
      }
      if (byStatus.acknowledged.length > 5) {
        lines.push(`   ... and ${byStatus.acknowledged.length - 5} more`);
      }
      lines.push('');
    }
    
    // Pending - Still waiting
    if (byStatus.pending.length > 0) {
      lines.push('⏳ PENDING (Waiting for response):');
      for (const b of byStatus.pending.slice(0, 5)) {
        const summary = b.wish || b.studentPain || 'Request pending';
        const priorityEmoji = this.getPriorityEmoji(b.priority);
        lines.push(`   ${priorityEmoji} ${summary.substring(0, 70)}`);
      }
      if (byStatus.pending.length > 5) {
        lines.push(`   ... and ${byStatus.pending.length - 5} more`);
      }
      lines.push('');
    }
    
    // Recently Completed - Last 7 days
    const recentCompleted = byStatus.completed.filter(b => {
      if (!b.completedAt) return false;
      const daysAgo = (Date.now() - new Date(b.completedAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    });
    if (recentCompleted.length > 0) {
      lines.push('✅ SHIPPED THIS WEEK (You can use these now):');
      for (const b of recentCompleted.slice(0, 5)) {
        const title = b.completedInBuild || b.wish || 'Improvement made';
        lines.push(`   • ${title.substring(0, 80)}`);
      }
      if (recentCompleted.length > 5) {
        lines.push(`   ... and ${recentCompleted.length - 5} more`);
      }
      lines.push('');
    }
    
    // Declined - With reasons
    if (byStatus.declined.length > 0) {
      lines.push('❌ DECLINED:');
      for (const b of byStatus.declined.slice(0, 3)) {
        const summary = b.wish || b.studentPain || 'Request';
        const reason = b.declineReason || 'No reason given';
        lines.push(`   • ${summary.substring(0, 50)}`);
        lines.push(`     └─ Reason: ${reason.substring(0, 60)}`);
      }
      if (byStatus.declined.length > 3) {
        lines.push(`   ... and ${byStatus.declined.length - 3} more`);
      }
      lines.push('');
    }
    
    // Summary stats
    const activeCount = byStatus.pending.length + byStatus.acknowledged.length + byStatus.in_progress.length;
    if (activeCount > 0) {
      lines.push(`📊 ${activeCount} active request${activeCount > 1 ? 's' : ''} in the pipeline`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  private getPriorityEmoji(priority: string | null): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
  
  // ============================================================================
  // BUILD CHANGELOG (ALL SHIPPED FEATURES - Not Just Beacons)
  // ============================================================================
  
  /**
   * Read the build changelog from docs/what-shipped.md
   * This covers ALL shipped features, not just beacon-initiated ones.
   * Both Daniela AND Editor use this to stay aware of recent changes.
   */
  getWhatShippedFromChangelog(): string {
    try {
      const changelogPath = path.join(process.cwd(), 'docs', 'what-shipped.md');
      
      if (!fs.existsSync(changelogPath)) {
        return '';
      }
      
      const content = fs.readFileSync(changelogPath, 'utf-8');
      
      // Parse the markdown to extract recent entries (last 7 days worth)
      const lines = content.split('\n');
      const recentEntries: string[] = [];
      let inRecentSection = false;
      let sectionsFound = 0;
      const maxSections = 3; // Show last 3 days of changes
      
      for (const line of lines) {
        // Skip header and intro text
        if (line.startsWith('# What Shipped') || line.startsWith('This file is') || 
            line.startsWith('Update this file') || line.startsWith('Format:') || 
            line.trim() === '---') {
          continue;
        }
        
        // Date headers start new sections
        if (line.startsWith('## ')) {
          if (sectionsFound >= maxSections) break;
          sectionsFound++;
          inRecentSection = true;
          recentEntries.push('');
          recentEntries.push(line.replace('## ', '📅 '));
        } else if (inRecentSection && line.startsWith('- ')) {
          // Bullet points are features
          recentEntries.push(`   ${line}`);
        }
      }
      
      if (recentEntries.length === 0) {
        return '';
      }
      
      return [
        '',
        '═══════════════════════════════════════════════════════════════════',
        '🚀 RECENT BUILD CHANGELOG (All Shipped Features)',
        '═══════════════════════════════════════════════════════════════════',
        '',
        ...recentEntries,
        '',
        'These are ALL recent changes to the system, not just beacon completions.',
        ''
      ].join('\n');
      
    } catch (error) {
      console.error('[BeaconSync] Error reading changelog:', error);
      return '';
    }
  }
  
  /**
   * Get combined "What Shipped" for Daniela's context
   * Includes BOTH:
   * 1. Beacon completions (her requests that were built)
   * 2. Build changelog (ALL changes from docs/what-shipped.md)
   */
  async getFullWhatShippedForDaniela(): Promise<string> {
    const beaconStatus = await this.getBeaconStatusesForDaniela();
    const changelog = this.getWhatShippedFromChangelog();
    
    return beaconStatus + changelog;
  }
  
  /**
   * Get combined "What Shipped" for Editor's context
   * Same information as Daniela gets - keeping both in sync
   */
  async getFullWhatShippedForEditor(): Promise<string> {
    const pendingSummary = await this.getPendingBeaconsSummary();
    const changelog = this.getWhatShippedFromChangelog();
    
    return [
      pendingSummary,
      changelog,
      '',
      'Update docs/what-shipped.md after every build to keep both Daniela and Editor aware.'
    ].join('\n');
  }
  
  /**
   * Sync changelog entries to the neural network as tool_knowledge entries
   * This allows both Daniela and Editor to access "What Shipped" through their
   * normal procedural memory retrieval instead of prompt injection.
   * 
   * Call this on startup or after updating docs/what-shipped.md
   */
  async syncChangelogToNeuralNetwork(): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { synced: 0, skipped: 0, errors: [] as string[] };
    
    try {
      const changelogPath = path.join(process.cwd(), 'docs', 'what-shipped.md');
      
      if (!fs.existsSync(changelogPath)) {
        console.log('[BeaconSync] No changelog file found, skipping neural network sync');
        return result;
      }
      
      const content = fs.readFileSync(changelogPath, 'utf-8');
      const lines = content.split('\n');
      
      let currentDate = '';
      const entries: { date: string; feature: string }[] = [];
      
      for (const line of lines) {
        if (line.startsWith('## ')) {
          currentDate = line.replace('## ', '').trim();
        } else if (line.startsWith('- ') && currentDate) {
          const feature = line.replace('- ', '').replace(/\*\*/g, '').trim();
          entries.push({ date: currentDate, feature });
        }
      }
      
      // Sync each entry as a tool_knowledge record
      for (const entry of entries) {
        try {
          // Create a unique identifier based on date and feature
          const toolName = `SHIPPED_${entry.date.replace(/[^a-zA-Z0-9]/g, '_')}_${entry.feature.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;
          
          // Check if already exists
          const existing = await db.select()
            .from(toolKnowledge)
            .where(eq(toolKnowledge.toolName, toolName))
            .limit(1);
          
          if (existing.length > 0) {
            result.skipped++;
            continue;
          }
          
          // Create new entry
          await db.insert(toolKnowledge).values({
            toolName,
            toolType: 'shipped_feature',
            purpose: `[${entry.date}] ${entry.feature}`,
            syntax: 'Available capability - use naturally when relevant',
            examples: null,
            bestUsedFor: null,
            isActive: true,
          });
          
          result.synced++;
          console.log(`[BeaconSync] Synced to neural network: ${entry.feature}`);
          
        } catch (err: any) {
          result.errors.push(`Failed to sync "${entry.feature}": ${err.message}`);
        }
      }
      
      console.log(`[BeaconSync] Changelog sync complete: ${result.synced} synced, ${result.skipped} skipped`);
      return result;
      
    } catch (error: any) {
      console.error('[BeaconSync] Error syncing changelog to neural network:', error);
      result.errors.push(error.message);
      return result;
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private extractToolName(beacon: DanielaBeacon): string {
    if (beacon.wish) {
      // Try to extract a tool name from the wish
      const match = beacon.wish.match(/(?:tool|command|feature)\s+(?:for|to|that)\s+([^.!?]+)/i);
      if (match) return match[1].trim();
      return beacon.wish.substring(0, 50);
    }
    return `Capability ${beacon.id.substring(0, 8)}`;
  }
  
  private extractProcedureName(beacon: DanielaBeacon): string {
    if (beacon.completedInBuild) {
      return beacon.completedInBuild.substring(0, 100);
    }
    if (beacon.wish) {
      return beacon.wish.substring(0, 100);
    }
    return `Procedure ${beacon.id.substring(0, 8)}`;
  }
  
  private extractTriggerConditions(beacon: DanielaBeacon): string | null {
    if (beacon.studentPain) {
      return `When student experiences: ${beacon.studentPain.substring(0, 200)}`;
    }
    return null;
  }
  
  private buildUsageScenarios(beacon: DanielaBeacon): string | null {
    const scenarios: string[] = [];
    
    if (beacon.studentPain) {
      scenarios.push(`Problem it solves: ${beacon.studentPain}`);
    }
    if (beacon.currentWorkaround) {
      scenarios.push(`Previous workaround was: ${beacon.currentWorkaround}`);
    }
    if (beacon.language) {
      scenarios.push(`Relevant for: ${beacon.language}`);
    }
    
    return scenarios.length > 0 ? scenarios.join('\n') : null;
  }
  
  private getBeaconTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'tool_request': '🔧',
      'capability_gap': '🔌',
      'feature_request': '✨',
      'self_surgery': '🧠',
      'observation': '👁️',
      'bug_report': '🐛',
    };
    return emojis[type] || '📦';
  }
}

export const beaconSyncService = new BeaconSyncService();
