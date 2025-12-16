/**
 * Wren Proactive Intelligence Service
 * 
 * Enables Wren to be more effective and proactive through:
 * 1. Proactive Triggers - Detect patterns and surface them automatically
 * 2. Daniela Feedback Loop - Learn if features actually helped teaching
 * 3. Architectural Decision Records - Capture reasoning behind decisions
 * 4. Priority Inference - Score and surface top priorities
 * 5. Project Health Awareness - Detect hot spots and technical debt
 */

import { db } from '../db';
import { 
  wrenProactiveTriggers, 
  architecturalDecisionRecords,
  danielaFeatureFeedback,
  projectHealthMetrics,
  danielaBeacons,
  wrenInsights,
  recurringStruggles,
  type WrenProactiveTrigger,
  type ArchitecturalDecisionRecord,
  type DanielaFeatureFeedback,
  type ProjectHealthMetric,
} from '@shared/schema';
import { eq, desc, sql, and, gte, lte, or, ilike, count, isNull, inArray } from 'drizzle-orm';

// Component mapping for health tracking
const COMPONENT_PATTERNS: Record<string, RegExp[]> = {
  'voice_pipeline': [/voice/i, /audio/i, /stt/i, /tts/i, /deepgram/i, /cartesia/i, /streaming/i],
  'auth': [/auth/i, /login/i, /session/i, /oidc/i, /passport/i],
  'billing': [/billing/i, /stripe/i, /subscription/i, /payment/i, /metering/i],
  'ai_tutor': [/tutor/i, /daniela/i, /gemini/i, /anthropic/i, /llm/i, /chat/i],
  'database': [/database/i, /drizzle/i, /postgres/i, /schema/i, /migration/i],
  'hive': [/hive/i, /beacon/i, /collaboration/i, /express.?lane/i, /founder/i],
  'curriculum': [/curriculum/i, /syllabus/i, /lesson/i, /exercise/i, /grammar/i],
  'ui': [/frontend/i, /component/i, /react/i, /page/i, /modal/i, /ui/i],
};

// Urgency thresholds
const URGENCY_THRESHOLDS = {
  critical: { occurrences: 10, withinDays: 1 },
  high: { occurrences: 5, withinDays: 3 },
  medium: { occurrences: 3, withinDays: 7 },
  low: { occurrences: 2, withinDays: 14 },
};

export class WrenProactiveIntelligenceService {
  
  // =========================================================================
  // 1. PROACTIVE TRIGGERS - Pattern detection and alerting
  // =========================================================================
  
  /**
   * Detect component from text/files
   */
  detectComponent(text: string, files?: string[]): string | null {
    const searchText = `${text} ${(files || []).join(' ')}`.toLowerCase();
    
    for (const [component, patterns] of Object.entries(COMPONENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(searchText)) {
          return component;
        }
      }
    }
    return null;
  }
  
  /**
   * Calculate urgency based on occurrence count and recency
   */
  calculateUrgency(occurrenceCount: number, firstOccurredAt: Date): 'low' | 'medium' | 'high' | 'critical' {
    const daysSinceFirst = (Date.now() - firstOccurredAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (occurrenceCount >= URGENCY_THRESHOLDS.critical.occurrences && daysSinceFirst <= URGENCY_THRESHOLDS.critical.withinDays) {
      return 'critical';
    }
    if (occurrenceCount >= URGENCY_THRESHOLDS.high.occurrences && daysSinceFirst <= URGENCY_THRESHOLDS.high.withinDays) {
      return 'high';
    }
    if (occurrenceCount >= URGENCY_THRESHOLDS.medium.occurrences && daysSinceFirst <= URGENCY_THRESHOLDS.medium.withinDays) {
      return 'medium';
    }
    return 'low';
  }
  
  /**
   * Create or update a proactive trigger
   */
  async createOrUpdateTrigger(params: {
    triggerType: string;
    title: string;
    description: string;
    evidence?: string;
    relatedComponent?: string;
    relatedFiles?: string[];
    relatedBeaconId?: string;
    suggestedAction?: string;
  }): Promise<WrenProactiveTrigger> {
    // Check for existing similar trigger
    const existing = await db
      .select()
      .from(wrenProactiveTriggers)
      .where(
        and(
          eq(wrenProactiveTriggers.triggerType, params.triggerType),
          ilike(wrenProactiveTriggers.title, `%${params.title.substring(0, 50)}%`),
          or(
            eq(wrenProactiveTriggers.status, 'pending'),
            eq(wrenProactiveTriggers.status, 'surfaced')
          )
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing trigger
      const trigger = existing[0];
      const newCount = (trigger.occurrenceCount || 1) + 1;
      const evidence = trigger.evidence as string[] || [];
      if (params.evidence) {
        evidence.push(params.evidence);
      }
      
      const newUrgency = this.calculateUrgency(newCount, trigger.firstOccurredAt!);
      
      const [updated] = await db
        .update(wrenProactiveTriggers)
        .set({
          occurrenceCount: newCount,
          lastOccurredAt: new Date(),
          urgency: newUrgency,
          evidence: evidence.slice(-10), // Keep last 10 pieces of evidence
          updatedAt: new Date(),
        })
        .where(eq(wrenProactiveTriggers.id, trigger.id))
        .returning();
      
      console.log(`[Wren Proactive] Updated trigger: ${params.title} (${newCount}x, urgency: ${newUrgency})`);
      return updated;
    }
    
    // Create new trigger
    const [created] = await db
      .insert(wrenProactiveTriggers)
      .values({
        triggerType: params.triggerType,
        title: params.title,
        description: params.description,
        evidence: params.evidence ? [params.evidence] : [],
        relatedComponent: params.relatedComponent || this.detectComponent(params.description, params.relatedFiles),
        relatedFiles: params.relatedFiles || [],
        relatedBeaconId: params.relatedBeaconId,
        suggestedAction: params.suggestedAction,
        urgency: 'low',
        status: 'pending',
      })
      .returning();
    
    console.log(`[Wren Proactive] Created trigger: ${params.title}`);
    return created;
  }
  
  /**
   * Get pending triggers for surfacing
   */
  async getPendingTriggers(limit: number = 10): Promise<WrenProactiveTrigger[]> {
    return db
      .select()
      .from(wrenProactiveTriggers)
      .where(eq(wrenProactiveTriggers.status, 'pending'))
      .orderBy(
        desc(sql`CASE ${wrenProactiveTriggers.urgency} WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`),
        desc(wrenProactiveTriggers.occurrenceCount)
      )
      .limit(limit);
  }
  
  /**
   * Surface triggers to founder (mark as surfaced)
   */
  async surfaceTriggers(triggerIds: string[]): Promise<void> {
    await db
      .update(wrenProactiveTriggers)
      .set({ status: 'surfaced', updatedAt: new Date() })
      .where(inArray(wrenProactiveTriggers.id, triggerIds));
  }
  
  /**
   * Resolve a trigger
   */
  async resolveTrigger(triggerId: string, resolutionNotes?: string): Promise<void> {
    await db
      .update(wrenProactiveTriggers)
      .set({
        status: 'resolved',
        resolutionNotes,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wrenProactiveTriggers.id, triggerId));
  }
  
  // =========================================================================
  // 2. DANIELA FEEDBACK LOOP - Track feature effectiveness
  // =========================================================================
  
  /**
   * Record a feature implementation for tracking
   */
  async recordFeatureImplementation(params: {
    featureDescription: string;
    originBeaconId?: string;
    originType: 'beacon' | 'founder_request' | 'proactive';
    measurementType?: string;
    baselineValue?: number;
  }): Promise<DanielaFeatureFeedback> {
    const [created] = await db
      .insert(danielaFeatureFeedback)
      .values({
        featureDescription: params.featureDescription,
        originBeaconId: params.originBeaconId,
        originType: params.originType,
        measurementType: params.measurementType,
        baselineValue: params.baselineValue,
      })
      .returning();
    
    console.log(`[Wren Feedback] Recorded feature: ${params.featureDescription}`);
    return created;
  }
  
  /**
   * Update feature effectiveness based on measurements
   */
  async updateFeatureEffectiveness(featureId: string, params: {
    currentValue?: number;
    danielaFeedback?: string;
    founderFeedback?: string;
    isEffective?: boolean;
    effectivenessScore?: number;
  }): Promise<DanielaFeatureFeedback> {
    const [updated] = await db
      .update(danielaFeatureFeedback)
      .set({
        ...params,
        lastMeasuredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(danielaFeatureFeedback.id, featureId))
      .returning();
    
    console.log(`[Wren Feedback] Updated feature effectiveness: ${updated.featureDescription} - effective: ${params.isEffective}`);
    return updated;
  }
  
  /**
   * Get features linked to beacons that haven't been measured yet
   */
  async getUnmeasuredFeatures(): Promise<DanielaFeatureFeedback[]> {
    return db
      .select()
      .from(danielaFeatureFeedback)
      .where(isNull(danielaFeatureFeedback.isEffective))
      .orderBy(desc(danielaFeatureFeedback.implementedAt));
  }
  
  /**
   * Analyze beacon reduction after a feature
   * Returns the percentage change in beacon frequency
   */
  async analyzeBeaconReduction(featureId: string): Promise<{ before: number; after: number; reduction: number }> {
    const feature = await db
      .select()
      .from(danielaFeatureFeedback)
      .where(eq(danielaFeatureFeedback.id, featureId))
      .limit(1);
    
    if (feature.length === 0) {
      return { before: 0, after: 0, reduction: 0 };
    }
    
    const implementedAt = feature[0].implementedAt!;
    const thirtyDaysBefore = new Date(implementedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    // Count beacons 30 days before implementation
    const [beforeCount] = await db
      .select({ count: count() })
      .from(danielaBeacons)
      .where(
        and(
          gte(danielaBeacons.createdAt, thirtyDaysBefore),
          lte(danielaBeacons.createdAt, implementedAt)
        )
      );
    
    // Count beacons since implementation
    const daysSinceImplementation = (now.getTime() - implementedAt.getTime()) / (1000 * 60 * 60 * 24);
    const [afterCount] = await db
      .select({ count: count() })
      .from(danielaBeacons)
      .where(gte(danielaBeacons.createdAt, implementedAt));
    
    // Normalize to 30-day rate
    const beforeRate = beforeCount.count;
    const afterRate = daysSinceImplementation > 0 
      ? (afterCount.count / daysSinceImplementation) * 30 
      : afterCount.count;
    
    const reduction = beforeRate > 0 
      ? ((beforeRate - afterRate) / beforeRate) * 100 
      : 0;
    
    return {
      before: beforeRate,
      after: Math.round(afterRate),
      reduction: Math.round(reduction),
    };
  }
  
  // =========================================================================
  // 3. ARCHITECTURAL DECISION RECORDS
  // =========================================================================
  
  /**
   * Record an architectural decision
   */
  async recordDecision(params: {
    title: string;
    context: string;
    decision: string;
    rationale: string;
    alternativesConsidered?: { option: string; pros: string[]; cons: string[]; whyRejected?: string }[];
    consequences?: string;
    tradeoffs?: string;
    relatedFiles?: string[];
    decisionMadeBy?: string;
  }): Promise<ArchitecturalDecisionRecord> {
    const [created] = await db
      .insert(architecturalDecisionRecords)
      .values({
        title: params.title,
        context: params.context,
        decision: params.decision,
        rationale: params.rationale,
        alternativesConsidered: params.alternativesConsidered || [],
        consequences: params.consequences,
        tradeoffs: params.tradeoffs,
        relatedFiles: params.relatedFiles || [],
        decisionMadeBy: params.decisionMadeBy || 'wren',
        status: 'accepted',
      })
      .returning();
    
    console.log(`[Wren ADR] Recorded decision: ${params.title}`);
    return created;
  }
  
  /**
   * Get relevant ADRs for a file or component
   */
  async getRelevantADRs(fileOrComponent: string): Promise<ArchitecturalDecisionRecord[]> {
    return db
      .select()
      .from(architecturalDecisionRecords)
      .where(
        or(
          sql`${fileOrComponent} = ANY(${architecturalDecisionRecords.relatedFiles})`,
          ilike(architecturalDecisionRecords.context, `%${fileOrComponent}%`),
          ilike(architecturalDecisionRecords.decision, `%${fileOrComponent}%`)
        )
      )
      .orderBy(desc(architecturalDecisionRecords.decisionMadeAt));
  }
  
  /**
   * Supersede an ADR with a new decision
   */
  async supersedeDecision(oldAdrId: string, newAdrParams: Parameters<typeof this.recordDecision>[0]): Promise<ArchitecturalDecisionRecord> {
    // Mark old ADR as superseded
    await db
      .update(architecturalDecisionRecords)
      .set({ status: 'superseded', updatedAt: new Date() })
      .where(eq(architecturalDecisionRecords.id, oldAdrId));
    
    // Create new ADR with link
    const newAdr = await this.recordDecision({
      ...newAdrParams,
      relatedFiles: [...(newAdrParams.relatedFiles || [])],
    });
    
    // Update old ADR to point to new one
    await db
      .update(architecturalDecisionRecords)
      .set({ supersededBy: newAdr.id })
      .where(eq(architecturalDecisionRecords.id, oldAdrId));
    
    return newAdr;
  }
  
  // =========================================================================
  // 4. PRIORITY INFERENCE ENGINE
  // =========================================================================
  
  /**
   * Score and rank priorities based on multiple signals
   */
  async getTopPriorities(limit: number = 5): Promise<{
    triggers: WrenProactiveTrigger[];
    unmeasuredFeatures: DanielaFeatureFeedback[];
    hotSpots: ProjectHealthMetric[];
    summary: string;
  }> {
    // Get high-priority triggers
    const triggers = await this.getPendingTriggers(limit);
    
    // Get unmeasured features
    const unmeasuredFeatures = await this.getUnmeasuredFeatures();
    
    // Get hot spots
    const hotSpots = await db
      .select()
      .from(projectHealthMetrics)
      .where(eq(projectHealthMetrics.isHotSpot, true))
      .orderBy(projectHealthMetrics.healthScore);
    
    // Build priority summary
    const lines: string[] = ['═══ WREN PRIORITY ANALYSIS ═══'];
    
    if (triggers.length > 0) {
      lines.push(`\n🚨 ATTENTION NEEDED (${triggers.length}):`);
      triggers.slice(0, 3).forEach(t => {
        lines.push(`  [${t.urgency?.toUpperCase()}] ${t.title} (${t.occurrenceCount}x)`);
      });
    }
    
    if (hotSpots.length > 0) {
      lines.push(`\n🔥 HOT SPOTS (${hotSpots.length}):`);
      hotSpots.slice(0, 3).forEach(h => {
        lines.push(`  • ${h.component}: health ${((h.healthScore || 0) * 100).toFixed(0)}%`);
      });
    }
    
    if (unmeasuredFeatures.length > 0) {
      lines.push(`\n📊 FEATURES NEEDING FEEDBACK (${unmeasuredFeatures.length}):`);
      unmeasuredFeatures.slice(0, 2).forEach(f => {
        lines.push(`  • ${f.featureDescription?.substring(0, 60)}...`);
      });
    }
    
    return {
      triggers,
      unmeasuredFeatures: unmeasuredFeatures.slice(0, limit),
      hotSpots,
      summary: lines.join('\n'),
    };
  }
  
  /**
   * Calculate priority score for a single item
   */
  calculatePriorityScore(params: {
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    occurrenceCount?: number;
    daysSinceCreated?: number;
    isFromDaniela?: boolean;
    affectedComponent?: string;
  }): number {
    let score = 0;
    
    // Urgency weight (0-40 points)
    const urgencyWeights = { critical: 40, high: 30, medium: 20, low: 10 };
    score += urgencyWeights[params.urgency || 'low'];
    
    // Occurrence weight (0-30 points)
    score += Math.min((params.occurrenceCount || 1) * 5, 30);
    
    // Recency weight (0-15 points) - more recent = higher
    const daysPenalty = Math.min((params.daysSinceCreated || 0) * 0.5, 15);
    score += 15 - daysPenalty;
    
    // Daniela signal boost (0-10 points)
    if (params.isFromDaniela) {
      score += 10;
    }
    
    // Critical component boost (0-5 points)
    const criticalComponents = ['voice_pipeline', 'auth', 'billing'];
    if (params.affectedComponent && criticalComponents.includes(params.affectedComponent)) {
      score += 5;
    }
    
    return score;
  }
  
  // =========================================================================
  // 5. PROJECT HEALTH AWARENESS
  // =========================================================================
  
  /**
   * Update health metrics for a component
   */
  async updateComponentHealth(component: string, event: {
    type: 'error' | 'fix' | 'beacon' | 'change';
    description?: string;
  }): Promise<ProjectHealthMetric> {
    // Get or create component health record
    const existing = await db
      .select()
      .from(projectHealthMetrics)
      .where(eq(projectHealthMetrics.component, component))
      .limit(1);
    
    let metric: ProjectHealthMetric;
    
    if (existing.length === 0) {
      // Create new
      const [created] = await db
        .insert(projectHealthMetrics)
        .values({ component })
        .returning();
      metric = created;
    } else {
      metric = existing[0];
    }
    
    // Update counts based on event type
    const updates: Partial<ProjectHealthMetric> = { updatedAt: new Date() };
    
    switch (event.type) {
      case 'error':
        updates.errorCount30d = (metric.errorCount30d || 0) + 1;
        break;
      case 'fix':
        updates.fixCount30d = (metric.fixCount30d || 0) + 1;
        break;
      case 'beacon':
        updates.beaconCount30d = (metric.beaconCount30d || 0) + 1;
        break;
      case 'change':
        updates.changeCount30d = (metric.changeCount30d || 0) + 1;
        break;
    }
    
    // Recalculate scores
    const errorCount = updates.errorCount30d ?? metric.errorCount30d ?? 0;
    const fixCount = updates.fixCount30d ?? metric.fixCount30d ?? 0;
    const beaconCount = updates.beaconCount30d ?? metric.beaconCount30d ?? 0;
    const changeCount = updates.changeCount30d ?? metric.changeCount30d ?? 0;
    
    // Health score: lower is worse (more problems)
    // Max 1.0 (healthy), approaches 0 as issues increase
    updates.healthScore = 1 / (1 + (errorCount * 0.3 + fixCount * 0.2 + beaconCount * 0.2));
    
    // Churn score: higher = more changes
    updates.churnScore = Math.min(changeCount * 0.1, 1);
    
    // Stability: inverse of churn + errors
    updates.stabilityScore = 1 / (1 + (changeCount * 0.1 + errorCount * 0.2));
    
    // Hot spot detection
    updates.isHotSpot = (updates.healthScore || 0) < 0.5 || 
                        (errorCount >= 5) || 
                        (beaconCount >= 3);
    
    if (updates.isHotSpot) {
      const reasons: string[] = [];
      if ((updates.healthScore || 0) < 0.5) reasons.push('low health score');
      if (errorCount >= 5) reasons.push(`${errorCount} errors`);
      if (beaconCount >= 3) reasons.push(`${beaconCount} Daniela struggles`);
      updates.hotSpotReason = reasons.join(', ');
    }
    
    updates.lastCalculatedAt = new Date();
    
    const [updated] = await db
      .update(projectHealthMetrics)
      .set(updates)
      .where(eq(projectHealthMetrics.id, metric.id))
      .returning();
    
    console.log(`[Wren Health] ${component}: health=${((updated.healthScore || 0) * 100).toFixed(0)}%, hotspot=${updated.isHotSpot}`);
    return updated;
  }
  
  /**
   * Get overall project health report
   */
  async getHealthReport(): Promise<{
    overall: number;
    byComponent: ProjectHealthMetric[];
    hotSpots: ProjectHealthMetric[];
    recommendations: string[];
  }> {
    const metrics = await db
      .select()
      .from(projectHealthMetrics)
      .orderBy(projectHealthMetrics.healthScore);
    
    // Calculate overall health (average of components)
    const overall = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.healthScore || 1), 0) / metrics.length
      : 1;
    
    const hotSpots = metrics.filter(m => m.isHotSpot);
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    for (const hotSpot of hotSpots.slice(0, 3)) {
      if ((hotSpot.errorCount30d || 0) > 5) {
        recommendations.push(`🔴 ${hotSpot.component}: Address recurring errors (${hotSpot.errorCount30d} in 30 days)`);
      }
      if ((hotSpot.beaconCount30d || 0) > 3) {
        recommendations.push(`🟠 ${hotSpot.component}: Daniela is struggling here - review capability gaps`);
      }
      if ((hotSpot.churnScore || 0) > 0.5) {
        recommendations.push(`🟡 ${hotSpot.component}: High code churn - consider stabilization`);
      }
    }
    
    return {
      overall,
      byComponent: metrics,
      hotSpots,
      recommendations,
    };
  }
  
  // =========================================================================
  // STARTUP RITUAL INTEGRATION
  // =========================================================================
  
  /**
   * Generate startup context for Wren's session initialization
   */
  async generateStartupContext(): Promise<string> {
    const priorities = await this.getTopPriorities(5);
    const healthReport = await this.getHealthReport();
    
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════════',
      '🧠 WREN PROACTIVE INTELLIGENCE - SESSION START',
      '═══════════════════════════════════════════════════════════════════',
      '',
      `📊 Project Health: ${(healthReport.overall * 100).toFixed(0)}%`,
    ];
    
    if (healthReport.hotSpots.length > 0) {
      lines.push(`🔥 Hot Spots: ${healthReport.hotSpots.map(h => h.component).join(', ')}`);
    }
    
    lines.push('');
    lines.push(priorities.summary);
    
    if (healthReport.recommendations.length > 0) {
      lines.push('');
      lines.push('📋 RECOMMENDATIONS:');
      healthReport.recommendations.forEach(r => lines.push(`  ${r}`));
    }
    
    return lines.join('\n');
  }
  
  // =========================================================================
  // MEMORY THREADING (Dec 2024 Emergent Intelligence Upgrade)
  // Build knowledge graph edges between related insights using tags
  // =========================================================================
  
  /**
   * Create a memory thread linking related insights via shared tags
   * Uses the existing tags array to establish relationships
   */
  async createMemoryThread(params: {
    sourceInsightId: string;
    targetInsightId: string;
    relationshipType: 'builds_on' | 'contradicts' | 'refines' | 'applies_to' | 'example_of';
    threadTag: string;
  }): Promise<void> {
    // Create a relationship tag that links the two insights
    const relationshipTag = `thread:${threadTag}:${params.relationshipType}`;
    
    // Get both insights
    const [source, target] = await Promise.all([
      db.select().from(wrenInsights).where(eq(wrenInsights.id, params.sourceInsightId)).limit(1),
      db.select().from(wrenInsights).where(eq(wrenInsights.id, params.targetInsightId)).limit(1),
    ]);
    
    if (!source[0] || !target[0]) {
      console.log('[MemoryThread] Source or target insight not found');
      return;
    }
    
    // Add the thread tag to both insights
    const sourceTags = [...(source[0].tags || []), relationshipTag, `ref:${params.targetInsightId}`];
    const targetTags = [...(target[0].tags || []), relationshipTag, `ref:${params.sourceInsightId}`];
    
    await Promise.all([
      db.update(wrenInsights).set({ tags: sourceTags }).where(eq(wrenInsights.id, params.sourceInsightId)),
      db.update(wrenInsights).set({ tags: targetTags }).where(eq(wrenInsights.id, params.targetInsightId)),
    ]);
    
    console.log(`[MemoryThread] Linked insight ${params.sourceInsightId} <-> ${params.targetInsightId} (${params.relationshipType})`);
  }
  
  /**
   * Find related insights for a given topic or keyword
   */
  async findRelatedInsights(
    keyword: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    content: string;
    category: string;
    useCount: number;
    tags: string[];
  }>> {
    const insights = await db
      .select({
        id: wrenInsights.id,
        content: wrenInsights.content,
        category: wrenInsights.category,
        useCount: wrenInsights.useCount,
        tags: wrenInsights.tags,
      })
      .from(wrenInsights)
      .where(ilike(wrenInsights.content, `%${keyword}%`))
      .orderBy(desc(wrenInsights.useCount))
      .limit(limit);
    
    return insights.map(i => ({
      id: i.id,
      content: i.content || '',
      category: i.category || 'general',
      useCount: i.useCount || 0,
      tags: i.tags || [],
    }));
  }
  
  /**
   * Get the knowledge graph for a specific insight via tag relationships
   */
  async getKnowledgeGraph(
    insightId: string,
    depth: number = 2
  ): Promise<{
    center: { id: string; content: string };
    edges: Array<{ from: string; to: string; relationship: string; toContent: string }>;
  }> {
    const visited = new Set<string>();
    const edges: Array<{ from: string; to: string; relationship: string; toContent: string }> = [];
    
    const explore = async (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);
      
      const insight = await db.select()
        .from(wrenInsights)
        .where(eq(wrenInsights.id, id))
        .limit(1);
      
      if (!insight[0]) return;
      
      // Find related insights via ref: tags
      const tags = insight[0].tags || [];
      const refTags = tags.filter(t => t.startsWith('ref:'));
      
      for (const refTag of refTags) {
        const relatedId = refTag.replace('ref:', '');
        if (!visited.has(relatedId)) {
          const relatedInsight = await db.select()
            .from(wrenInsights)
            .where(eq(wrenInsights.id, relatedId))
            .limit(1);
          
          if (relatedInsight[0]) {
            // Find the relationship type from thread tags
            const threadTag = tags.find(t => t.startsWith('thread:')) || '';
            const relationship = threadTag.split(':')[2] || 'related';
            
            edges.push({
              from: id,
              to: relatedId,
              relationship,
              toContent: (relatedInsight[0].content || '').substring(0, 100),
            });
            await explore(relatedId, currentDepth + 1);
          }
        }
      }
    };
    
    const centerInsight = await db.select()
      .from(wrenInsights)
      .where(eq(wrenInsights.id, insightId))
      .limit(1);
    
    await explore(insightId, 0);
    
    return {
      center: {
        id: insightId,
        content: centerInsight[0]?.content || 'Not found',
      },
      edges,
    };
  }
  
  // =========================================================================
  // CONFIDENCE CALIBRATION (Dec 2024 Emergent Intelligence Upgrade)
  // Track prediction accuracy and adjust future confidence
  // Uses the context field to store confidence metadata
  // =========================================================================
  
  /**
   * Record a prediction with its confidence level
   */
  async recordPrediction(params: {
    domain: string;
    prediction: string;
    confidence: number;
    additionalContext?: string;
  }): Promise<string> {
    const [result] = await db.insert(wrenInsights).values({
      title: `Prediction: ${params.domain}`,
      content: `[PREDICTION] ${params.prediction}`,
      category: 'pattern', // Use existing enum
      context: JSON.stringify({
        type: 'prediction',
        domain: params.domain,
        confidence: params.confidence,
        additionalContext: params.additionalContext,
        recordedAt: new Date().toISOString(),
        verified: false,
      }),
      tags: ['prediction', `domain:${params.domain}`],
    }).returning({ id: wrenInsights.id });
    
    console.log(`[Confidence] Recorded prediction in domain "${params.domain}" with ${(params.confidence * 100).toFixed(0)}% confidence`);
    return result.id;
  }
  
  /**
   * Verify a prediction outcome
   */
  async verifyPrediction(
    predictionId: string,
    wasCorrect: boolean,
    actualOutcome?: string
  ): Promise<void> {
    const prediction = await db.select()
      .from(wrenInsights)
      .where(eq(wrenInsights.id, predictionId))
      .limit(1);
    
    if (!prediction[0]) return;
    
    const ctx = JSON.parse(prediction[0].context || '{}');
    ctx.verified = true;
    ctx.wasCorrect = wasCorrect;
    ctx.actualOutcome = actualOutcome;
    ctx.verifiedAt = new Date().toISOString();
    
    await db.update(wrenInsights)
      .set({ context: JSON.stringify(ctx) })
      .where(eq(wrenInsights.id, predictionId));
    
    console.log(`[Confidence] Prediction ${predictionId} verified: ${wasCorrect ? 'CORRECT' : 'INCORRECT'}`);
  }
  
  /**
   * Get calibration score for a domain
   */
  async getCalibrationScore(
    domain: string
  ): Promise<{
    domain: string;
    totalPredictions: number;
    verifiedPredictions: number;
    accuracy: number;
    avgConfidence: number;
    calibrationError: number;
    suggestion: 'increase_confidence' | 'decrease_confidence' | 'well_calibrated';
  }> {
    const predictions = await db.select()
      .from(wrenInsights)
      .where(ilike(wrenInsights.context, `%"domain":"${domain}"%`));
    
    let totalPredictions = 0;
    let verifiedCount = 0;
    let correctCount = 0;
    let totalConfidence = 0;
    
    for (const pred of predictions) {
      const ctx = JSON.parse(pred.context || '{}');
      if (ctx.type !== 'prediction') continue;
      
      totalPredictions++;
      totalConfidence += ctx.confidence || 0.5;
      
      if (ctx.verified) {
        verifiedCount++;
        if (ctx.wasCorrect) correctCount++;
      }
    }
    
    const avgConfidence = totalPredictions > 0 ? totalConfidence / totalPredictions : 0.5;
    const accuracy = verifiedCount > 0 ? correctCount / verifiedCount : 0;
    const calibrationError = Math.abs(accuracy - avgConfidence);
    
    let suggestion: 'increase_confidence' | 'decrease_confidence' | 'well_calibrated' = 'well_calibrated';
    if (verifiedCount >= 5) {
      if (accuracy > avgConfidence + 0.1) {
        suggestion = 'increase_confidence';
      } else if (accuracy < avgConfidence - 0.1) {
        suggestion = 'decrease_confidence';
      }
    }
    
    return {
      domain,
      totalPredictions,
      verifiedPredictions: verifiedCount,
      accuracy,
      avgConfidence,
      calibrationError,
      suggestion,
    };
  }
  
  /**
   * Get adjusted confidence based on calibration history
   */
  async getAdjustedConfidence(
    domain: string,
    baseConfidence: number
  ): Promise<number> {
    const calibration = await this.getCalibrationScore(domain);
    
    if (calibration.verifiedPredictions < 5) {
      return baseConfidence;
    }
    
    if (calibration.suggestion === 'increase_confidence') {
      return Math.min(1, baseConfidence + calibration.calibrationError * 0.5);
    } else if (calibration.suggestion === 'decrease_confidence') {
      return Math.max(0.1, baseConfidence - calibration.calibrationError * 0.5);
    }
    
    return baseConfidence;
  }
  
  // =========================================================================
  // MEMORY CONSOLIDATION (Dec 2024 Emergent Intelligence Upgrade)
  // Decay/reinforcement for insights based on usage
  // =========================================================================
  
  /**
   * Decay unused insights (run periodically)
   * Marks stale insights via tags instead of isActive flag
   */
  async runDecayCycle(): Promise<{
    decayed: number;
    deactivated: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Find insights that haven't been used in 30 days
    const staleInsights = await db
      .select()
      .from(wrenInsights)
      .where(
        or(
          lte(wrenInsights.lastUsedAt, thirtyDaysAgo),
          isNull(wrenInsights.lastUsedAt)
        )
      );
    
    let decayed = 0;
    let deactivated = 0;
    
    for (const insight of staleInsights) {
      const tags = insight.tags || [];
      
      // Skip already deactivated insights
      if (tags.includes('status:inactive')) continue;
      
      const useCount = insight.useCount || 0;
      
      // Insights with low use count get deactivated
      if (useCount < 2) {
        const newTags = [...tags.filter(t => !t.startsWith('status:')), 'status:inactive'];
        await db.update(wrenInsights)
          .set({ tags: newTags })
          .where(eq(wrenInsights.id, insight.id));
        deactivated++;
      } else if (!tags.includes('status:stale')) {
        // Mark as stale but not inactive
        const newTags = [...tags.filter(t => !t.startsWith('status:')), 'status:stale'];
        await db.update(wrenInsights)
          .set({ tags: newTags })
          .where(eq(wrenInsights.id, insight.id));
        decayed++;
      }
    }
    
    console.log(`[MemoryConsolidation] Decay cycle: ${decayed} marked stale, ${deactivated} deactivated`);
    return { decayed, deactivated };
  }
  
  /**
   * Reinforce an insight when used successfully
   */
  async reinforceInsight(
    insightId: string,
    successLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    const insight = await db.select()
      .from(wrenInsights)
      .where(eq(wrenInsights.id, insightId))
      .limit(1);
    
    if (!insight[0]) return;
    
    const currentUseCount = insight[0].useCount || 0;
    const tags = insight[0].tags || [];
    
    // Remove stale/inactive status
    const updatedTags = tags.filter(t => !t.startsWith('status:'));
    updatedTags.push('status:active');
    
    await db.update(wrenInsights)
      .set({
        useCount: currentUseCount + 1,
        lastUsedAt: new Date(),
        tags: updatedTags,
      })
      .where(eq(wrenInsights.id, insightId));
    
    console.log(`[MemoryConsolidation] Reinforced insight ${insightId} (${successLevel})`);
  }
  
  /**
   * Get consolidated memory summary for session
   */
  async getMemorySummary(): Promise<{
    totalInsights: number;
    recentlyUsed: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [totalResult, recentResult] = await Promise.all([
      db.select({ count: count() }).from(wrenInsights),
      db.select({ count: count() }).from(wrenInsights).where(gte(wrenInsights.lastUsedAt, sevenDaysAgo)),
    ]);
    
    const categoryStats = await db
      .select({
        category: wrenInsights.category,
        count: count(),
      })
      .from(wrenInsights)
      .groupBy(wrenInsights.category)
      .orderBy(desc(count()))
      .limit(5);
    
    return {
      totalInsights: totalResult[0]?.count || 0,
      recentlyUsed: recentResult[0]?.count || 0,
      topCategories: categoryStats.map(s => ({
        category: s.category || 'unknown',
        count: s.count,
      })),
    };
  }
}

export const wrenProactiveService = new WrenProactiveIntelligenceService();
