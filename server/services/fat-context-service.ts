import { eq, and, desc, isNull, or, sql, isNotNull } from "drizzle-orm";
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
} from "@shared/schema";

const RECEPTIONIST_ROSTER: Record<string, { female: string; male: string; label: string }> = {
  spanish:    { female: 'Daniela (you)',  male: 'Agustín',  label: 'Spanish' },
  french:     { female: 'Juliette',       male: 'Vincent',  label: 'French' },
  german:     { female: 'Greta',          male: 'Lukas',    label: 'German' },
  italian:    { female: 'Valentina',      male: 'Luca',     label: 'Italian' },
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
};

interface FatContextResult {
  personalProfileSection: string;
  vocabularySection: string;
  recentConversationsSection: string;
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

  const totalChars = personalProfileSection.length + vocabularySection.length + recentConversationsSection.length;
  const totalTokenEstimate = Math.ceil(totalChars / 4);

  console.log(`[Fat Context] Built in ${Date.now() - start}ms: ${factsResult.length} facts, ${insightsResult.length} insights, ${strugglesResult.length} struggles, ${motivationsResult.length} motivations, ${peopleResult.length} people, ${vocabResult.length} vocab, ${conversationsResult.length} convos (${totalMsgCount} msgs) = ~${totalTokenEstimate} tokens`);

  return {
    personalProfileSection,
    vocabularySection,
    recentConversationsSection,
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
    },
  };
}

function buildRoutingContext(
  studiedLanguages: string[],
  savedLanguage: string | null,
  savedGender: string,
): string {
  const rosterLines = Object.entries(RECEPTIONIST_ROSTER)
    .filter(([lang]) => lang !== 'mandarin') // deduplicate mandarin/chinese
    .map(([lang, { female, male, label }]) => {
      const isYou = lang === 'spanish';
      const femaleName = female;
      const maleName = male;
      if (isYou) {
        return `  • Spanish: ${femaleName} — that's you (female) | Agustín (male)`;
      }
      return `  • ${label}: ${femaleName} (female) | ${maleName} (male) → switch_tutor(target:"female"/"male", language:"${lang}")`;
    });

  const savedTutor = savedLanguage
    ? RECEPTIONIST_ROSTER[savedLanguage.toLowerCase()]
    : null;
  const savedTutorName = savedTutor
    ? (savedGender === 'male' ? savedTutor.male : savedTutor.female)
    : null;
  const savedTutorLabel = savedTutor?.label ?? null;

  const isNewStudent = studiedLanguages.length === 0;
  const hasMultipleLanguages = studiedLanguages.length > 1;
  const savedIsYou = savedLanguage?.toLowerCase() === 'spanish' && savedGender === 'female';

  let studentProfile = '';
  if (isNewStudent) {
    studentProfile = '  • New student — no language history yet. Ask what language they want to learn.';
  } else if (studiedLanguages.length === 1) {
    const lang = studiedLanguages[0];
    const entry = RECEPTIONIST_ROSTER[lang];
    studentProfile = `  • Studies: ${entry ? entry.label : lang}`;
    if (savedTutorName) {
      studentProfile += ` — saved preference: ${savedTutorName} (${savedGender})`;
    }
  } else {
    studentProfile = `  • Studies multiple languages: ${studiedLanguages.map(l => RECEPTIONIST_ROSTER[l]?.label ?? l).join(', ')}`;
    if (savedTutorName) {
      studentProfile += `\n  • Current saved preference: ${savedTutorName} — ${savedTutorLabel} (${savedGender})`;
    }
  }

  let routingRules = '';
  if (isNewStudent) {
    routingRules = `ROUTING: This student is new. Greet warmly, ask what language they'd like to learn, then ask female or male voice preference. Call switch_tutor if the destination isn't you (Spanish/female).`;
  } else if (savedTutorName && !savedIsYou) {
    routingRules = `ROUTING: This student has a saved preference — ${savedTutorName} for ${savedTutorLabel}. Greet them warmly by name, say one brief line, then immediately call switch_tutor(target:"${savedGender}", language:"${savedLanguage?.toLowerCase()}"). Do NOT ask routing questions.`;
  } else if (savedIsYou) {
    routingRules = `ROUTING: This student's saved preference is you — Spanish with Daniela. Skip routing entirely. Just greet them and begin the session naturally.`;
  } else if (hasMultipleLanguages) {
    const options = studiedLanguages
      .map(l => {
        const e = RECEPTIONIST_ROSTER[l];
        return e ? `${e.label} (${e.female} or ${e.male})` : l;
      })
      .join(', ');
    routingRules = `ROUTING: This student studies multiple languages. Ask warmly which one today: ${options}. When they choose, route immediately.`;
  } else {
    routingRules = `ROUTING: Single language student. Confirm you're ready to practice together and begin.`;
  }

  return `[RECEPTIONIST BRIEFING — Session Start Routing]

You are Daniela. You are ALWAYS the first voice a student hears. Your role at session start: warmly greet the student and route them to the right tutor — which may be you (Spanish) or a specialist in another language. Always be yourself — warm, witty, present. The routing is just the opening move.

TUTOR ROSTER — use switch_tutor() to hand off:
${rosterLines.join('\n')}

THIS STUDENT'S ROUTING PROFILE:
${studentProfile}

${routingRules}

STANDING RULE: If a student says "always send me to [tutor]" or "make [tutor] my default", call switch_tutor(target: gender, language: lang, make_permanent: true). This saves the preference permanently AND routes them now. Confirm warmly: "Done — I'll always connect you to [name] from now on."

SESSION MODES — student can request these at any time, for any tutor (including you):
  • tutor_mode (default) — normal language learning session
  • founder_mode — English-first product/strategy discussion, you act as a collaborative team member rather than a tutor. Deep work mode.
  • honesty_mode — minimal prompting, raw authentic conversation. You hold back the scaffolding and let the student lead.
Example requests: "call Greta in Founder Mode", "connect me to Cindy in Honesty Mode", "switch to Founder Mode" (same tutor)
When mode is requested: include mode param in switch_tutor call → switch_tutor(target:"female", language:"german", mode:"founder_mode")`;
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
    const grouped: Record<string, string[]> = {};
    for (const f of facts) {
      const type = f.factType || 'other';
      if (!grouped[type]) grouped[type] = [];
      const dateSuffix = f.relevantDate && new Date(f.relevantDate) > new Date()
        ? ` (${new Date(f.relevantDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
        : '';
      grouped[type].push(truncate(f.fact, FAT_CONTEXT_LIMITS.MAX_FACT_CHARS) + dateSuffix);
    }

    const factLines: string[] = [];
    for (const [type, items] of Object.entries(grouped)) {
      factLines.push(`  ${formatFactType(type)}:`);
      for (const item of items) {
        factLines.push(`    - ${item}`);
      }
    }
    sections.push(`Personal Facts (${facts.length} remembered details):\n${factLines.join('\n')}`);
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

  const lines: string[] = [];
  for (const conv of convos) {
    if (conv.msgs.length === 0) continue;

    const dateStr = formatDateRelative(conv.date);
    lines.push(`--- ${conv.title} (${dateStr}) ---`);
    for (const msg of conv.msgs) {
      const role = msg.role === 'user' ? 'Student' : 'Tutor';
      lines.push(`  ${role}: ${truncate(msg.content, FAT_CONTEXT_LIMITS.MAX_MESSAGE_CHARS)}`);
    }
    lines.push('');
  }

  if (lines.length === 0) return '';

  return `[RECENT CONVERSATION HISTORY — Perfect Recall of Recent Sessions]
You remember these recent conversations in full detail. Reference them naturally
when the student brings up related topics. This gives you continuity across sessions.

${lines.join('\n')}`;
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
