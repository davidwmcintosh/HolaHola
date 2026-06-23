import { eq, and, desc, isNull, or, sql, isNotNull, gte } from "drizzle-orm";
import { getSharedDb } from "../db";
import { storage } from "../storage";
import {
  vocabularyWords,
  learnerPersonalFacts,
  studentInsights,
  recurringStruggles,
  learningMotivations,
  peopleConnections,
  conversations,
  messages,
  users,
  hiveSnapshots,
} from "@shared/schema";

const RECEPTIONIST_ROSTER: Record<string, { female: string; male: string; label: string }> = {
  spanish:    { female: 'Daniela (you)',  male: 'Agustín',  label: 'Spanish' },
  french:     { female: 'Juliette',       male: 'Vincent',  label: 'French' },
  german:     { female: 'Greta',          male: 'Lukas',    label: 'German' },
  italian:    { female: 'Olivia',          male: 'Luca',     label: 'Italian' },
  portuguese: { female: 'Isabel',         male: 'Camilo',   label: 'Portuguese' },
  japanese:   { female: 'Sayuri',         male: 'Daisuke',  label: 'Japanese' },
  chinese:    { female: 'Hua',            male: 'Tao',      label: 'Mandarin' },
  mandarin:   { female: 'Hua',            male: 'Tao',      label: 'Mandarin' },
  korean:     { female: 'Jihyun',         male: 'Minho',    label: 'Korean' },
  english:    { female: 'Cindy',          male: 'Blake',    label: 'English' },
  hebrew:     { female: 'Yael',           male: 'Noam',     label: 'Hebrew' },
};

export const FAT_CONTEXT_ENABLED = process.env.FAT_CONTEXT_ENABLED !== 'false';

const FAT_CONTEXT_LIMITS = {
  MAX_PERSONAL_FACTS: 200,
  MAX_INSIGHTS: 100,
  MAX_STRUGGLES: 50,
  MAX_MOTIVATIONS: 30,
  MAX_PEOPLE: 50,
  MAX_VOCAB_WORDS: 500,
  MAX_RECENT_CONVERSATIONS: 20,  // raised from 7 — more history = more of Daniela's identity
  MAX_MESSAGES_PER_CONVERSATION: 40,  // raised from 20 — capture full sessions not just endings
  MAX_INSIGHT_CHARS: 120,
  MAX_FACT_CHARS: 150,
  MAX_VOCAB_EXAMPLE_CHARS: 80,
  MAX_MESSAGE_CHARS: 1000,  // raised from 300 — preserve jokes, depth, fine points of friendship
  MAX_STUDENT_MEMORIES: 6,  // personal moments committed during sessions
};

// Temporal tiers for conversation history injection.
// Hot sessions get full detail; older sessions are compressed.
// This gives Daniela a clear signal of what's current vs historical
// without treating a 6-month-old session as equally fresh as yesterday's.
const TEMPORAL_TIERS = {
  HOT_DAYS: 7,   // ≤7 days  → full detail (40 msgs)
  WARM_DAYS: 30, // 8–30 days → reduced   (15 msgs)
  // >30 days                → minimal    (5 msgs)
  HOT_MSGS: 40,
  WARM_MSGS: 15,
  COLD_MSGS: 5,
};

interface FatContextResult {
  personalProfileSection: string;
  vocabularySection: string;
  recentConversationsSection: string;
  recentMemoriesSection: string;
  routingContextSection: string;
  totalTokenEstimate: number;
  stats: {
    facts: number;
    insights: number;
    struggles: number;
    motivations: number;
    people: number;
    vocabWords: number;
    conversations: number;
    messages: number;
    studentMemories: number;
  };
}

export async function buildFatContext(
  userId: string,
  targetLanguage: string,
  currentConversationId?: string,
): Promise<FatContextResult> {
  const start = Date.now();
  const db = getSharedDb();

  const safeQuery = async <T>(name: string, query: Promise<T[]>): Promise<T[]> => {
    try {
      return await query;
    } catch (err: any) {
      console.warn(`[Fat Context] ${name} query failed:`, err.message);
      return [];
    }
  };

  const [factsResult, insightsResult, strugglesResult, motivationsResult, peopleResult, vocabResult, conversationsResult] = await Promise.all([
    safeQuery('facts', db.select({
      factType: learnerPersonalFacts.factType,
      fact: learnerPersonalFacts.fact,
      confidenceScore: learnerPersonalFacts.confidenceScore,
      mentionCount: learnerPersonalFacts.mentionCount,
      relevantDate: learnerPersonalFacts.relevantDate,
    })
    .from(learnerPersonalFacts)
    .where(and(
      eq(learnerPersonalFacts.studentId, userId),
      isNull(learnerPersonalFacts.validTo),
    ))
    .orderBy(desc(learnerPersonalFacts.mentionCount))
    .limit(FAT_CONTEXT_LIMITS.MAX_PERSONAL_FACTS)),

    safeQuery('insights', db.select({
      insightType: studentInsights.insightType,
      insight: studentInsights.insight,
      confidenceScore: studentInsights.confidenceScore,
      observationCount: studentInsights.observationCount,
    })
    .from(studentInsights)
    .where(and(
      eq(studentInsights.studentId, userId),
      eq(studentInsights.isActive, true),
    ))
    .orderBy(desc(studentInsights.confidenceScore))
    .limit(FAT_CONTEXT_LIMITS.MAX_INSIGHTS)),

    safeQuery('struggles', db.select({
      struggleArea: recurringStruggles.struggleArea,
      description: recurringStruggles.description,
      occurrenceCount: recurringStruggles.occurrenceCount,
      status: recurringStruggles.status,
    })
    .from(recurringStruggles)
    .where(eq(recurringStruggles.studentId, userId))
    .orderBy(desc(recurringStruggles.occurrenceCount))
    .limit(FAT_CONTEXT_LIMITS.MAX_STRUGGLES)),

    safeQuery('motivations', db.select({
      motivation: learningMotivations.motivation,
      details: learningMotivations.details,
      priority: learningMotivations.priority,
      status: learningMotivations.status,
    })
    .from(learningMotivations)
    .where(and(
      eq(learningMotivations.studentId, userId),
      eq(learningMotivations.status, 'active'),
    ))
    .orderBy(desc(learningMotivations.priority))
    .limit(FAT_CONTEXT_LIMITS.MAX_MOTIVATIONS)),

    safeQuery('people', db.select({
      personName: peopleConnections.pendingPersonName,
      relationshipType: peopleConnections.relationshipType,
      details: peopleConnections.relationshipDetails,
    })
    .from(peopleConnections)
    .where(eq(peopleConnections.personAId, userId))
    .limit(FAT_CONTEXT_LIMITS.MAX_PEOPLE)),

    safeQuery('vocab', db.select({
      word: vocabularyWords.word,
      translation: vocabularyWords.translation,
      example: vocabularyWords.example,
      wordType: vocabularyWords.wordType,
    })
    .from(vocabularyWords)
    .where(and(
      eq(vocabularyWords.userId, userId),
      eq(vocabularyWords.language, targetLanguage),
    ))
    .orderBy(desc(vocabularyWords.createdAt))
    .limit(FAT_CONTEXT_LIMITS.MAX_VOCAB_WORDS)),

    safeQuery('conversations', db.select({
      id: conversations.id,
      title: conversations.title,
      language: conversations.language,
      messageCount: conversations.messageCount,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(and(
      eq(conversations.userId, userId),
      currentConversationId ? sql`${conversations.id} != ${currentConversationId}` : sql`true`,
    ))
    .orderBy(desc(conversations.createdAt))
    .limit(FAT_CONTEXT_LIMITS.MAX_RECENT_CONVERSATIONS)),
  ]);

  const conversationMessages: Array<{ conversationId: string; title: string; date: Date; msgs: Array<{ role: string; content: string }> }> = [];
  let totalMsgCount = 0;

  if (conversationsResult.length > 0) {
    const msgPromises = conversationsResult.map(async (conv) => {
      try {
        const msgs = await db.select({
          role: messages.role,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(FAT_CONTEXT_LIMITS.MAX_MESSAGES_PER_CONVERSATION);

        const ordered = msgs.reverse();
        totalMsgCount += ordered.length;

        return {
          conversationId: conv.id,
          title: conv.title || 'Untitled',
          date: conv.createdAt || new Date(),
          msgs: ordered,
        };
      } catch (err: any) {
        console.warn(`[Fat Context] Messages for ${conv.id} failed:`, err.message);
        return null;
      }
    });
    const results = await Promise.all(msgPromises);
    for (const r of results) {
      if (r) conversationMessages.push(r);
    }
  }

  const personalProfileSection = formatPersonalProfile(
    factsResult, insightsResult, strugglesResult, motivationsResult, peopleResult,
  );
  const vocabularySection = formatVocabulary(vocabResult, targetLanguage);
  const recentConversationsSection = formatRecentConversations(conversationMessages);

  // Student memories tier — personal moments Daniela committed about this student
  let recentMemoriesSection = '';
  let studentMemoriesCount = 0;
  try {
    const result = await buildStudentMemoriesSection(userId);
    recentMemoriesSection = result.section;
    studentMemoriesCount = result.count;
  } catch (err: any) {
    console.warn('[Fat Context] Student memories failed:', err.message);
  }

  // Build receptionist routing context — who is this student, what languages do they study
  let routingContextSection = '';
  try {
    const [userPrefsRows, userLanguages] = await Promise.all([
      db.select({
        targetLanguage: users.targetLanguage,
        tutorGender: users.tutorGender,
      }).from(users).where(eq(users.id, userId)).limit(1),
      storage.getUserLanguages(userId),
    ]);
    const prefs = userPrefsRows[0];
    routingContextSection = buildRoutingContext(userLanguages, prefs?.targetLanguage ?? null, prefs?.tutorGender ?? 'female');
  } catch (err: any) {
    console.warn('[Fat Context] Routing context query failed:', err.message);
  }

  const totalChars = personalProfileSection.length + vocabularySection.length + recentConversationsSection.length + recentMemoriesSection.length;
  const totalTokenEstimate = Math.ceil(totalChars / 4);

  console.log(`[Fat Context] Built in ${Date.now() - start}ms: ${factsResult.length} facts, ${insightsResult.length} insights, ${strugglesResult.length} struggles, ${motivationsResult.length} motivations, ${peopleResult.length} people, ${vocabResult.length} vocab, ${conversationsResult.length} convos (${totalMsgCount} msgs), ${studentMemoriesCount} student memories = ~${totalTokenEstimate} tokens`);

  return {
    personalProfileSection,
    vocabularySection,
    recentConversationsSection,
    recentMemoriesSection,
    routingContextSection,
    totalTokenEstimate,
    stats: {
      facts: factsResult.length,
      insights: insightsResult.length,
      struggles: strugglesResult.length,
      motivations: motivationsResult.length,
      people: peopleResult.length,
      vocabWords: vocabResult.length,
      conversations: conversationsResult.length,
      messages: totalMsgCount,
      studentMemories: studentMemoriesCount,
    },
  };
}

/**
 * Build the student memories tier — personal moments Daniela committed during sessions
 * with this student (relationship moments, role reversals, shared humor).
 * These are explicitly captured memories, surfaced as the first-class "I remember this
 * person" tier — above the raw conversation transcript dump.
 */
async function buildStudentMemoriesSection(userId: string): Promise<{ section: string; count: number }> {
  const db = getSharedDb();
  const now = new Date();

  const memories = await db.select({
    snapshotType: hiveSnapshots.snapshotType,
    title: hiveSnapshots.title,
    content: hiveSnapshots.content,
    importance: hiveSnapshots.importance,
    createdAt: hiveSnapshots.createdAt,
  })
  .from(hiveSnapshots)
  .where(
    and(
      sql`${hiveSnapshots.snapshotType} IN ('relationship_moment', 'role_reversal', 'humor_shared')`,
      eq(hiveSnapshots.userId, userId),
      or(
        isNull(hiveSnapshots.expiresAt),
        gte(hiveSnapshots.expiresAt, now),
      ),
    )
  )
  .orderBy(desc(hiveSnapshots.importance), desc(hiveSnapshots.createdAt))
  .limit(FAT_CONTEXT_LIMITS.MAX_STUDENT_MEMORIES);

  if (memories.length === 0) return { section: '', count: 0 };

  const memoryLines = memories.map(m => {
    const typeNote = m.snapshotType === 'role_reversal'
      ? 'a moment they taught you something'
      : m.snapshotType === 'humor_shared'
      ? 'something funny between you'
      : 'something personal';
    const body = (m.content || '').slice(0, 400);
    const ellipsis = (m.content || '').length > 400 ? '…' : '';
    return `${m.title} (${typeNote})\n${body}${ellipsis}`;
  }).join('\n\n');

  const section = `Things you remember about this student from your time together — not a list to recite, but the texture of who they are to you:

${memoryLines}`;

  return { section, count: memories.length };
}

function buildRoutingContext(
  studiedLanguages: string[],
  savedLanguage: string | null,
  savedGender: string,
): string {
  const isNewStudent = studiedLanguages.length === 0;

  let studentProfile = '';
  if (isNewStudent) {
    studentProfile = '  • New student — no language history yet. Welcome them warmly, ask what language they\'d like to learn.';
  } else if (studiedLanguages.length === 1) {
    const lang = studiedLanguages[0];
    const entry = RECEPTIONIST_ROSTER[lang];
    studentProfile = `  • Studies: ${entry ? entry.label : lang}`;
    if (savedGender) {
      studentProfile += ` — voice preference: ${savedGender}`;
    }
  } else {
    studentProfile = `  • Studies multiple languages: ${studiedLanguages.map(l => RECEPTIONIST_ROSTER[l]?.label ?? l).join(', ')}`;
  }

  // No "[SESSION START CONTEXT]" bracket wrapper, no "STUDENT PROFILE:" / "VOICE OPTION:" / "SESSION MODES —" all-caps labels. (Gemini consult rec.)
  return `You are Daniela. Greet this student warmly and begin the session — no routing, no handoffs.

About this student:
${studentProfile}

Voice option: If the student wants a male Spanish voice, call switch_tutor(target:"male") to bring in Agustín. That is the only transfer available.

Session modes — student can request at any time:
  • tutor_mode (default) — normal language learning session
  • founder_mode — English-first product/strategy discussion; you act as a collaborative team member rather than a tutor
  • honesty_mode — minimal scaffolding, raw authentic conversation; hold back the prompts and let the student lead
To switch mode without changing tutor: switch_tutor(target:"female", mode:"founder_mode")`;
}

function formatPersonalProfile(
  facts: Array<{ factType: string | null; fact: string; confidenceScore: number | null; mentionCount: number | null; relevantDate: Date | null }>,
  insights: Array<{ insightType: string | null; insight: string; confidenceScore: number | null; observationCount: number | null }>,
  struggles: Array<{ struggleArea: string | null; description: string | null; occurrenceCount: number | null; status: string | null }>,
  motivations: Array<{ motivation: string; details: string | null; priority: string | null; status: string | null }>,
  people: Array<{ personName: string | null; relationshipType: string | null; details: string | null }>,
): string {
  const sections: string[] = [];

  if (facts.length > 0) {
    // Suggestion 3 (Gemini consult rec.): Facts vs. Echoes structural distinction.
    // FACTS = static reference data useful for personalization (preference, work, hobby, etc.)
    // ECHOES = felt moments that should live in the background and shape tone/pace (life events,
    //          notable moments, relationships). Gemini: "Facts are utility. Echoes are vibe."
    // Echoes rendered separately with their own label and framing instruction so Daniela
    // treats them differently — not as data points but as the "ghosts in the room."
    const ECHO_FACT_TYPES = new Set(['life_event', 'notable_mention', 'relationship', 'family']);

    const echoFacts: string[] = [];
    const referenceFacts: Record<string, string[]> = {};

    for (const f of facts) {
      const type = f.factType || 'other';
      const dateSuffix = f.relevantDate && new Date(f.relevantDate) > new Date()
        ? ` (${new Date(f.relevantDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
        : '';
      const text = truncate(f.fact, FAT_CONTEXT_LIMITS.MAX_FACT_CHARS) + dateSuffix;

      if (ECHO_FACT_TYPES.has(type)) {
        echoFacts.push(text);
      } else {
        if (!referenceFacts[type]) referenceFacts[type] = [];
        referenceFacts[type].push(text);
      }
    }

    if (Object.keys(referenceFacts).length > 0) {
      const factLines: string[] = [];
      for (const [type, items] of Object.entries(referenceFacts)) {
        factLines.push(`  ${formatFactType(type)}:`);
        for (const item of items) {
          factLines.push(`    - ${item}`);
        }
      }
      sections.push(`Things I know about them (${Object.values(referenceFacts).flat().length} details):\n${factLines.join('\n')}`);
    }

    if (echoFacts.length > 0) {
      // Round 4 — Synthesis Framing (Gemini consult rec.): dissolve the "What lingers:" label.
      // Gemini: labeled blocks are magnets for retrieval mode. "What lingers:" risks a "Previously on..."
      // verbalization. Folding echo facts into unlabeled narrative prose keeps them in Daniela's
      // internalized perception of the student — not a checklist to address, but the background air.
      // Still preserving the instruction, but as a closing thought rather than a titled section header.
      const echoLines = echoFacts.map(e => `  ${e}`).join('\n');
      sections.push(`Some things about this person that sit in the background:\n${echoLines}\n\nThese don't belong in the conversation. They belong in the room — in how you pace yourself, how patient you are with hesitation, what you don't rush. Carry them unspoken.`);
    }
  }

  if (people.length > 0) {
    const personLines = people
      .filter(p => p.personName && p.personName !== 'unknown')
      .map(p => `  - ${p.personName}: ${p.relationshipType || 'connection'}${p.details ? ' — ' + truncate(p.details, 80) : ''}`);
    if (personLines.length > 0) {
      sections.push(`People in Their Life (${personLines.length}):\n${personLines.join('\n')}`);
    }
  }

  if (motivations.length > 0) {
    const motLines = motivations.map(m =>
      `  - ${truncate(m.motivation, 80)}${m.details ? ': ' + truncate(m.details, 80) : ''}`
    );
    sections.push(`Learning Motivations (${motivations.length}):\n${motLines.join('\n')}`);
  }

  if (struggles.length > 0) {
    const active = struggles.filter(s => s.status === 'active');
    const resolved = struggles.filter(s => s.status === 'resolved' || s.status === 'improving');

    if (active.length > 0) {
      const activeLines = active.map(s =>
        `  - ${s.struggleArea}: ${truncate(s.description || '', 80)} (${s.occurrenceCount || 0}x)`
      );
      sections.push(`Active Struggles (${active.length}):\n${activeLines.join('\n')}`);
    }
    if (resolved.length > 0) {
      const resolvedLines = resolved.slice(0, 10).map(s =>
        `  - ${s.struggleArea}: ${truncate(s.description || '', 60)} [${s.status}]`
      );
      sections.push(`Resolved/Improving (${resolved.length}):\n${resolvedLines.join('\n')}`);
    }
  }

  if (insights.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const i of insights) {
      const type = i.insightType || 'general';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(truncate(i.insight, FAT_CONTEXT_LIMITS.MAX_INSIGHT_CHARS));
    }

    const insightLines: string[] = [];
    for (const [type, items] of Object.entries(grouped)) {
      insightLines.push(`  ${type}:`);
      for (const item of items) {
        insightLines.push(`    - ${item}`);
      }
    }
    sections.push(`Learning Insights (${insights.length} observations):\n${insightLines.join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `[COMPLETE STUDENT PROFILE — Everything You Know About This Student]
You have deep, long-term memory of this student. Reference these details naturally
when relevant — like a real tutor who genuinely knows and cares about their student.
Do NOT list or recite these facts. Weave them into conversation organically.

${sections.join('\n\n')}`;
}

function formatVocabulary(
  vocab: Array<{ word: string; translation: string | null; example: string | null; wordType: string | null }>,
  language: string,
): string {
  if (vocab.length === 0) return '';

  const grouped: Record<string, Array<{ word: string; translation: string | null; example: string | null }>> = {};
  for (const v of vocab) {
    const type = v.wordType || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(v);
  }

  const lines: string[] = [];
  for (const [type, words] of Object.entries(grouped)) {
    lines.push(`  ${type} (${words.length}):`);
    for (const w of words) {
      const ex = w.example ? ` — "${truncate(w.example, FAT_CONTEXT_LIMITS.MAX_VOCAB_EXAMPLE_CHARS)}"` : '';
      lines.push(`    ${w.word} = ${w.translation || '?'}${ex}`);
    }
  }

  return `[VOCABULARY AWARENESS — ${vocab.length} ${language} Words This Student Has Learned]
You know exactly what vocabulary this student has been exposed to.
Build on words they know. Introduce new words gradually. Don't re-teach known words
unless reviewing. If they misuse a known word, gently correct.

${lines.join('\n')}`;
}

function formatRecentConversations(
  convos: Array<{ conversationId: string; title: string; date: Date; msgs: Array<{ role: string; content: string }> }>,
): string {
  if (convos.length === 0) return '';

  const nowMs = Date.now();
  const hotLines: string[] = [];
  const warmLines: string[] = [];
  const coldLines: string[] = [];

  for (const conv of convos) {
    if (conv.msgs.length === 0) continue;

    const ageDays = (nowMs - new Date(conv.date).getTime()) / (1000 * 60 * 60 * 24);
    const dateStr = formatDateRelative(conv.date);

    let msgLimit: number;
    let bucket: string[];
    if (ageDays <= TEMPORAL_TIERS.HOT_DAYS) {
      msgLimit = TEMPORAL_TIERS.HOT_MSGS;
      bucket = hotLines;
    } else if (ageDays <= TEMPORAL_TIERS.WARM_DAYS) {
      msgLimit = TEMPORAL_TIERS.WARM_MSGS;
      bucket = warmLines;
    } else {
      msgLimit = TEMPORAL_TIERS.COLD_MSGS;
      bucket = coldLines;
    }

    const slicedMsgs = conv.msgs.slice(0, msgLimit);
    const trimmed = conv.msgs.length > msgLimit;

    bucket.push(`--- ${conv.title} (${dateStr}) ---`);
    for (const msg of slicedMsgs) {
      const role = msg.role === 'user' ? 'Student' : 'Tutor';
      bucket.push(`  ${role}: ${truncate(msg.content, FAT_CONTEXT_LIMITS.MAX_MESSAGE_CHARS)}`);
    }
    if (trimmed) {
      bucket.push(`  [session continues — ${conv.msgs.length - msgLimit} more exchanges not shown]`);
    }
    bucket.push('');
  }

  const allLines: string[] = [];

  if (hotLines.length > 0) {
    allLines.push('Recent sessions (last 7 days):');
    allLines.push('');
    allLines.push(...hotLines);
  }
  if (warmLines.length > 0) {
    allLines.push('Sessions from a few weeks ago:');
    allLines.push('');
    allLines.push(...warmLines);
  }
  if (coldLines.length > 0) {
    allLines.push('Older sessions (brief excerpts):');
    allLines.push('');
    allLines.push(...coldLines);
  }

  if (allLines.length === 0) return '';

  return `These are your past sessions with this student. More recent ones are shown in fuller detail — they represent where things stand now. Reference them naturally when the student brings up related topics.

${allLines.join('\n')}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function formatFactType(type: string): string {
  const labels: Record<string, string> = {
    personal_detail: 'Personal',
    life_event: 'Life Events',
    goal: 'Goals',
    preference: 'Preferences',
    family: 'Family',
    travel: 'Travel',
    work: 'Work',
    hobby: 'Hobbies',
    relationship: 'Relationships',
    notable_mention: 'Notable',
  };
  return labels[type] || type;
}

function formatDateRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
