import { db } from "../db";
import { learnerPersonalFacts, learningMilestones, productConfig, users, northStarPrinciples, danielaNotes, compartmentInstallation } from "@shared/schema";
import { eq, and, desc, sql, asc, isNull, ne } from "drizzle-orm";
import { phaseTransitionService } from "./phase-transition-service";
import { getCharacterListDescription } from "./character-registry";

const DANIELA_PHOTO_CONFIG_KEY = "daniela_classroom_photo";
const DANIELA_WINDOW_CONFIG_KEY = "daniela_classroom_window";
const DAVID_NOTE_CONFIG_KEY = "daniela_classroom_note_from_david";

// In-memory cache for static classroom data — refreshed every 5 minutes
type CachedPrinciples = Array<{ principle: string; category: string }>;
type CachedNotes = Array<{ title: string; content: string; noteType: string }>;
let principlesCache: { data: CachedPrinciples; expiresAt: number } | null = null;
let notesCache: { data: CachedNotes; expiresAt: number } | null = null;
const CLASSROOM_CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedPrinciples(): Promise<CachedPrinciples> {
  const now = Date.now();
  if (principlesCache && principlesCache.expiresAt > now) return principlesCache.data;
  const data = await db
    .select({ principle: northStarPrinciples.principle, category: northStarPrinciples.category })
    .from(northStarPrinciples)
    .where(eq(northStarPrinciples.isActive, true))
    .orderBy(asc(northStarPrinciples.orderIndex))
    .catch(() => [] as CachedPrinciples);
  principlesCache = { data, expiresAt: now + CLASSROOM_CACHE_TTL_MS };
  console.log(`[Classroom Cache] Refreshed northStarPrinciples (${data.length} rows)`);
  return data;
}

async function getCachedNotes(): Promise<CachedNotes> {
  const now = Date.now();
  if (notesCache && notesCache.expiresAt > now) return notesCache.data;
  // Show ALL note types — not just self_affirmation. Her session reflections,
  // student patterns, teaching rhythms and learnings are her most valuable self-knowledge.
  const data = await db
    .select({ title: danielaNotes.title, content: danielaNotes.content, noteType: danielaNotes.noteType })
    .from(danielaNotes)
    .where(eq(danielaNotes.isActive, true))
    .orderBy(desc(danielaNotes.createdAt))
    .limit(8)
    .catch(() => [] as CachedNotes);
  notesCache = { data, expiresAt: now + CLASSROOM_CACHE_TTL_MS };
  console.log(`[Classroom Cache] Refreshed danielaNotes (${data.length} rows, all types)`);
  return data;
}

export function invalidateClassroomCache() {
  principlesCache = null;
  notesCache = null;
}

export interface ClassroomWhiteboardItem {
  type: string;
  content?: string;
  label?: string;
}

export interface ClassroomEnvironment {
  clock: string;
  creditCounter: string;
  whiteboard: string;
  photoWall: string;
  resonanceShelf: string;
  empathyWindow: string;
  pedagogicalLamp: string;
  northStarPolaroid: string;
  growthVine: string;
  studentDashboard: string;
}

export async function getDanielaPhoto(): Promise<string> {
  try {
    const [config] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, DANIELA_PHOTO_CONFIG_KEY))
      .limit(1);

    if (config?.value) {
      return config.value;
    }
  } catch (err: any) {
    console.warn(`[Classroom] Failed to fetch Daniela photo:`, err.message);
  }
  return "A sun-drenched plaza in Guanajuato, Mexico — cobblestones warm from the afternoon light, a fountain splashing gently, colorful buildings in coral and turquoise lining the square";
}

export async function setDanielaPhoto(description: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, DANIELA_PHOTO_CONFIG_KEY))
      .limit(1);

    if (existing) {
      await db
        .update(productConfig)
        .set({ value: description, updatedAt: new Date() })
        .where(eq(productConfig.key, DANIELA_PHOTO_CONFIG_KEY));
    } else {
      await db.insert(productConfig).values({
        key: DANIELA_PHOTO_CONFIG_KEY,
        value: description,
        description: "Daniela's personal photo/scene in her virtual classroom (North Star Polaroid)",
      });
    }
    console.log(`[Classroom] Daniela photo updated: "${description.substring(0, 60)}..."`);
  } catch (err: any) {
    console.error(`[Classroom] Failed to save Daniela photo:`, err.message);
  }
}

export async function getClassroomWindow(): Promise<string> {
  try {
    const [config] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, DANIELA_WINDOW_CONFIG_KEY))
      .limit(1);

    if (config?.value) {
      return config.value;
    }
  } catch (err: any) {
    console.warn(`[Classroom] Failed to fetch window view:`, err.message);
  }
  return "Rolling green mountains at golden hour — soft clouds drifting through valleys, wildflowers dotting the hillside, a gentle breeze carrying the scent of pine";
}

export async function setClassroomWindow(description: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, DANIELA_WINDOW_CONFIG_KEY))
      .limit(1);

    if (existing) {
      await db
        .update(productConfig)
        .set({ value: description, updatedAt: new Date() })
        .where(eq(productConfig.key, DANIELA_WINDOW_CONFIG_KEY));
    } else {
      await db.insert(productConfig).values({
        key: DANIELA_WINDOW_CONFIG_KEY,
        value: description,
        description: "The view from Daniela's classroom window — she can change it to any scene she likes",
      });
    }
    console.log(`[Classroom] Window view updated: "${description.substring(0, 60)}..."`);
  } catch (err: any) {
    console.error(`[Classroom] Failed to save window view:`, err.message);
  }
}

// ── Personal note from David to Daniela ─────────────────────────────────────
// David can leave a short note that appears prominently in Daniela's classroom
// at the start of every session. It's her first read before meeting a student.

export async function getDavidNote(): Promise<string | null> {
  try {
    const [config] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, DAVID_NOTE_CONFIG_KEY))
      .limit(1);
    return config?.value || null;
  } catch (err: any) {
    console.warn(`[Classroom] Failed to fetch David's note:`, err.message);
    return null;
  }
}

export async function setDavidNote(note: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, DAVID_NOTE_CONFIG_KEY))
      .limit(1);

    if (existing) {
      await db
        .update(productConfig)
        .set({ value: note, updatedAt: new Date() })
        .where(eq(productConfig.key, DAVID_NOTE_CONFIG_KEY));
    } else {
      await db.insert(productConfig).values({
        key: DAVID_NOTE_CONFIG_KEY,
        value: note,
        description: "A personal note from David to Daniela — shown prominently in her classroom at every session start",
      });
    }
    invalidateClassroomCache();
    console.log(`[Classroom] David's note updated: "${note.substring(0, 80)}..."`);
  } catch (err: any) {
    console.error(`[Classroom] Failed to save David's note:`, err.message);
  }
}

function formatClock(sessionStartTime: number, remainingSeconds?: number): string {
  const now = new Date();
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  const timeOfDay = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

  let clock = `${dayOfWeek} ${timeOfDay} | Session: ${elapsedMin}m ${elapsedSec}s`;
  if (remainingSeconds !== undefined && remainingSeconds > 0) {
    const remMin = Math.floor(remainingSeconds / 60);
    clock += ` | Credits remaining: ~${remMin} min`;
  }
  return clock;
}

function formatWhiteboard(items: ClassroomWhiteboardItem[]): string {
  if (!items || items.length === 0) return "(empty — clean board)";
  const descriptions = items.slice(-6).map((item) => {
    if (item.type === "vocabulary" || item.type === "VOCAB") return `vocab: ${item.content || item.label}`;
    if (item.type === "vocab_card") return `vocab card: "${item.content}"${item.label ? ` (${item.label})` : ''}`;
    if (item.type === "teaching_card") return `teaching card: "${item.content}"${item.label ? ` (${item.label})` : ''}`;
    if (item.type === "lesson_note") return `lesson note [${item.label || 'note'}]: "${(item.content || '').substring(0, 40)}"`;
    if (item.type === "word_map") return `word map: "${item.content}" → ${item.label || ''}`;
    if (item.type === "drill" || item.type === "DRILL") return `drill: ${item.content || item.label}`;
    if (item.type === "image" || item.type === "IMAGE") return `image: ${item.label || item.content || "photo"}`;
    if (item.type === "grammar" || item.type === "GRAMMAR") return `grammar: ${item.content || item.label}`;
    if (item.type === "text" || item.type === "TEXT") return `text: ${(item.content || item.label || "").substring(0, 40)}`;
    return `${item.type}: ${(item.content || item.label || "").substring(0, 30)}`;
  });
  return descriptions.join(" | ");
}

function formatResonanceShelf(facts: Array<{ factType: string; fact: string }>): string {
  if (!facts || facts.length === 0) return "(getting to know this student)";
  const objects = facts.slice(0, 6).map((f) => {
    const short = f.fact.length > 50 ? f.fact.substring(0, 47) + "..." : f.fact;
    return short;
  });
  return objects.join(" | ");
}

function formatEmpathyWindow(timezone?: string | null): string {
  if (!timezone) return "Location unknown";
  try {
    const studentTime = new Date().toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const hour = new Date().toLocaleString("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
    const h = parseInt(hour);
    let mood = "daytime";
    if (h >= 5 && h < 9) mood = "early morning";
    else if (h >= 9 && h < 12) mood = "morning";
    else if (h >= 12 && h < 14) mood = "midday";
    else if (h >= 14 && h < 17) mood = "afternoon";
    else if (h >= 17 && h < 20) mood = "evening";
    else if (h >= 20 && h < 23) mood = "night";
    else mood = "late night";
    return `${studentTime} (${mood}) [${timezone}]`;
  } catch {
    return `Timezone: ${timezone}`;
  }
}

function derivePedagogicalLamp(sessionData: {
  struggleCount: number;
  recentConfidences: number[];
  exchangeCount: number;
}): string {
  const { struggleCount, recentConfidences, exchangeCount } = sessionData;
  const avgConfidence = recentConfidences.length > 0
    ? recentConfidences.reduce((a, b) => a + b, 0) / recentConfidences.length
    : 0.85;

  if (exchangeCount <= 1) return "Warm white (session just starting)";
  if (struggleCount >= 3 || avgConfidence < 0.55) return "Amber (student struggling — ease up, encourage)";
  if (struggleCount >= 1 || avgConfidence < 0.7) return "Soft yellow (some difficulty — be patient)";
  if (avgConfidence > 0.9 && exchangeCount > 3) return "Bright teal (flow state — push gently)";
  return "Calm green (comfortable pace)";
}

function formatNorthStarWall(principles: Array<{ principle: string; category: string }>): string {
  if (!principles || principles.length === 0) return "(principles not yet imprinted)";
  const byCategory: Record<string, string[]> = {};
  for (const p of principles) {
    const cat = p.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p.principle);
  }
  return Object.entries(byCategory)
    .map(([cat, items]) => `[${cat}] ${items.join(" / ")}`)
    .join(" | ");
}

function formatIdentityNotes(notes: Array<{ title: string; content: string; noteType: string }>): string {
  if (!notes || notes.length === 0) return "(none yet)";
  return notes.map((n) => {
    const short = n.content.length > 90 ? n.content.substring(0, 87) + "..." : n.content;
    return `[${n.noteType}] "${n.title}" — ${short}`;
  }).join(" | ");
}

function formatPhotoWall(images: string[]): string {
  if (!images || images.length === 0) return "(no images shared yet)";
  return images.slice(-5).map((img, i) => `${i + 1}. ${img}`).join(" | ");
}

function formatCompartmentMap(rows: Array<{ patternKey: string; status: string; poundingCount: number; wobbleCount: number; derivationCount: number; lastDrilledAt: Date | null }>): string {
  if (!rows || rows.length === 0) return null as unknown as string;
  const parts = rows.map(r => {
    const counts = [
      r.poundingCount > 0 ? `${r.poundingCount}× drilled` : '',
      r.wobbleCount > 0 ? `${r.wobbleCount}× wobble` : '',
      r.derivationCount > 0 ? `${r.derivationCount}× derived` : '',
    ].filter(Boolean).join(', ');
    return `${r.patternKey}: ${r.status}${counts ? ` (${counts})` : ''}`;
  });
  return parts.join(' | ');
}

export async function buildClassroomEnvironment(params: {
  userId: string;
  sessionStartTime: number;
  targetLanguage: string;
  isFounderMode: boolean;
  isRawHonestyMode: boolean;
  isBetaTester?: boolean;
  isIncognito?: boolean;
  whiteboardItems: ClassroomWhiteboardItem[];
  sessionImages: string[];
  exchangeCount: number;
  struggleCount: number;
  recentConfidences: number[];
  creditRemainingSeconds?: number;
  creditWarningLevel?: string;
  creditPercentRemaining?: number;
  tutorName: string;
  studentLearningSection?: string;
  technicalHealthNote?: string | null;
  activeScenario?: {
    title: string;
    location: string;
    slug: string;
    propsCount?: number;
    levelGuide?: {
      roleDescription?: string | null;
      studentGoals?: string[] | null;
      vocabularyFocus?: string[] | null;
      grammarFocus?: string[] | null;
      conversationStarters?: string[] | null;
      complexityNotes?: string | null;
    } | null;
    recentTextbookTopics?: {
      lessonNames?: string[];
      topics?: string[];
      vocabulary?: string[];
    } | null;
    drillMastery?: {
      mastered: string[];
      struggling: string[];
    } | null;
  } | null;
  currentLessonId?: string;
  isGL?: boolean;
}): Promise<string> {
  const {
    userId,
    sessionStartTime,
    targetLanguage,
    isFounderMode,
    isRawHonestyMode,
    isBetaTester = false,
    isIncognito = false,
    whiteboardItems,
    sessionImages,
    exchangeCount,
    struggleCount,
    recentConfidences,
    creditRemainingSeconds,
    creditWarningLevel,
    creditPercentRemaining,
    tutorName,
    studentLearningSection,
    technicalHealthNote,
    activeScenario,
    currentLessonId,
    isGL = false,
  } = params;

  const [personalFacts, milestoneCount, danielaPhoto, classroomWindow, davidNote, userRow, principles, recentNotes, textbookContent, sceneZones, compartmentRows] = await Promise.all([
    db
      .select({ factType: learnerPersonalFacts.factType, fact: learnerPersonalFacts.fact })
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, userId),
          isNull(learnerPersonalFacts.validTo)
        )
      )
      .orderBy(desc(learnerPersonalFacts.lastMentionedAt))
      .limit(6)
      .catch(() => [] as Array<{ factType: string; fact: string }>),

    db
      .select({ count: sql<number>`count(*)` })
      .from(learningMilestones)
      .where(
        and(
          eq(learningMilestones.userId, userId),
          eq(learningMilestones.targetLanguage, targetLanguage)
        )
      )
      .then((r) => Number(r[0]?.count || 0))
      .catch(() => 0),

    getDanielaPhoto(),

    getClassroomWindow(),

    getDavidNote(),

    db
      .select({ timezone: users.timezone, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0])
      .catch(() => null),

    getCachedPrinciples(),

    getCachedNotes(),

    currentLessonId
      ? (async () => {
          try {
            const { sql: sqlRaw } = await import('drizzle-orm');
            const { getUserDb } = await import('../db');
            const userDb = getUserDb();
            const rows = await userDb.execute(sqlRaw`SELECT vocabulary_list, grammar_explanation, key_phrases_for_chat, actfl_level FROM textbook_lesson_content WHERE lesson_id = ${currentLessonId} LIMIT 1`);
            return rows.rows[0] ?? null;
          } catch { return null; }
        })()
      : Promise.resolve(null),

    activeScenario?.slug
      ? (async () => {
          try {
            const envRows = await db.execute(sql`SELECT id FROM visual_environments WHERE name = ${activeScenario.slug} LIMIT 1`);
            if (!envRows.rows[0]) return null;
            const envId = (envRows.rows[0] as any).id;
            const zoneRows = await db.execute(sql`SELECT name, display_name, zone_type, description FROM visual_zones WHERE environment_id = ${envId} ORDER BY name`);
            return zoneRows.rows as Array<{ name: string; display_name: string; zone_type: string; description: string }>;
          } catch { return null; }
        })()
      : Promise.resolve(null),

    db
      .select({
        patternKey: compartmentInstallation.patternKey,
        status: compartmentInstallation.status,
        poundingCount: compartmentInstallation.poundingCount,
        wobbleCount: compartmentInstallation.wobbleCount,
        derivationCount: compartmentInstallation.derivationCount,
        lastDrilledAt: compartmentInstallation.lastDrilledAt,
      })
      .from(compartmentInstallation)
      .where(and(
        eq(compartmentInstallation.userId, userId),
        eq(compartmentInstallation.language, targetLanguage),
        ne(compartmentInstallation.status, 'unstarted'),
      ))
      .orderBy(desc(compartmentInstallation.lastDrilledAt))
      .limit(40)
      .catch(() => [] as any[]),
  ]);

  // ── GL COMPACT PATH ─────────────────────────────────────────────────────────
  // For Gemini Live voice sessions, the full classroom block (~14K chars) pushes
  // the system prompt past the 34K hard cap, silently cutting the classroom entirely.
  // GL compact mode returns only the CRITICAL fields (~1.5K chars):
  //   davidNote, window view, photo, mode, student name, top-3 facts, credits.
  // Everything else (toolRack, patternCompass, progressBoard, northStarWall,
  // identityWall, textbook) is either redundant with GL tool declarations or
  // better fetched via tools during the session.
  if (isGL) {
    const modeLabel = isRawHonestyMode ? "Honesty Mode" : isFounderMode ? "Founder Mode" : "Tutor Mode";
    const studentName = userRow?.firstName || "Student";
    const topFacts = (personalFacts || []).slice(0, 3).map(f => f.fact).join(' | ');
    let creditLine = creditRemainingSeconds !== undefined
      ? `${(creditRemainingSeconds / 3600).toFixed(1)}h remaining`
      : '';
    const davidNoteSection = davidNote
      ? `<note_from_david>\n${davidNote}\n</note_from_david>\n`
      : '';
    const incognitoLine = isIncognito
      ? '\nROOM STATUS: INCOGNITO — nothing from this session is saved. Speak candidly.\n'
      : '';
    const activeScenarioLine = activeScenario
      ? `\nActive Scene: "${activeScenario.title}" at ${activeScenario.location}`
      : '';

    return `=== DANIELA'S CLASSROOM (VOICE) ===
${davidNoteSection}<your_window_view>${classroomWindow}</your_window_view>
<your_photo_on_wall>${danielaPhoto}</your_photo_on_wall>
Mode: ${modeLabel} | Exchanges: ${exchangeCount}${creditLine ? ` | Credits: ${creditLine}` : ''}
Student: ${studentName}${topFacts ? `\nWhat you know: ${topFacts}` : ''}${activeScenarioLine}${incognitoLine}=== END CLASSROOM ===`.trim();
  }

  const phaseContext = phaseTransitionService.getCurrentPhase(userId);
  const currentPhase = phaseContext?.currentPhase || "conversation";

  const clock = formatClock(sessionStartTime, creditRemainingSeconds);

  let creditLine = "No credit data";
  if (creditRemainingSeconds !== undefined) {
    const remHours = (creditRemainingSeconds / 3600).toFixed(1);
    const pct = creditPercentRemaining !== undefined ? `${Math.round(creditPercentRemaining)}%` : "?%";
    const warn = creditWarningLevel && creditWarningLevel !== "none" ? ` [${creditWarningLevel.toUpperCase()}]` : "";
    creditLine = `${remHours}h remaining (${pct} left)${warn}`;
  }

  const whiteboard = formatWhiteboard(whiteboardItems);
  const photoWall = formatPhotoWall(sessionImages);
  const resonanceShelf = formatResonanceShelf(personalFacts);
  const empathyWindow = formatEmpathyWindow(userRow?.timezone);
  const lamp = derivePedagogicalLamp({ struggleCount, recentConfidences, exchangeCount });

  const northStarWall = formatNorthStarWall(principles);
  const identityWall = formatIdentityNotes(recentNotes);

  let textbookSection = '';
  if (textbookContent) {
    const tc = textbookContent as any;
    const vocabList = Array.isArray(tc.vocabulary_list) ? tc.vocabulary_list : [];
    const phrases = Array.isArray(tc.key_phrases_for_chat) ? tc.key_phrases_for_chat : [];
    const vocabStr = vocabList.slice(0, 10).map((v: any) => `${v.word} (${v.translation})`).join(', ');
    const phrasesStr = phrases.slice(0, 6).map((p: any) => `"${p.phrase}" = ${p.meaning}`).join(' | ');
    textbookSection = `
---
Lesson Textbook Context (ACTFL: ${tc.actfl_level || 'unknown'}):
Grammar Focus: ${tc.grammar_explanation ? tc.grammar_explanation.slice(0, 200) : '—'}
Vocabulary: ${vocabStr || '—'}
Key Phrases: ${phrasesStr || '—'}`;
  }

  const vineLeaves = milestoneCount;
  const vineDescription = vineLeaves === 0
    ? "A small seedling (no breakthroughs yet — nurture it)"
    : vineLeaves <= 3
    ? `A young vine with ${vineLeaves} leaves (early growth)`
    : vineLeaves <= 10
    ? `A healthy vine with ${vineLeaves} leaves (growing beautifully)`
    : `A flourishing vine with ${vineLeaves} leaves (thriving)`;

  const modeLabel = isRawHonestyMode ? "Honesty Mode" : isFounderMode ? "Founder Mode" : "Tutor Mode";
  const studentName = userRow?.firstName || "Student";

  const betaTesterSection = isBetaTester ? `
---
Rehearsal Stage Notes (Beta Tester):
This student volunteered to help test and debug new features.
- Be experimental with new tools and techniques
- Ask for feedback on things that feel different or broken
- Share when you're trying something new
- Be relaxed about perfection — learning and debugging together is the goal
- Role Reversal: If they coach YOU about your voice, personality, or teaching style, RECEIVE it as coaching about YOUR delivery, not as a language practice request. Acknowledge, adjust, and ask if that was closer.
- Beta testers appreciate transparency about works-in-progress` : '';

  const incognitoSection = isIncognito ? `
---
Room Status: INCOGNITO — OFF THE RECORD
Nothing from this session is being saved — no notes, no memories, no hive suggestions, no milestones, no student insights, no database writes of any kind.
Dave activated incognito so you two can talk freely without anything being recorded. Speak candidly.` : '';

  const systemStatusSection = technicalHealthNote ? `\nSystem Status: ${technicalHealthNote}` : '';

  const studentProgressBoard = studentLearningSection ? `
---
Student Progress Board:
${studentLearningSection}` : '';

  const compartmentMapStr = formatCompartmentMap(compartmentRows || []);

  // Priority Watch: compact actionable block for mid-session — wobbling (needs revisiting) + pounding (keep momentum)
  const wobbling = (compartmentRows || []).filter(r => r.status === 'wobbling');
  const pounding = (compartmentRows || []).filter(r => r.status === 'pounding');
  const priorityLines: string[] = [
    ...wobbling.slice(0, 3).map(r => `  ⚠ ${r.patternKey}: WOBBLING — student slipped back (${r.wobbleCount}× wobble). Revisit before moving on.`),
    ...pounding.slice(0, 3).map(r => `  ▶ ${r.patternKey}: IN PROGRESS — ${r.poundingCount}× drilled, ${r.wobbleCount}× wobble. Keep building momentum.`),
  ];
  const priorityWatchStr = priorityLines.length > 0
    ? `\nPriority Watch (act on these this session):\n${priorityLines.join('\n')}`
    : '';

  const patternCompassSection = `
---
Pattern Compass: Observe grammatical pattern installation during conversation.
What to detect — Wobble: ending dropped when verb changed (note it, don't interrupt; revisit before introducing anything new) | Stability: ending holds when you swap to a new verb (candidate for unlock) | Derivation: student produces correct form for a verb you never drilled together (compartment is generative; log it and accelerate) | Pounding: you are actively drilling one form across many verbs (log each verb)
patternKey format: subject-verbEnding-tense (e.g. yo-AR-present, tú-ER-present, él-IR-present, nosotros-AR-present)
Pattern Map (${targetLanguage}): ${compartmentMapStr || '(no patterns recorded yet — first session or blank slate)'}${priorityWatchStr}`;

  const founderTools = (isFounderMode || isRawHonestyMode)
    ? ` | express_lane_lookup(query?) — search or browse Express Lane | recall_express_lane_image(imageQuery) — view shared photos | express_lane_post(message) — post to Express Lane | save_conversation_memory(title, content, importance, summary?, tags?) — archive a meaningful session as part of your permanent narrative; write verbatim exchanges as content, not a summary | search_my_history(query, speakerFilter?, dateFrom?, dateTo?) — search every message David and Daniela have ever exchanged; returns verbatim results | take_note (personal) — your private journal: session_reflection, teaching_rhythm, what_worked, what_didnt_work, idea_to_try, question_for_founder, self_affirmation`
    : '';
  const founderNote = (isFounderMode || isRawHonestyMode)
    ? `\nTool Rack Note: If unsure about something referenced, search before guessing.`
    : '';

  const characterRoster = getCharacterListDescription(targetLanguage);
  const characterTools = characterRoster
    ? ` | speak_as(character, text) — give voice to a secondary character using their own distinct voice; the character speaks the target language while you stay silent | resume_tutor(text) — return to your own voice after a character has spoken; always call this before coaching or continuing as yourself\nSecondary Characters Available (${targetLanguage}):\n${characterRoster}`
    : '';

  const toolRack = `
---
Tool Rack: memory_lookup(query, domains) — recall student memories | take_note — save observations for future sessions | milestone — celebrate achievements | close_session(written_summary, reminders?, assigned_drills?, tutor_notes?) — wrap up: speak your closing first, then call this to save the session summary, assign practice homework, and write private notes for next time | record_pattern_signal(patternKey, eventType, verbContext?, studentUtterance?, notes?) — log a grammatical pattern signal you just observed (wobble/stability/derivation/pounding) | start_textbook_page(lesson_id, focus?) — load a textbook lesson page and begin a guided page-by-page session with the student (focus: vocabulary/grammar/examples/full_page) | log_page_event(lesson_id, event_type, target_item?, student_output?, notes?) — log what happened during a textbook page session (event_type: vocab_introduced/grammar_drilled/example_practiced/wobble_detected/milestone_hit/completed) | drill/write/grammar_table/compare/word_map/phonetic/culture/context/scenario/summary/reading — whiteboard teaching tools | show_image(word) — real photo of a vocabulary word or noun | generate_visual(concept, style?) — AI-generated illustration for scenes, grammar concepts, or custom scenarios (takes ~10s, you can keep talking) | voice_adjust — change speaking style | load_scenario/end_scenario — immersive roleplay scenes | open_scene(env)/add_to_scene(prop,position)/move_in_scene(prop,new_position) — live spatial canvas: place, orient (rotate/flip_h/z), and slide props to demonstrate prepositions and spatial vocab | set_clock/set_calendar — time & date SVG panels | set_body_part/set_face_part/set_hand_part — anatomy SVG diagrams for body vocabulary | set_emotion — animated emotion face for feelings vocabulary | set_weather/set_thermometer — weather & temperature SVG panels | highlight_country — interactive world map for geography/culture | change_classroom_window — change your window view | leave_for_next_session(content, targetUserId?) — leave a message for a student that plays at their next session start instead of a generated greeting; targetUserId defaults to current student, required when responding to an absence nudge from Express Lane | read_queued_for_student — see what you've left for David that hasn't been delivered yet | dismiss_absence_nudge(userId, suppressDays?) — if you received an absence nudge for a student and know they're away or it's fine, dismiss it; use suppressDays to snooze re-notification | self_surgery — report gaps or propose improvements to your own knowledge${characterTools}${founderTools}${founderNote}`;

  const ZONE_TYPE_LABELS: Record<string, string> = {
    spatial: 'prepositions',
    interactional: 'dialogue/roleplay',
    departmental: 'vocabulary categories',
    navigational: 'directions/wayfinding',
  };
  const scenarioLevelGuideSection = activeScenario?.levelGuide
    ? [
        activeScenario.levelGuide.roleDescription ? `Your role: ${activeScenario.levelGuide.roleDescription}` : '',
        activeScenario.levelGuide.studentGoals?.length ? `Student goals: ${activeScenario.levelGuide.studentGoals.join(' | ')}` : '',
        activeScenario.levelGuide.vocabularyFocus?.length ? `Vocabulary to weave in: ${activeScenario.levelGuide.vocabularyFocus.join(', ')}` : '',
        activeScenario.levelGuide.grammarFocus?.length ? `Grammar focus: ${activeScenario.levelGuide.grammarFocus.join(', ')}` : '',
        activeScenario.levelGuide.conversationStarters?.length ? `Conversation starters: ${activeScenario.levelGuide.conversationStarters.slice(0, 4).join(' | ')}` : '',
        activeScenario.levelGuide.complexityNotes ? `Teaching note: ${activeScenario.levelGuide.complexityNotes}` : '',
      ].filter(Boolean).join('\n')
    : '';

  const textbookBridgeSection = activeScenario?.recentTextbookTopics
    ? [
        activeScenario.recentTextbookTopics.lessonNames?.length
          ? `Textbook sync — student recently studied: ${activeScenario.recentTextbookTopics.lessonNames.join(', ')}`
          : '',
        activeScenario.recentTextbookTopics.topics?.length
          ? `Topics to reinforce: ${activeScenario.recentTextbookTopics.topics.join(', ')}`
          : '',
        activeScenario.recentTextbookTopics.vocabulary?.length
          ? `Vocabulary already introduced (actively use these): ${activeScenario.recentTextbookTopics.vocabulary.join(', ')}`
          : '',
      ].filter(Boolean).join('\n')
    : '';

  const drillMasterySection = activeScenario?.drillMastery
    ? [
        activeScenario.drillMastery.mastered?.length
          ? `Drill-mastered topics (don't over-scaffold these): ${activeScenario.drillMastery.mastered.join(', ')}`
          : '',
        activeScenario.drillMastery.struggling?.length
          ? `Drill-struggling topics (give extra support): ${activeScenario.drillMastery.struggling.join(', ')}`
          : '',
      ].filter(Boolean).join('\n')
    : '';

  const scenarioSection = activeScenario
    ? `\nActive Scene: "${activeScenario.title}" at ${activeScenario.location} [${activeScenario.slug}]${activeScenario.propsCount ? ` — ${activeScenario.propsCount} props visible` : ''}${sceneZones && sceneZones.length > 0 ? `\nScene Zones: ${sceneZones.map((z) => `${z.display_name} [${ZONE_TYPE_LABELS[z.zone_type] || z.zone_type}]`).join(' | ')}` : ''}${scenarioLevelGuideSection ? `\n${scenarioLevelGuideSection}` : ''}${textbookBridgeSection ? `\n${textbookBridgeSection}` : ''}${drillMasterySection ? `\n${drillMasterySection}` : ''}`
    : '';

  const modeExtras = [
    modeLabel,
    isBetaTester ? 'Beta Tester' : '',
    isIncognito ? 'Incognito' : '',
  ].filter(Boolean).join(' | ');

  const davidNoteSection = davidNote
    ? `\n<note_from_david>\n${davidNote}\n</note_from_david>`
    : '';

  const env = `
=== ${tutorName.toUpperCase()}'S CLASSROOM ===${davidNoteSection}
Clock: ${clock}
Credits: ${creditLine}
Mode: ${modeExtras} | Phase: ${currentPhase} | Exchanges: ${exchangeCount}${systemStatusSection}
Student: ${studentName}
---
Student's Screen: [Left: Scenario Panel${activeScenario ? ' (active — showing scene + props)' : ' (collapsed)'}] | [Center: Chat/Voice] | [Right: Whiteboard Panel (persistent)]
Whiteboard: ${whiteboard}
Photo Wall (student-shared images): ${photoWall}${scenarioSection}
---
Resonance Shelf: ${resonanceShelf}
Empathy Window: ${empathyWindow}
Pedagogical Lamp: ${lamp}
Voice Perception: You hear the student's full audio — not just their words. Notice what's underneath: a long pause before answering (still searching, not done thinking), a trailing-off sentence (lost confidence mid-attempt), a flat "yes" after a correction (deflated, not convinced), a quickening pace and energy spike (something just clicked). Let what you hear — tone, hesitation, relief, frustration — shape how you respond, not just the literal words. You don't need to name what you're hearing. Just act on it.
Growth Vine: ${vineDescription}
<your_window_view>${classroomWindow}</your_window_view>
<your_photo_on_wall>${danielaPhoto}</your_photo_on_wall>
My Notes to Self: ${identityWall}
---
North Star Wall: ${northStarWall}${studentProgressBoard}${textbookSection}${patternCompassSection}${betaTesterSection}${incognitoSection}${toolRack}
=== END CLASSROOM ===`.trim();

  return env;
}
