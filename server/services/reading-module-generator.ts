/**
 * Reading Module Generator
 *
 * Orchestrates the four-stage content generation pipeline:
 * 1. OpenStax seed content (CC BY 4.0, NGSS/C3-aligned)
 * 2. Claude structured generation (Anthropic)
 * 3. Perplexity citation enrichment
 * 4. Wolfram LLM fact verification (biology-primary)
 *
 * Generated modules are stored permanently. Subsequent requests
 * return the cached DB version with zero latency.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSharedDb } from '../db';
import { readingModules, type ReadingModule, type ReadingModuleContent } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { fetchSeedAndImages } from './openstax-content-service';
import { addCitations } from './perplexity-citation-service';
import { verifyFact, extractVerifiableClaims } from './wolfram-fact-service';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert curriculum writer creating reading modules for high school students. 
Your output must be valid JSON matching exactly the schema provided.
Write at an engaging but clear level — like a knowledgeable tutor, not a textbook.
Be concise. Students should be able to read each module in 5-8 minutes.`;

function buildUserPrompt(topic: string, subject: string, seedContent: string): string {
  const seedSection = seedContent
    ? `\n\nUse this OpenStax textbook content as your primary source and grounding material:\n<openstax_content>\n${seedContent}\n</openstax_content>\n`
    : '';

  return `Create a reading module for the topic: "${topic}" (subject: ${subject}).${seedSection}

Return a JSON object with exactly this structure:
{
  "overview": "2-3 sentence explanation of what this topic is and why it matters",
  "keyConcepts": ["concept 1", "concept 2", "concept 3", "concept 4", "concept 5"],
  "keyTerms": [
    { "term": "term name", "definition": "plain-language definition" }
  ],
  "misconceptions": ["common mistake 1", "common mistake 2"],
  "framingQuestions": [
    "Open question to explore with tutor 1",
    "Open question to explore with tutor 2"
  ],
  "recallCheck": [
    { "question": "factual recall question", "answer": "correct answer" }
  ],
  "citations": []
}

Rules:
- keyConcepts: 4-6 items
- keyTerms: 6-10 terms with plain-language definitions students can actually understand
- misconceptions: 2-3 things students commonly get wrong about this topic
- framingQuestions: 2-3 open-ended questions designed for Socratic discussion with a tutor
- recallCheck: 4-6 factual questions with clear, concise answers
- citations: leave as empty array — citations are added in a later stage
- Do not include any text outside the JSON object`;
}

async function generateWithClaude(
  topic: string,
  subject: string,
  seedContent: string
): Promise<ReadingModuleContent> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(topic, subject, seedContent),
      },
    ],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('[ReadingModuleGenerator] Claude returned no text block');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('[ReadingModuleGenerator] Claude response contained no JSON object');
  }

  const parsed = JSON.parse(jsonMatch[0]) as ReadingModuleContent;
  parsed.citations = parsed.citations ?? [];
  return parsed;
}

function contentToText(content: ReadingModuleContent): string {
  const parts = [
    content.overview,
    content.keyConcepts.join(' '),
    content.keyTerms.map(t => `${t.term}: ${t.definition}`).join(' '),
    content.misconceptions.join(' '),
    content.recallCheck.map(r => `${r.question} ${r.answer}`).join(' '),
  ];
  return parts.join('\n\n');
}

async function runPipeline(topic: string, subject: string): Promise<ReadingModuleContent> {
  console.info(`[ReadingModuleGenerator] Starting pipeline for "${topic}" (${subject})`);

  const { text: seedContent, images } = await fetchSeedAndImages(topic, subject as 'biology' | 'history');
  if (seedContent) {
    console.info(`[ReadingModuleGenerator] Wikipedia seed: ${seedContent.length} chars`);
  }
  console.info(`[ReadingModuleGenerator] Wikipedia images: ${images.length}`);

  const rawContent = await generateWithClaude(topic, subject, seedContent);
  console.info('[ReadingModuleGenerator] Claude generation complete');

  rawContent.images = images;

  const plainText = contentToText(rawContent);
  const { enrichedContent, citations } = await addCitations(plainText, subject);
  rawContent.citations = citations;
  console.info(`[ReadingModuleGenerator] Perplexity citations: ${citations.length} added`);

  if (subject === 'biology' || subject === 'history') {
    const claims = extractVerifiableClaims(enrichedContent, subject);
    for (const claim of claims) {
      const { answer, verified } = await verifyFact(claim);
      if (verified) {
        console.info(`[ReadingModuleGenerator] Wolfram verified: "${claim}" → "${answer.slice(0, 80)}"`);
      }
    }
  }

  return rawContent;
}

export async function generateReadingModule(
  topic: string,
  subject: string
): Promise<ReadingModule> {
  const db = getSharedDb();

  const content = await runPipeline(topic, subject);

  const [inserted] = await db
    .insert(readingModules)
    .values({ subjectDomain: subject, topic, content })
    .onConflictDoUpdate({
      target: [readingModules.subjectDomain, readingModules.topic],
      set: {
        content,
        generatedAt: new Date(),
        version: 1,
      },
    })
    .returning();

  console.info(`[ReadingModuleGenerator] Stored module for "${topic}" (${subject}) — id: ${inserted.id}`);
  return inserted;
}

export async function getOrGenerateModule(
  topic: string,
  subject: string
): Promise<ReadingModule> {
  const db = getSharedDb();

  const existing = await db
    .select()
    .from(readingModules)
    .where(
      and(
        eq(readingModules.subjectDomain, subject),
        eq(readingModules.topic, topic)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.info(`[ReadingModuleGenerator] Cache hit for "${topic}" (${subject})`);
    return existing[0];
  }

  return generateReadingModule(topic, subject);
}
