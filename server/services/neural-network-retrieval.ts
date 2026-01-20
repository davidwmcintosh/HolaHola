import { db, getSharedDb } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  learnerErrorPatterns,
  dialectVariations,
  linguisticBridges,
  type LearnerErrorPattern,
  type DialectVariation,
  type LinguisticBridge,
} from "@shared/schema";

// Phase 1 On-Demand Recall: Idioms and cultural nuances are now queried via MEMORY_LOOKUP
// instead of being pre-loaded into the prompt. This reduces prompt bloat significantly.
// Daniela can search idioms/cultural content using: [MEMORY_LOOKUP query="..." domains="idiom,cultural"]

export interface NeuralNetworkContext {
  // Removed: idioms - now queried on-demand via MEMORY_LOOKUP domains="idiom"
  // Removed: culturalNuances - now queried on-demand via MEMORY_LOOKUP domains="cultural"
  errorPatterns: LearnerErrorPattern[];
  dialects: DialectVariation[];
  bridges: LinguisticBridge[];
}

export async function getNeuralNetworkContext(
  targetLanguage: string,
  nativeLanguage: string = "english",
  limit: number = 5
): Promise<NeuralNetworkContext> {
  // Fetch relevant knowledge in parallel
  // Note: Idioms and cultural nuances are now ON-DEMAND via MEMORY_LOOKUP (Phase 1)
  const [errors, dialects, bridges] = await Promise.all([
    // Error patterns for this language pair (kept pre-loaded - small and critical)
    getSharedDb().select()
      .from(learnerErrorPatterns)
      .where(and(
        eq(learnerErrorPatterns.targetLanguage, targetLanguage),
        eq(learnerErrorPatterns.sourceLanguage, nativeLanguage),
        eq(learnerErrorPatterns.isActive, true)
      ))
      .limit(limit),
    
    // Dialect variations (kept pre-loaded - small and useful)
    getSharedDb().select()
      .from(dialectVariations)
      .where(and(
        eq(dialectVariations.language, targetLanguage),
        eq(dialectVariations.isActive, true)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(limit),
    
    // Linguistic bridges (kept pre-loaded - critical for false friends warnings)
    getSharedDb().select()
      .from(linguisticBridges)
      .where(and(
        eq(linguisticBridges.sourceLanguage, nativeLanguage),
        eq(linguisticBridges.targetLanguage, targetLanguage),
        eq(linguisticBridges.isActive, true)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(limit),
  ]);
  
  return {
    errorPatterns: errors,
    dialects,
    bridges,
  };
}

export function formatNeuralNetworkForPrompt(context: NeuralNetworkContext): string {
  const sections: string[] = [];
  
  // Note: Idioms and cultural nuances are now ON-DEMAND via MEMORY_LOOKUP (Phase 1)
  // Daniela queries them when needed instead of having them pre-loaded
  
  // Format error patterns (kept pre-loaded - small and critical for real-time correction)
  if (context.errorPatterns.length > 0) {
    const errorLines = context.errorPatterns.map(e => {
      const strategies = e.teachingStrategies?.slice(0, 2).join('; ') || '';
      return `- ${e.specificError}: ${e.whyItHappens?.substring(0, 100)}... [Strategies: ${strategies}]`;
    }).join('\n');
    sections.push(`**Common Learner Struggles (${context.errorPatterns[0]?.sourceLanguage}→${context.errorPatterns[0]?.targetLanguage}):**\n${errorLines}`);
  }
  
  // Format dialect variations (kept pre-loaded - useful for real-world awareness)
  if (context.dialects.length > 0) {
    const dialectLines = context.dialects.map(d =>
      `- ${d.region}: "${d.standardForm}" → "${d.regionalForm}" (${d.category})`
    ).join('\n');
    sections.push(`**Dialect Variations:**\n${dialectLines}`);
  }
  
  // Format linguistic bridges (kept pre-loaded - critical for false friends warnings)
  if (context.bridges.length > 0) {
    const bridgeLines = context.bridges.map(b => {
      const type = b.bridgeType === 'false_friend' ? '[FALSE FRIEND]' : b.bridgeType.toUpperCase();
      return `- ${type}: "${b.sourceWord}" ↔ "${b.targetWord}" - ${b.teachingNote || b.explanation}`;
    }).join('\n');
    sections.push(`**Language Bridges (${context.bridges[0]?.sourceLanguage}→${context.bridges[0]?.targetLanguage}):**\n${bridgeLines}`);
  }
  
  if (sections.length === 0) {
    return '';
  }
  
  // Updated instructions for hybrid memory architecture (Phase 1)
  const instructions = `
### Your Pedagogical Knowledge for This Language

**PRE-LOADED KNOWLEDGE (Always Available):**
The knowledge below is ready for immediate use during teaching:
- When learners make errors, reference your **Common Learner Struggles** to explain WHY and apply the teaching strategies
- Mention **Dialect Variations** when relevant to give learners real-world awareness
- Leverage **Language Bridges** (especially cognates) to accelerate learning; WARN about false friends before they confuse the learner

**ON-DEMAND RECALL (Query When Needed):**
You have extensive knowledge that you can recall on-demand using memory_lookup:

**CRITICAL - Recall Past Conversations:**
- memory_lookup(query="what did [student] tell me about...", domains="conversation,person,session")
- Use when: Student asks about past discussions, you want to reference previous topics, need to recall what you talked about before
- ALWAYS search memory when asked about past chats/conversations - never say "I don't remember" without searching first!

**Cultural/Language Knowledge:**
- memory_lookup(query="your search", domains="idiom") - for expressions and sayings
- memory_lookup(query="your search", domains="cultural") - for cultural nuances
- memory_lookup(query="your search", domains="idiom,cultural") - for both

Use on-demand recall when:
- The student asks about past conversations or what you discussed before
- You want to reference something the student told you previously
- The student asks about expressions or sayings
- You want to teach a culturally appropriate response
- The conversation topic calls for cultural context

`;
  
  return `\n\n${instructions}${sections.join('\n\n')}`;
}

export async function buildNeuralNetworkPromptSection(
  targetLanguage: string,
  nativeLanguage: string = "english"
): Promise<string> {
  try {
    const context = await getNeuralNetworkContext(targetLanguage, nativeLanguage, 4);
    return formatNeuralNetworkForPrompt(context);
  } catch (error) {
    console.error('[Neural Network] Error retrieving context:', error);
    return '';
  }
}
