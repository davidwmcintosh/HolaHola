/**
 * Context Sync Service
 *
 * Syncs key context sources to Daniela's neural network (tool_knowledge table):
 * - Build changelog (docs/what-shipped.md) → shipped_feature entries
 * - Active roadmap/sprints → roadmap_item entries
 * - replit.md architectural baseline → architecture_baseline entries
 * - North Star principles → north_star_principle entries
 *
 * Also provides on-demand refresh of all neural network context.
 * Formerly beacon-sync-service.ts — beacon loop retired July 2026.
 */

import { getSharedDb } from '../db';
import {
  toolKnowledge,
  northStarPrinciples,
  conversationMemories,
} from '@shared/schema';
import { eq, or, ilike } from 'drizzle-orm';
import { storage } from '../storage';
import * as fs from 'fs';
import * as path from 'path';
import { generateAndStoreEmbedding } from './semantic-memory-service';

// Matches MEMORY_TYPE_KNOWLEDGE in daniela-tool-indexer.ts
const TOOL_KNOWLEDGE_EMBED_TYPE = 'tool_knowledge';

/** Format a North Star tool_knowledge row for embedding — mirrors formatKnowledgeRowForEmbedding. */
function formatNorthStarRowForEmbedding(
  toolName: string,
  purpose: string,
  syntax: string,
  bestUsedFor: string[] | null,
): string {
  const lines = [
    `TOOL: ${toolName}`,
    `TYPE: north_star_principle`,
    `PURPOSE: ${purpose}`,
    `SYNTAX: ${syntax}`,
  ];
  if (bestUsedFor && bestUsedFor.length > 0) {
    lines.push(`BEST USED FOR: ${bestUsedFor.join(', ')}`);
  }
  return lines.join('\n');
}

class ContextSyncService {

  // ============================================================================
  // CHANGELOG (What Shipped — docs/what-shipped.md)
  // ============================================================================

  /**
   * Read the build changelog from docs/what-shipped.md.
   * Covers all shipped features. Used for Daniela and Wren context awareness.
   */
  getWhatShippedFromChangelog(): string {
    try {
      const changelogPath = path.join(process.cwd(), 'docs', 'what-shipped.md');

      if (!fs.existsSync(changelogPath)) {
        return '';
      }

      const content = fs.readFileSync(changelogPath, 'utf-8');
      const lines = content.split('\n');
      const recentEntries: string[] = [];
      let inRecentSection = false;
      let sectionsFound = 0;
      const maxSections = 3;

      for (const line of lines) {
        if (line.startsWith('# What Shipped') || line.startsWith('This file is') ||
            line.startsWith('Update this file') || line.startsWith('Format:') ||
            line.trim() === '---') {
          continue;
        }

        if (line.startsWith('## ')) {
          if (sectionsFound >= maxSections) break;
          sectionsFound++;
          inRecentSection = true;
          recentEntries.push('');
          recentEntries.push(line.replace('## ', '📅 '));
        } else if (inRecentSection && line.startsWith('- ')) {
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
        'These are ALL recent changes to the system.',
        ''
      ].join('\n');

    } catch (error) {
      console.error('[ContextSync] Error reading changelog:', error);
      return '';
    }
  }

  async getFullWhatShippedForDaniela(): Promise<string> {
    return this.getWhatShippedFromChangelog();
  }

  async getFullWhatShippedForEditor(): Promise<string> {
    const changelog = this.getWhatShippedFromChangelog();
    return [
      changelog,
      '',
      'Update docs/what-shipped.md after every build to keep Daniela and the team aware.'
    ].join('\n');
  }

  /**
   * Sync changelog entries to the neural network as tool_knowledge entries.
   * Call this on startup or after updating docs/what-shipped.md.
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
        console.log('[ContextSync] No changelog file found, skipping neural network sync');
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

      for (const entry of entries) {
        try {
          const toolName = `SHIPPED_${entry.date.replace(/[^a-zA-Z0-9]/g, '_')}_${entry.feature.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;

          const existing = await getSharedDb().select()
            .from(toolKnowledge)
            .where(eq(toolKnowledge.toolName, toolName))
            .limit(1);

          if (existing.length > 0) {
            result.skipped++;
            continue;
          }

          await getSharedDb().insert(toolKnowledge).values({
            toolName,
            toolType: 'shipped_feature',
            purpose: `[${entry.date}] ${entry.feature}`,
            syntax: 'Available capability - use naturally when relevant',
            examples: null,
            bestUsedFor: null,
            isActive: true,
          });

          result.synced++;
          console.log(`[ContextSync] Synced to neural network: ${entry.feature}`);

        } catch (err: any) {
          result.errors.push(`Failed to sync "${entry.feature}": ${err.message}`);
        }
      }

      console.log(`[ContextSync] Changelog sync complete: ${result.synced} synced, ${result.skipped} skipped`);
      return result;

    } catch (error: any) {
      console.error('[ContextSync] Error syncing changelog to neural network:', error);
      result.errors.push(error.message);
      return result;
    }
  }

  // ============================================================================
  // ROADMAP (Current Sprint Focus)
  // ============================================================================

  async getRoadmapForDaniela(): Promise<string> {
    try {
      const activeSprints = await storage.getFeatureSprints({ limit: 20 });

      const inProgress = activeSprints.filter(s => s.stage === 'in_progress');
      const planned = activeSprints.filter(s => s.stage === 'build_plan');
      const ideas = activeSprints.filter(s => s.stage === 'idea' || s.stage === 'pedagogy_spec');

      if (inProgress.length === 0 && planned.length === 0) {
        return '';
      }

      const lines: string[] = [
        '',
        '═══════════════════════════════════════════════════════════════════',
        '🗺️ CURRENT ROADMAP (What the Editor is Working On)',
        '═══════════════════════════════════════════════════════════════════',
        ''
      ];

      if (inProgress.length > 0) {
        lines.push('🔨 ACTIVELY BEING BUILT:');
        for (const sprint of inProgress) {
          lines.push(`   • ${sprint.title}`);
          if (sprint.description) {
            lines.push(`     └─ ${sprint.description.substring(0, 80)}`);
          }
        }
        lines.push('');
      }

      if (planned.length > 0) {
        lines.push('📋 PLANNED (Coming Soon):');
        for (const sprint of planned.slice(0, 5)) {
          const priorityEmoji = this.getSprintPriorityEmoji(sprint.priority);
          lines.push(`   ${priorityEmoji} ${sprint.title}`);
        }
        if (planned.length > 5) {
          lines.push(`   ... and ${planned.length - 5} more planned`);
        }
        lines.push('');
      }

      if (ideas.length > 0) {
        lines.push(`💡 BACKLOG: ${ideas.length} idea${ideas.length > 1 ? 's' : ''} being explored`);
        lines.push('');
      }

      lines.push('Use this roadmap to calibrate your suggestions and expectations.');
      lines.push('');

      return lines.join('\n');

    } catch (error) {
      console.error('[ContextSync] Error getting roadmap:', error);
      return '';
    }
  }

  private getSprintPriorityEmoji(priority: string | null): string {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Sync active sprints to neural network as tool_knowledge entries.
   * Call this on startup or when sprints are updated.
   */
  async syncRoadmapToNeuralNetwork(): Promise<{
    synced: number;
    skipped: number;
    cleaned: number;
    errors: string[];
  }> {
    const result = { synced: 0, skipped: 0, cleaned: 0, errors: [] as string[] };

    try {
      const activeSprints = await storage.getFeatureSprints({ limit: 50 });
      const activeSprintIds = new Set<string>();

      for (const sprint of activeSprints) {
        if (sprint.stage !== 'in_progress' && sprint.stage !== 'build_plan') {
          continue;
        }

        try {
          const toolName = `ROADMAP_${sprint.id.replace(/-/g, '_').toUpperCase()}`;
          activeSprintIds.add(toolName);

          const stageLabel = sprint.stage === 'in_progress' ? 'BUILDING NOW' : 'PLANNED';
          const priorityLabel = sprint.priority === 'critical' ? '🔴 CRITICAL' :
                               sprint.priority === 'high' ? '🟠 HIGH' :
                               sprint.priority === 'medium' ? '🟡 MEDIUM' : '🟢 LOW';

          const existing = await getSharedDb().select()
            .from(toolKnowledge)
            .where(eq(toolKnowledge.toolName, toolName))
            .limit(1);

          if (existing.length > 0) {
            const existingPurpose = existing[0].purpose || '';
            const newPurpose = `[${stageLabel}] ${priorityLabel} - ${sprint.title}${sprint.description ? `: ${sprint.description.substring(0, 100)}` : ''}`;

            if (existingPurpose !== newPurpose) {
              await getSharedDb().update(toolKnowledge)
                .set({ purpose: newPurpose })
                .where(eq(toolKnowledge.toolName, toolName));
              result.synced++;
            } else {
              result.skipped++;
            }
          } else {
            await getSharedDb().insert(toolKnowledge).values({
              toolName,
              toolType: 'roadmap_item',
              purpose: `[${stageLabel}] ${priorityLabel} - ${sprint.title}${sprint.description ? `: ${sprint.description.substring(0, 100)}` : ''}`,
              syntax: 'Current development work - reference when relevant',
              examples: null,
              bestUsedFor: null,
              isActive: true,
            });
            result.synced++;
            console.log(`[ContextSync] Synced roadmap item: ${sprint.title}`);
          }

        } catch (err: any) {
          result.errors.push(`Failed to sync "${sprint.title}": ${err.message}`);
        }
      }

      const allRoadmapItems = await getSharedDb().select()
        .from(toolKnowledge)
        .where(eq(toolKnowledge.toolType, 'roadmap_item'));

      for (const item of allRoadmapItems) {
        if (!activeSprintIds.has(item.toolName)) {
          await getSharedDb().delete(toolKnowledge).where(eq(toolKnowledge.id, item.id));
          result.cleaned++;
        }
      }

      console.log(`[ContextSync] Roadmap sync: ${result.synced} synced, ${result.skipped} unchanged, ${result.cleaned} cleaned`);
      return result;

    } catch (error: any) {
      console.error('[ContextSync] Error syncing roadmap:', error);
      result.errors.push(error.message);
      return result;
    }
  }

  // ============================================================================
  // ARCHITECTURAL BASELINE (replit.md)
  // ============================================================================

  /**
   * Sync replit.md sections to neural network as architecture_baseline entries.
   * Call this on startup to keep Wren's architectural memory current.
   */
  async syncReplitMdToNeuralNetwork(): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { synced: 0, skipped: 0, errors: [] as string[] };

    try {
      const replitMdPath = path.join(process.cwd(), 'replit.md');

      if (!fs.existsSync(replitMdPath)) {
        console.log('[ContextSync] No replit.md found, skipping architectural sync');
        return result;
      }

      const content = fs.readFileSync(replitMdPath, 'utf-8');
      const sections: { name: string; content: string }[] = [];

      const overviewMatch = content.match(/## Overview\n([\s\S]*?)(?=\n## )/);
      if (overviewMatch) {
        sections.push({ name: 'OVERVIEW', content: overviewMatch[1].trim() });
      }

      const archMatch = content.match(/## System Architecture\n([\s\S]*?)(?=\n## )/);
      if (archMatch) {
        sections.push({ name: 'SYSTEM_ARCHITECTURE', content: archMatch[1].trim() });
      }

      const depsMatch = content.match(/## External Dependencies\n([\s\S]*?)$/);
      if (depsMatch) {
        sections.push({ name: 'EXTERNAL_DEPENDENCIES', content: depsMatch[1].trim() });
      }

      for (const section of sections) {
        try {
          const toolName = `ARCH_BASELINE_${section.name}`;

          const existing = await getSharedDb().select()
            .from(toolKnowledge)
            .where(eq(toolKnowledge.toolName, toolName))
            .limit(1);

          const maxLength = section.name === 'SYSTEM_ARCHITECTURE' ? 3000 : 1500;
          const truncatedContent = section.content.substring(0, maxLength);

          if (existing.length > 0) {
            if (existing[0].purpose !== truncatedContent) {
              await getSharedDb().update(toolKnowledge)
                .set({
                  purpose: truncatedContent,
                  syntax: `Architectural baseline from replit.md - ${section.name.replace(/_/g, ' ')}`
                })
                .where(eq(toolKnowledge.toolName, toolName));
              result.synced++;
              console.log(`[ContextSync] Updated architectural baseline: ${section.name}`);
            } else {
              result.skipped++;
            }
          } else {
            await getSharedDb().insert(toolKnowledge).values({
              toolName,
              toolType: 'architecture_baseline',
              purpose: truncatedContent,
              syntax: `Architectural baseline from replit.md - ${section.name.replace(/_/g, ' ')}`,
              examples: null,
              bestUsedFor: ['architectural_context', 'wren_memory'],
              avoidWhen: null,
              combinesWith: null,
              sequencePatterns: null,
              isActive: true
            });
            result.synced++;
            console.log(`[ContextSync] Created architectural baseline: ${section.name}`);
          }
        } catch (sectionError: any) {
          result.errors.push(`${section.name}: ${sectionError.message}`);
        }
      }

      console.log(`[ContextSync] Architectural baseline sync: ${result.synced} synced, ${result.skipped} unchanged`);
    } catch (error: any) {
      console.error('[ContextSync] Failed to sync replit.md:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  // ============================================================================
  // NORTH STAR (Constitutional Foundation)
  // ============================================================================

  /**
   * Sync North Star principles from database to neural network.
   * Gives Wren and Daniela access to the constitutional foundation.
   * Call this on startup.
   */
  async syncNorthStarToNeuralNetwork(): Promise<{
    synced: number;
    skipped: number;
    errors: string[];
  }> {
    const result = { synced: 0, skipped: 0, errors: [] as string[] };

    try {
      const principles = await getSharedDb().select()
        .from(northStarPrinciples)
        .where(eq(northStarPrinciples.isActive, true))
        .orderBy(northStarPrinciples.category, northStarPrinciples.orderIndex);

      if (principles.length === 0) {
        console.log('[ContextSync] No North Star principles found, skipping sync');
        return result;
      }

      console.log(`[ContextSync] Syncing ${principles.length} North Star principles to neural network...`);

      for (const principle of principles) {
        try {
          const categoryUpper = principle.category.toUpperCase();
          const toolName = `NORTH_STAR_${categoryUpper}_${principle.orderIndex}`;

          const existing = await getSharedDb()
            .select({ id: toolKnowledge.id, purpose: toolKnowledge.purpose, syntax: toolKnowledge.syntax, bestUsedFor: toolKnowledge.bestUsedFor })
            .from(toolKnowledge)
            .where(eq(toolKnowledge.toolName, toolName))
            .limit(1);

          const purposeContent = principle.principle;

          // Query conversation_memories stubs associated with this principle.
          // Mirrors exportNorthStar's lookup so the neural-net embedding carries
          // the linkage signal and Daniela can surface archives via reach_north_star.
          let associatedMemoryLine: string | null = null;
          if (principle.principleTitle) {
            try {
              const searchTerm = principle.principleTitle;
              const memoryStubs = await getSharedDb()
                .select({ id: conversationMemories.id, title: conversationMemories.title })
                .from(conversationMemories)
                .where(
                  or(
                    eq(conversationMemories.arcName, searchTerm),
                    ilike(conversationMemories.title, `%${searchTerm}%`),
                  )
                )
                .limit(5);
              if (memoryStubs.length > 0) {
                const stubList = memoryStubs
                  .map((m) => `${m.id}${m.title ? ` (${m.title})` : ''}`)
                  .join(', ');
                associatedMemoryLine = `Related Archives: ${stubList}`;
              }
            } catch {
              // Non-fatal: stubs are an enrichment, not required
            }
          }

          const syntaxContent = [
            `Category: ${principle.category}`,
            principle.principleTitle ? `Title: ${principle.principleTitle}` : null,
            principle.confidenceScore !== null && principle.confidenceScore !== undefined
              ? `Maturity: ${principle.confidenceScore} (10 = current; lower = superseded but still valid, kept for audit)`
              : null,
            principle.supersededBy ? `Superseded by: ${principle.supersededBy}` : null,
            principle.originalContext ? `Context: ${principle.originalContext}` : null,
            associatedMemoryLine,
          ].filter(Boolean).join('\n');

          const bestUsedFor = ['north_star', 'constitutional_foundation', principle.category];

          if (existing.length > 0) {
            const rowId = existing[0].id;
            if (existing[0].purpose !== purposeContent || existing[0].syntax !== syntaxContent) {
              await getSharedDb().update(toolKnowledge)
                .set({ purpose: purposeContent, syntax: syntaxContent })
                .where(eq(toolKnowledge.toolName, toolName));
              result.synced++;
            } else {
              result.skipped++;
            }
            // Always call generateAndStoreEmbedding — it is content-hash based and
            // will update the embedding only when the formatted text has changed
            // (e.g. a new Related Archives line was added).  Existing-but-fresh
            // embeddings are skipped in O(1) via hash comparison.
            try {
              const embedText = formatNorthStarRowForEmbedding(toolName, purposeContent, syntaxContent, existing[0].bestUsedFor as string[] | null ?? bestUsedFor);
              await generateAndStoreEmbedding(TOOL_KNOWLEDGE_EMBED_TYPE, rowId, null, embedText, 1.0);
            } catch (embedErr: any) {
              console.warn(`[ContextSync] Embedding update failed for ${toolName}:`, embedErr.message);
            }
          } else {
            const [inserted] = await getSharedDb().insert(toolKnowledge).values({
              toolName,
              toolType: 'north_star_principle',
              purpose: purposeContent,
              syntax: syntaxContent,
              examples: null,
              bestUsedFor,
              avoidWhen: null,
              combinesWith: null,
              sequencePatterns: null,
              isActive: true
            }).returning({ id: toolKnowledge.id });
            result.synced++;
            // Embed the freshly inserted row immediately.
            if (inserted?.id) {
              try {
                const embedText = formatNorthStarRowForEmbedding(toolName, purposeContent, syntaxContent, bestUsedFor);
                await generateAndStoreEmbedding(TOOL_KNOWLEDGE_EMBED_TYPE, inserted.id, null, embedText, 1.0);
              } catch (embedErr: any) {
                console.warn(`[ContextSync] Embedding insert failed for ${toolName}:`, embedErr.message);
              }
            }
          }
        } catch (principleError: any) {
          result.errors.push(`${principle.category}_${principle.orderIndex}: ${principleError.message}`);
        }
      }

      console.log(`[ContextSync] North Star sync: ${result.synced} synced, ${result.skipped} unchanged`);
    } catch (error: any) {
      console.error('[ContextSync] Failed to sync North Star principles:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  // ============================================================================
  // DEBOUNCED NORTH STAR RESYNC
  // ============================================================================

  /** Pending debounce timer for scheduleNorthStarResync(). */
  private _northStarResyncTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Schedule a syncNorthStarToNeuralNetwork() call, debounced by `delayMs`
   * (default 5 000 ms).  Any call while a timer is already pending cancels
   * the old timer so that a burst of N memory inserts collapses into a
   * single scan that fires after the last insert settles.
   */
  scheduleNorthStarResync(delayMs = 5000): void {
    if (this._northStarResyncTimer !== null) {
      clearTimeout(this._northStarResyncTimer);
    }
    this._northStarResyncTimer = setTimeout(() => {
      this._northStarResyncTimer = null;
      this.syncNorthStarToNeuralNetwork()
        .catch((err: Error) =>
          console.warn('[ContextSync] Scheduled North Star re-sync failed:', err.message)
        );
    }, delayMs);
  }

  // ON-DEMAND REFRESH
  // ============================================================================

  /**
   * Refresh all neural network context mid-session.
   * Call when replit.md or North Star principles have changed,
   * or when you want Wren/Daniela to pick up new context immediately.
   */
  async refreshNeuralNetworkContext(): Promise<{
    success: boolean;
    fileCacheRefreshed: boolean;
    dbSynced: { replitMd: number; northStar: number };
    toolCacheRefreshed: boolean;
    errors: string[];
  }> {
    const result = {
      success: true,
      fileCacheRefreshed: false,
      dbSynced: { replitMd: 0, northStar: 0 },
      toolCacheRefreshed: false,
      errors: [] as string[]
    };

    console.log('[ContextSync] Starting neural network context refresh...');

    try {
      const { refreshReplitMdCache } = await import('./hive-consciousness-service');
      const cacheResult = await refreshReplitMdCache();
      result.fileCacheRefreshed = cacheResult.success;
      if (!cacheResult.success) {
        result.errors.push(`File cache: ${cacheResult.message}`);
      }
    } catch (error: any) {
      result.errors.push(`File cache error: ${error.message}`);
    }

    try {
      const replitMdResult = await this.syncReplitMdToNeuralNetwork();
      result.dbSynced.replitMd = replitMdResult.synced;
      if (replitMdResult.errors.length > 0) {
        result.errors.push(...replitMdResult.errors.map(e => `replit.md: ${e}`));
      }
    } catch (error: any) {
      result.errors.push(`replit.md sync error: ${error.message}`);
    }

    try {
      const northStarResult = await this.syncNorthStarToNeuralNetwork();
      result.dbSynced.northStar = northStarResult.synced;
      if (northStarResult.errors.length > 0) {
        result.errors.push(...northStarResult.errors.map(e => `North Star: ${e}`));
      }
    } catch (error: any) {
      result.errors.push(`North Star sync error: ${error.message}`);
    }

    try {
      const { refreshToolKnowledgeCache } = await import('./procedural-memory-retrieval');
      await refreshToolKnowledgeCache();
      result.toolCacheRefreshed = true;
    } catch (error: any) {
      result.errors.push(`Tool cache error: ${error.message}`);
    }

    result.success = result.errors.length === 0;

    console.log(`[ContextSync] Neural network refresh complete:`, {
      fileCacheRefreshed: result.fileCacheRefreshed,
      replitMdSynced: result.dbSynced.replitMd,
      northStarSynced: result.dbSynced.northStar,
      toolCacheRefreshed: result.toolCacheRefreshed,
      errors: result.errors.length
    });

    return result;
  }
}

export const contextSyncService = new ContextSyncService();

export const beaconSyncService = contextSyncService;
