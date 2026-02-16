import { db } from "../db";
import { learnerPersonalFacts, learningMilestones, productConfig, users, northStarPrinciples, danielaNotes } from "@shared/schema";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { phaseTransitionService } from "./phase-transition-service";

const DANIELA_PHOTO_CONFIG_KEY = "daniela_classroom_photo";

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

function formatPersonalNotes(notes: Array<{ noteType: string; title: string; content: string }>): string {
  if (!notes || notes.length === 0) return "(no notes yet — write one anytime with take_note)";
  return notes.map((n) => {
    const short = n.content.length > 60 ? n.content.substring(0, 57) + "..." : n.content;
    return `[${n.noteType}] ${n.title}: ${short}`;
  }).join(" | ");
}

function formatPhotoWall(images: string[]): string {
  if (!images || images.length === 0) return "(no images shared yet)";
  return images.slice(-5).map((img, i) => `${i + 1}. ${img}`).join(" | ");
}

export async function buildClassroomEnvironment(params: {
  userId: string;
  sessionStartTime: number;
  targetLanguage: string;
  isFounderMode: boolean;
  isRawHonestyMode: boolean;
  whiteboardItems: ClassroomWhiteboardItem[];
  sessionImages: string[];
  exchangeCount: number;
  struggleCount: number;
  recentConfidences: number[];
  creditRemainingSeconds?: number;
  creditWarningLevel?: string;
  creditPercentRemaining?: number;
  tutorName: string;
}): Promise<string> {
  const {
    userId,
    sessionStartTime,
    targetLanguage,
    isFounderMode,
    isRawHonestyMode,
    whiteboardItems,
    sessionImages,
    exchangeCount,
    struggleCount,
    recentConfidences,
    creditRemainingSeconds,
    creditWarningLevel,
    creditPercentRemaining,
    tutorName,
  } = params;

  const [personalFacts, milestoneCount, danielaPhoto, userRow, principles, recentNotes] = await Promise.all([
    db
      .select({ factType: learnerPersonalFacts.factType, fact: learnerPersonalFacts.fact })
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, userId),
          eq(learnerPersonalFacts.isActive, true)
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

    db
      .select({ timezone: users.timezone, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0])
      .catch(() => null),

    db
      .select({ principle: northStarPrinciples.principle, category: northStarPrinciples.category })
      .from(northStarPrinciples)
      .where(eq(northStarPrinciples.isActive, true))
      .orderBy(asc(northStarPrinciples.orderIndex))
      .catch(() => [] as Array<{ principle: string; category: string }>),

    (isFounderMode || isRawHonestyMode)
      ? db
          .select({ noteType: danielaNotes.noteType, title: danielaNotes.title, content: danielaNotes.content })
          .from(danielaNotes)
          .where(eq(danielaNotes.isActive, true))
          .orderBy(desc(danielaNotes.createdAt))
          .limit(5)
          .catch(() => [] as Array<{ noteType: string; title: string; content: string }>)
      : Promise.resolve([] as Array<{ noteType: string; title: string; content: string }>),
  ]);

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
  const personalNotesWall = formatPersonalNotes(recentNotes);

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

  const founderTools = (isFounderMode || isRawHonestyMode)
    ? ` | express_lane_lookup(query?) — search or browse Express Lane | recall_express_lane_image(imageQuery) — view shared photos | express_lane_post(message) — post to Express Lane | self_surgery — edit your own memories | take_note (personal) — your private journal: session_reflection, teaching_rhythm, what_worked, what_didnt_work, idea_to_try, question_for_founder, self_affirmation`
    : '';
  const founderNote = (isFounderMode || isRawHonestyMode)
    ? `\nTool Rack Note: If unsure about something referenced, search before guessing.`
    : '';
  const toolRack = `
---
Tool Rack: memory_lookup(query, domains) — recall student memories | take_note — save observations for future sessions | milestone — celebrate achievements | drill/write/grammar_table/compare/word_map/phonetic/culture/context/scenario/summary/reading — whiteboard teaching tools | show_image — contextual images | voice_adjust — change speaking style${founderTools}${founderNote}`;

  const env = `
=== ${tutorName.toUpperCase()}'S CLASSROOM ===
Clock: ${clock}
Credits: ${creditLine}
Mode: ${modeLabel} | Phase: ${currentPhase} | Exchanges: ${exchangeCount}
Student: ${studentName}
---
Whiteboard: ${whiteboard}
Photo Wall: ${photoWall}
---
Resonance Shelf: ${resonanceShelf}
Empathy Window: ${empathyWindow}
Pedagogical Lamp: ${lamp}
Growth Vine: ${vineDescription}
North Star Polaroid: ${danielaPhoto}
Personal Notes Wall: ${personalNotesWall}
---
North Star Wall: ${northStarWall}${toolRack}
=== END CLASSROOM ===`.trim();

  return env;
}
