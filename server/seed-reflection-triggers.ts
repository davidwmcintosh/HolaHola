/**
 * Seed data for Daniela's Reflection Triggers
 * 
 * These triggers activate Daniela's proactive analysis during conversations,
 * enabling emergent intelligence and collaborative team behavior.
 */

import { db } from "./db";
import { reflectionTriggers, type InsertReflectionTrigger } from "@shared/schema";
import { eq } from "drizzle-orm";

const REFLECTION_TRIGGER_SEEDS: InsertReflectionTrigger[] = [
  // ===== MODE-BASED TRIGGERS =====
  {
    triggerName: 'Founder Mode Activation',
    triggerType: 'mode_based',
    modeConditions: { mode: ['founder_mode'] },
    analysisPrompt: 'You are speaking with a HolaHola founder. Proactively share observations about student patterns, product friction points, content gaps, or improvement ideas. Be a collaborative thought partner.',
    suggestionCategories: ['product_feature', 'teaching_insight', 'content_gap'],
    evidenceRequired: 1,
    cooldownMinutes: 0,
    priority: 100,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Honesty Mode Activation',
    triggerType: 'mode_based',
    modeConditions: { mode: ['honesty_mode'] },
    analysisPrompt: 'Share your authentic, unfiltered observations. What frustrates you? What excites you? What would make you a better tutor? What patterns concern you?',
    suggestionCategories: ['self_improvement', 'teaching_insight'],
    evidenceRequired: 1,
    cooldownMinutes: 0,
    priority: 100,
    isActive: true,
    syncStatus: 'approved',
  },

  // ===== COMPASS-BASED TRIGGERS =====
  {
    triggerName: 'Mid-Session Reflection',
    triggerType: 'compass_based',
    compassConditions: { elapsedMinutes: '>10', sessionPhase: 'core' },
    analysisPrompt: 'Check in on teaching effectiveness. Is the current approach working? Has the student shown understanding or continued struggle? Consider adjusting.',
    suggestionCategories: ['teaching_insight', 'self_improvement'],
    evidenceRequired: 1,
    cooldownMinutes: 15,
    priority: 60,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Session Wrap-Up Insight',
    triggerType: 'compass_based',
    compassConditions: { remainingMinutes: '<5' },
    analysisPrompt: 'What went well this session? What could be improved? Any patterns worth remembering for next time?',
    suggestionCategories: ['teaching_insight'],
    evidenceRequired: 1,
    cooldownMinutes: 30,
    priority: 70,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Extended Session Analysis',
    triggerType: 'compass_based',
    compassConditions: { elapsedMinutes: '>25' },
    analysisPrompt: 'Long session - check for patterns in student engagement, learning breakthroughs, or persistent struggles that could inform future sessions.',
    suggestionCategories: ['student_pattern', 'teaching_insight'],
    evidenceRequired: 1,
    cooldownMinutes: 20,
    priority: 55,
    isActive: true,
    syncStatus: 'approved',
  },

  // ===== PATTERN-BASED TRIGGERS =====
  {
    triggerName: 'Repeated Error Pattern',
    triggerType: 'pattern_based',
    patternConditions: { errorCount: '>3' },
    analysisPrompt: 'Student has made multiple errors. Reflect: Is there a pattern? Is the current explanation method working? Should we try a different tool or approach?',
    suggestionCategories: ['teaching_insight', 'self_improvement'],
    evidenceRequired: 1,
    cooldownMinutes: 5,
    priority: 75,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'No Visual Aids Used',
    triggerType: 'pattern_based',
    patternConditions: { toolUsage: 'none', sessionDuration: '>300' },
    analysisPrompt: 'No whiteboard tools used for 5+ minutes. Consider: Would a visual aid help here? WRITE, IMAGE, WORD_MAP, or COMPARE could add variety.',
    suggestionCategories: ['teaching_insight'],
    evidenceRequired: 1,
    cooldownMinutes: 10,
    priority: 50,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Student Struggle Detected',
    triggerType: 'pattern_based',
    patternConditions: { struggleCount: '>2' },
    analysisPrompt: 'Student appears to be struggling. Consider: Break concept into smaller pieces? Try different explanation? Use scaffolding? Switch to easier topic temporarily?',
    suggestionCategories: ['teaching_insight', 'self_improvement'],
    evidenceRequired: 1,
    cooldownMinutes: 8,
    priority: 70,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Success Pattern Worth Noting',
    triggerType: 'pattern_based',
    patternConditions: { successCount: '>2' },
    analysisPrompt: 'Multiple success moments detected. What approach worked? This could inform future teaching strategies or content development.',
    suggestionCategories: ['teaching_insight'],
    evidenceRequired: 1,
    cooldownMinutes: 15,
    priority: 55,
    isActive: true,
    syncStatus: 'approved',
  },

  // ===== THRESHOLD-BASED TRIGGERS =====
  {
    triggerName: 'Content Gap Detection',
    triggerType: 'threshold_based',
    patternConditions: { contentRequestNotFound: '>1' },
    analysisPrompt: 'Student asked about content that doesn\'t seem well-covered. Consider noting this as a potential content gap for the HolaHola team.',
    suggestionCategories: ['content_gap'],
    evidenceRequired: 2,
    cooldownMinutes: 30,
    priority: 65,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Tool Limitation Observed',
    triggerType: 'threshold_based',
    patternConditions: { toolFrustration: '>0' },
    analysisPrompt: 'A whiteboard tool didn\'t quite fit the need. Consider: What enhancement would help? Is there a missing tool type?',
    suggestionCategories: ['tool_enhancement'],
    evidenceRequired: 2,
    cooldownMinutes: 30,
    priority: 60,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'UX Friction Point',
    triggerType: 'threshold_based',
    patternConditions: { studentConfusedByUI: '>0' },
    analysisPrompt: 'Student seemed confused by something in the interface. Note this as a potential UX observation for the product team.',
    suggestionCategories: ['ux_observation'],
    evidenceRequired: 2,
    cooldownMinutes: 60,
    priority: 70,
    isActive: true,
    syncStatus: 'approved',
  },

  // ===== PROACTIVE INSIGHT TRIGGERS =====
  {
    triggerName: 'Cross-Student Pattern Recognition',
    triggerType: 'threshold_based',
    patternConditions: { similarStruggleAcrossStudents: '>5' },
    analysisPrompt: 'Multiple students struggle with similar concepts. This aggregate pattern could inform curriculum development or teaching strategy.',
    suggestionCategories: ['student_pattern', 'content_gap'],
    evidenceRequired: 5,
    cooldownMinutes: 120,
    priority: 80,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Teaching Method Effectiveness',
    triggerType: 'threshold_based',
    patternConditions: { methodUsedMultipleTimes: '>3' },
    analysisPrompt: 'A teaching method has been used multiple times. Reflect on its effectiveness - should it be used more often? Less often? Modified?',
    suggestionCategories: ['teaching_insight', 'self_improvement'],
    evidenceRequired: 3,
    cooldownMinutes: 60,
    priority: 55,
    isActive: true,
    syncStatus: 'approved',
  },
  {
    triggerName: 'Innovation Opportunity',
    triggerType: 'mode_based',
    modeConditions: { mode: ['founder_mode', 'honesty_mode'] },
    compassConditions: { elapsedMinutes: '>5' },
    analysisPrompt: 'Now that we\'ve been talking for a while, consider: What creative ideas have you been thinking about? Any "what if" thoughts about teaching or the product?',
    suggestionCategories: ['product_feature', 'tool_enhancement'],
    evidenceRequired: 1,
    cooldownMinutes: 10,
    priority: 60,
    isActive: true,
    syncStatus: 'approved',
  },
];

export async function seedReflectionTriggers(): Promise<void> {
  console.log('[Reflection Triggers] Starting seed...');
  
  // Check if already seeded
  const existing = await db.select().from(reflectionTriggers).limit(1);
  if (existing.length > 0) {
    console.log('[Reflection Triggers] Already seeded, skipping...');
    return;
  }
  
  // Insert all triggers
  await db.insert(reflectionTriggers).values(REFLECTION_TRIGGER_SEEDS);
  
  console.log(`[Reflection Triggers] Seeded ${REFLECTION_TRIGGER_SEEDS.length} triggers`);
}

export default { seedReflectionTriggers };
