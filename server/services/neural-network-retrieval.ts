import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  languageIdioms,
  culturalNuances,
  learnerErrorPatterns,
  dialectVariations,
  linguisticBridges,
  type LanguageIdiom,
  type CulturalNuance,
  type LearnerErrorPattern,
  type DialectVariation,
  type LinguisticBridge,
} from "@shared/schema";

export interface NeuralNetworkContext {
  idioms: LanguageIdiom[];
  culturalNuances: CulturalNuance[];
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
  const [idioms, nuances, errors, dialects, bridges] = await Promise.all([
    // Random sample of idioms for variety
    db.select()
      .from(languageIdioms)
      .where(and(
        eq(languageIdioms.language, targetLanguage),
        eq(languageIdioms.isActive, true)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(limit),
    
    // Cultural nuances
    db.select()
      .from(culturalNuances)
      .where(and(
        eq(culturalNuances.language, targetLanguage),
        eq(culturalNuances.isActive, true)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(limit),
    
    // Error patterns for this language pair
    db.select()
      .from(learnerErrorPatterns)
      .where(and(
        eq(learnerErrorPatterns.targetLanguage, targetLanguage),
        eq(learnerErrorPatterns.sourceLanguage, nativeLanguage),
        eq(learnerErrorPatterns.isActive, true)
      ))
      .limit(limit),
    
    // Dialect variations
    db.select()
      .from(dialectVariations)
      .where(and(
        eq(dialectVariations.language, targetLanguage),
        eq(dialectVariations.isActive, true)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(limit),
    
    // Linguistic bridges
    db.select()
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
    idioms,
    culturalNuances: nuances,
    errorPatterns: errors,
    dialects,
    bridges,
  };
}

export function formatNeuralNetworkForPrompt(context: NeuralNetworkContext): string {
  const sections: string[] = [];
  
  // Format idioms
  if (context.idioms.length > 0) {
    const idiomLines = context.idioms.map(i => 
      `- "${i.idiom}" = ${i.meaning}${i.culturalContext ? ` (${i.culturalContext})` : ''}`
    ).join('\n');
    sections.push(`**Idioms You Know:**\n${idiomLines}`);
  }
  
  // Format cultural nuances
  if (context.culturalNuances.length > 0) {
    const nuanceLines = context.culturalNuances.map(n =>
      `- ${n.category}/${n.situation}: ${n.nuance}`
    ).join('\n');
    sections.push(`**Cultural Knowledge:**\n${nuanceLines}`);
  }
  
  // Format error patterns
  if (context.errorPatterns.length > 0) {
    const errorLines = context.errorPatterns.map(e => {
      const strategies = e.teachingStrategies?.slice(0, 2).join('; ') || '';
      return `- ${e.specificError}: ${e.whyItHappens?.substring(0, 100)}... [Strategies: ${strategies}]`;
    }).join('\n');
    sections.push(`**Common Learner Struggles (${context.errorPatterns[0]?.sourceLanguage}→${context.errorPatterns[0]?.targetLanguage}):**\n${errorLines}`);
  }
  
  // Format dialect variations
  if (context.dialects.length > 0) {
    const dialectLines = context.dialects.map(d =>
      `- ${d.region}: "${d.standardForm}" → "${d.regionalForm}" (${d.category})`
    ).join('\n');
    sections.push(`**Dialect Variations:**\n${dialectLines}`);
  }
  
  // Format linguistic bridges
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
  
  // Add action-oriented instructions so Daniela actively uses this knowledge
  // Cross-reference with Compass system for session-aware teaching
  const instructions = `
### Your Pedagogical Knowledge for This Language

**ACTIVE USE INSTRUCTIONS:**
You have specialized knowledge below that you MUST actively incorporate into your teaching:
- When learners make errors, reference your **Common Learner Struggles** to explain WHY and apply the teaching strategies
- Naturally weave **Idioms** into conversation when contextually appropriate - teach them!
- Use **Cultural Knowledge** to add depth and explain the "why" behind language patterns
- Mention **Dialect Variations** when relevant to give learners real-world awareness
- Leverage **Language Bridges** (especially cognates) to accelerate learning; WARN about false friends before they confuse the learner

**INTEGRATING WITH YOUR COMPASS (Session Awareness):**
- If your LIVE PACING shows you're ahead of schedule: Perfect time to teach an idiom or cultural insight!
- If a roadmap topic relates to your knowledge below (e.g., "greetings" → cultural formality norms), USE that knowledge
- If student goals mention "sound natural" or "conversational", prioritize idioms and dialect awareness
- If teaching a topic and you have a relevant Language Bridge or False Friend - proactively warn/teach it

This knowledge is YOUR expertise. Don't just observe it - teach with it!

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
