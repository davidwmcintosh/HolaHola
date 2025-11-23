/**
 * ACTFL Can-Do Statements for Language Proficiency
 * Based on NCSSFL-ACTFL Can-Do Statements (2017) and ACTFL Proficiency Guidelines 2024
 * 
 * Comprehensive implementation for all 9 supported languages:
 * Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese (Mandarin), English
 * 
 * Proficiency Levels: Novice (Low, Mid, High), Intermediate (Low, Mid, High), Advanced (Low, Mid, High)
 * Communication Modes: Interpersonal, Interpretive, Presentational
 */

export interface CanDoStatement {
  language: string;
  actflLevel: string; // Internal format: "novice_low", "intermediate_mid", etc.
  category: 'interpersonal' | 'interpretive' | 'presentational';
  statement: string;
  examples?: string[];
}

/**
 * Helper function to create Can-Do statements for a language
 */
function createCanDoStatements(language: string): CanDoStatement[] {
  const statements: CanDoStatement[] = [];
  
  // NOVICE LOW - "I can communicate on very familiar topics using words and phrases"
  statements.push(
    // Interpersonal
    { language, actflLevel: 'novice_low', category: 'interpersonal', statement: 'I can greet and leave people in a polite way' },
    { language, actflLevel: 'novice_low', category: 'interpersonal', statement: 'I can introduce myself to someone' },
    { language, actflLevel: 'novice_low', category: 'interpersonal', statement: 'I can answer simple questions about my preferences' },
    { language, actflLevel: 'novice_low', category: 'interpersonal', statement: 'I can say simple courtesy phrases' },
    { language, actflLevel: 'novice_low', category: 'interpersonal', statement: 'I can state the names of familiar people, places, and objects' },
    // Interpretive
    { language, actflLevel: 'novice_low', category: 'interpretive', statement: 'I can recognize familiar words and phrases about daily activities' },
    { language, actflLevel: 'novice_low', category: 'interpretive', statement: 'I can recognize numbers in authentic materials' },
    { language, actflLevel: 'novice_low', category: 'interpretive', statement: 'I can recognize familiar names, words, and phrases' },
    { language, actflLevel: 'novice_low', category: 'interpretive', statement: 'I can understand simple questions' },
    // Presentational
    { language, actflLevel: 'novice_low', category: 'presentational', statement: 'I can present information about myself using words and phrases' },
    { language, actflLevel: 'novice_low', category: 'presentational', statement: 'I can express my likes and dislikes using memorized phrases' },
    { language, actflLevel: 'novice_low', category: 'presentational', statement: 'I can list family members, friends, and familiar people' },
    { language, actflLevel: 'novice_low', category: 'presentational', statement: 'I can present simple information about objects in my environment' },
    
    // NOVICE MID - "I can communicate on very familiar topics using memorized words and phrases"
    // Interpersonal
    { language, actflLevel: 'novice_mid', category: 'interpersonal', statement: 'I can request and provide information in conversations on familiar topics' },
    { language, actflLevel: 'novice_mid', category: 'interpersonal', statement: 'I can interact with others in everyday situations' },
    { language, actflLevel: 'novice_mid', category: 'interpersonal', statement: 'I can make simple purchases' },
    { language, actflLevel: 'novice_mid', category: 'interpersonal', statement: 'I can order a meal' },
    { language, actflLevel: 'novice_mid', category: 'interpersonal', statement: 'I can ask and answer simple questions on very familiar topics' },
    // Interpretive
    { language, actflLevel: 'novice_mid', category: 'interpretive', statement: 'I can understand simple information when reading' },
    { language, actflLevel: 'novice_mid', category: 'interpretive', statement: 'I can understand simple conversations on familiar topics' },
    { language, actflLevel: 'novice_mid', category: 'interpretive', statement: 'I can identify the main idea in short, simple messages and presentations' },
    { language, actflLevel: 'novice_mid', category: 'interpretive', statement: 'I can recognize words on a list on familiar topics' },
    // Presentational
    { language, actflLevel: 'novice_mid', category: 'presentational', statement: 'I can write lists and memorized phrases on familiar topics' },
    { language, actflLevel: 'novice_mid', category: 'presentational', statement: 'I can present information about my life using phrases and simple sentences' },
    { language, actflLevel: 'novice_mid', category: 'presentational', statement: 'I can present information about my daily activities' },
    { language, actflLevel: 'novice_mid', category: 'presentational', statement: 'I can present simple information about something I learned' },
    
    // NOVICE HIGH - "I can communicate and exchange information about familiar topics"
    // Interpersonal
    { language, actflLevel: 'novice_high', category: 'interpersonal', statement: 'I can have a simple conversation on familiar topics' },
    { language, actflLevel: 'novice_high', category: 'interpersonal', statement: 'I can exchange information about myself and others' },
    { language, actflLevel: 'novice_high', category: 'interpersonal', statement: 'I can ask for and give simple directions' },
    { language, actflLevel: 'novice_high', category: 'interpersonal', statement: 'I can interact with others in everyday situations' },
    { language, actflLevel: 'novice_high', category: 'interpersonal', statement: 'I can express my preferences in everyday situations' },
    // Interpretive
    { language, actflLevel: 'novice_high', category: 'interpretive', statement: 'I can understand simple statements and questions on everyday topics' },
    { language, actflLevel: 'novice_high', category: 'interpretive', statement: 'I can understand basic information in short video clips or presentations' },
    { language, actflLevel: 'novice_high', category: 'interpretive', statement: 'I can understand the main idea of simple conversations' },
    { language, actflLevel: 'novice_high', category: 'interpretive', statement: 'I can understand familiar questions and statements in simple texts' },
    // Presentational
    { language, actflLevel: 'novice_high', category: 'presentational', statement: 'I can present personal information about my life, activities and events' },
    { language, actflLevel: 'novice_high', category: 'presentational', statement: 'I can present on familiar topics using a series of simple sentences' },
    { language, actflLevel: 'novice_high', category: 'presentational', statement: 'I can write about people and things in my environment' },
    { language, actflLevel: 'novice_high', category: 'presentational', statement: 'I can write short messages and notes on familiar topics' },
    
    // INTERMEDIATE LOW - "I can participate in conversations on familiar topics using sentences and series of sentences"
    // Interpersonal
    { language, actflLevel: 'intermediate_low', category: 'interpersonal', statement: 'I can have a simple conversation on predictable topics' },
    { language, actflLevel: 'intermediate_low', category: 'interpersonal', statement: 'I can participate in conversations on familiar topics' },
    { language, actflLevel: 'intermediate_low', category: 'interpersonal', statement: 'I can exchange information using texts, graphs, or pictures' },
    { language, actflLevel: 'intermediate_low', category: 'interpersonal', statement: 'I can talk about my daily activities and personal preferences' },
    { language, actflLevel: 'intermediate_low', category: 'interpersonal', statement: 'I can interact with others in familiar situations' },
    // Interpretive
    { language, actflLevel: 'intermediate_low', category: 'interpretive', statement: 'I can understand the main idea of short, simple conversations and presentations' },
    { language, actflLevel: 'intermediate_low', category: 'interpretive', statement: 'I can understand the main idea of simple texts on familiar topics' },
    { language, actflLevel: 'intermediate_low', category: 'interpretive', statement: 'I can understand simple announcements and messages' },
    { language, actflLevel: 'intermediate_low', category: 'interpretive', statement: 'I can identify the main idea in advertisements and announcements' },
    // Presentational
    { language, actflLevel: 'intermediate_low', category: 'presentational', statement: 'I can make a presentation on a familiar topic using sentences' },
    { language, actflLevel: 'intermediate_low', category: 'presentational', statement: 'I can write on topics related to school, work, and community' },
    { language, actflLevel: 'intermediate_low', category: 'presentational', statement: 'I can state my viewpoint about familiar topics and give some reasons' },
    { language, actflLevel: 'intermediate_low', category: 'presentational', statement: 'I can write messages and announcements' },
    
    // INTERMEDIATE MID - "I can participate in conversations on familiar topics and some researched topics"
    // Interpersonal
    { language, actflLevel: 'intermediate_mid', category: 'interpersonal', statement: 'I can participate in spontaneous conversations on familiar topics' },
    { language, actflLevel: 'intermediate_mid', category: 'interpersonal', statement: 'I can exchange information about academic and workplace topics' },
    { language, actflLevel: 'intermediate_mid', category: 'interpersonal', statement: 'I can handle short social interactions in everyday situations' },
    { language, actflLevel: 'intermediate_mid', category: 'interpersonal', statement: 'I can exchange preferences, feelings, and opinions on familiar topics' },
    { language, actflLevel: 'intermediate_mid', category: 'interpersonal', statement: 'I can ask and answer a variety of questions' },
    // Interpretive
    { language, actflLevel: 'intermediate_mid', category: 'interpretive', statement: 'I can understand the main idea and some details on familiar topics from sentences and series of connected sentences' },
    { language, actflLevel: 'intermediate_mid', category: 'interpretive', statement: 'I can understand the main idea of conversations in authentic media' },
    { language, actflLevel: 'intermediate_mid', category: 'interpretive', statement: 'I can identify the sequence of events in a story' },
    { language, actflLevel: 'intermediate_mid', category: 'interpretive', statement: 'I can understand short video clips or presentations on familiar topics' },
    // Presentational
    { language, actflLevel: 'intermediate_mid', category: 'presentational', statement: 'I can tell or write about events in various time frames' },
    { language, actflLevel: 'intermediate_mid', category: 'presentational', statement: 'I can make a presentation on familiar topics using connected sentences' },
    { language, actflLevel: 'intermediate_mid', category: 'presentational', statement: 'I can express my preferences on familiar and everyday topics and give reasons' },
    { language, actflLevel: 'intermediate_mid', category: 'presentational', statement: 'I can write messages and announcements for an authentic audience' },
    
    // INTERMEDIATE HIGH - "I can participate in conversations on familiar and some unfamiliar topics"
    // Interpersonal
    { language, actflLevel: 'intermediate_high', category: 'interpersonal', statement: 'I can communicate in conversation and some discussions on familiar topics' },
    { language, actflLevel: 'intermediate_high', category: 'interpersonal', statement: 'I can exchange information and ideas on academic and career topics' },
    { language, actflLevel: 'intermediate_high', category: 'interpersonal', statement: 'I can handle a situation with an unexpected complication' },
    { language, actflLevel: 'intermediate_high', category: 'interpersonal', statement: 'I can interact in a wide variety of situations with some complications' },
    { language, actflLevel: 'intermediate_high', category: 'interpersonal', statement: 'I can discuss and compare preferences and opinions on familiar topics' },
    // Interpretive
    { language, actflLevel: 'intermediate_high', category: 'interpretive', statement: 'I can follow stories and descriptions of some length on familiar and general interest topics' },
    { language, actflLevel: 'intermediate_high', category: 'interpretive', statement: 'I can understand the main idea and supporting details on familiar topics' },
    { language, actflLevel: 'intermediate_high', category: 'interpretive', statement: 'I can identify the main idea and some supporting details in various time frames' },
    { language, actflLevel: 'intermediate_high', category: 'interpretive', statement: 'I can follow stories and general topics of interest' },
    // Presentational
    { language, actflLevel: 'intermediate_high', category: 'presentational', statement: 'I can present information on most familiar topics with sufficient details' },
    { language, actflLevel: 'intermediate_high', category: 'presentational', statement: 'I can write on a wide variety of familiar topics using connected paragraphs' },
    { language, actflLevel: 'intermediate_high', category: 'presentational', statement: 'I can state and support my viewpoint on familiar topics and issues' },
    { language, actflLevel: 'intermediate_high', category: 'presentational', statement: 'I can write detailed descriptions, summaries, and reports on familiar topics' },
    
    // ADVANCED LOW - "I can participate in conversations on familiar and some unfamiliar concrete topics"
    // Interpersonal
    { language, actflLevel: 'advanced_low', category: 'interpersonal', statement: 'I can participate in conversations and some discussions on a variety of familiar topics' },
    { language, actflLevel: 'advanced_low', category: 'interpersonal', statement: 'I can exchange information and ideas in academic and professional settings' },
    { language, actflLevel: 'advanced_low', category: 'interpersonal', statement: 'I can handle a complicated or unfamiliar situation' },
    { language, actflLevel: 'advanced_low', category: 'interpersonal', statement: 'I can present and explain my opinion on a variety of familiar and some unfamiliar topics' },
    { language, actflLevel: 'advanced_low', category: 'interpersonal', statement: 'I can discuss and compare viewpoints on a variety of familiar topics' },
    // Interpretive
    { language, actflLevel: 'advanced_low', category: 'interpretive', statement: 'I can understand the main message and supporting details on familiar and general interest topics' },
    { language, actflLevel: 'advanced_low', category: 'interpretive', statement: 'I can follow stories and descriptions of considerable length across various time frames' },
    { language, actflLevel: 'advanced_low', category: 'interpretive', statement: 'I can understand different viewpoints on familiar and general interest topics' },
    { language, actflLevel: 'advanced_low', category: 'interpretive', statement: 'I can identify the main idea and most supporting details in organized texts' },
    // Presentational
    { language, actflLevel: 'advanced_low', category: 'presentational', statement: 'I can deliver detailed presentations and reports on familiar topics' },
    { language, actflLevel: 'advanced_low', category: 'presentational', statement: 'I can write on a wide variety of topics using detailed, organized paragraphs' },
    { language, actflLevel: 'advanced_low', category: 'presentational', statement: 'I can present with clarity and detail on a variety of familiar and some unfamiliar topics' },
    { language, actflLevel: 'advanced_low', category: 'presentational', statement: 'I can write clear, detailed, and organized texts on a variety of familiar topics' },
    
    // ADVANCED MID - "I can participate in conversations on familiar and unfamiliar concrete topics"
    // Interpersonal
    { language, actflLevel: 'advanced_mid', category: 'interpersonal', statement: 'I can participate in discussions on a variety of familiar and some unfamiliar topics' },
    { language, actflLevel: 'advanced_mid', category: 'interpersonal', statement: 'I can exchange complex information in professional and academic settings' },
    { language, actflLevel: 'advanced_mid', category: 'interpersonal', statement: 'I can express and support my opinion on concrete and abstract topics' },
    { language, actflLevel: 'advanced_mid', category: 'interpersonal', statement: 'I can discuss and compare different viewpoints on complex issues' },
    { language, actflLevel: 'advanced_mid', category: 'interpersonal', statement: 'I can handle a complication or an unexpected turn of events' },
    // Interpretive
    { language, actflLevel: 'advanced_mid', category: 'interpretive', statement: 'I can understand the main message and most supporting details across various time frames' },
    { language, actflLevel: 'advanced_mid', category: 'interpretive', statement: 'I can follow extended discourse on a wide variety of general interest topics' },
    { language, actflLevel: 'advanced_mid', category: 'interpretive', statement: 'I can understand different viewpoints and their implications' },
    { language, actflLevel: 'advanced_mid', category: 'interpretive', statement: 'I can infer meaning from context on unfamiliar topics' },
    // Presentational
    { language, actflLevel: 'advanced_mid', category: 'presentational', statement: 'I can deliver clear and detailed presentations on a variety of topics' },
    { language, actflLevel: 'advanced_mid', category: 'presentational', statement: 'I can write well-organized texts on concrete and some abstract topics' },
    { language, actflLevel: 'advanced_mid', category: 'presentational', statement: 'I can present and support my viewpoint on complex issues' },
    { language, actflLevel: 'advanced_mid', category: 'presentational', statement: 'I can write detailed narratives, descriptions, and reports across time frames' },
    
    // ADVANCED HIGH - "I can participate in conversations and discussions on concrete and abstract topics"
    // Interpersonal
    { language, actflLevel: 'advanced_high', category: 'interpersonal', statement: 'I can discuss and debate concrete and abstract topics with fluency' },
    { language, actflLevel: 'advanced_high', category: 'interpersonal', statement: 'I can exchange complex information in professional, academic, and social settings' },
    { language, actflLevel: 'advanced_high', category: 'interpersonal', statement: 'I can discuss and evaluate diverse perspectives on complex issues' },
    { language, actflLevel: 'advanced_high', category: 'interpersonal', statement: 'I can resolve conflicts and negotiate solutions effectively' },
    { language, actflLevel: 'advanced_high', category: 'interpersonal', statement: 'I can communicate effectively in unfamiliar and complex situations' },
    // Interpretive
    { language, actflLevel: 'advanced_high', category: 'interpretive', statement: 'I can understand complex texts on concrete and abstract topics across time frames' },
    { language, actflLevel: 'advanced_high', category: 'interpretive', statement: 'I can follow extended discourse in academic and professional contexts' },
    { language, actflLevel: 'advanced_high', category: 'interpretive', statement: 'I can understand nuanced viewpoints and cultural implications' },
    { language, actflLevel: 'advanced_high', category: 'interpretive', statement: 'I can infer meaning and interpret complex texts confidently' },
    // Presentational
    { language, actflLevel: 'advanced_high', category: 'presentational', statement: 'I can deliver sophisticated presentations on complex topics' },
    { language, actflLevel: 'advanced_high', category: 'presentational', statement: 'I can write well-structured texts on concrete and abstract topics across time frames' },
    { language, actflLevel: 'advanced_high', category: 'presentational', statement: 'I can present and defend arguments on complex issues with supporting evidence' },
    { language, actflLevel: 'advanced_high', category: 'presentational', statement: 'I can write professional and academic texts with clarity and cohesion' }
  );
  
  return statements;
}

/**
 * All Can-Do Statements for 9 supported languages
 */
export const canDoStatements: CanDoStatement[] = [
  ...createCanDoStatements('spanish'),
  ...createCanDoStatements('french'),
  ...createCanDoStatements('german'),
  ...createCanDoStatements('italian'),
  ...createCanDoStatements('portuguese'),
  ...createCanDoStatements('japanese'),
  ...createCanDoStatements('korean'),
  ...createCanDoStatements('mandarin'),
  ...createCanDoStatements('english'),
];

/**
 * Get Can-Do Statements by language and level
 */
export function getCanDoStatements(language: string, actflLevel: string): CanDoStatement[] {
  return canDoStatements.filter(
    stmt => stmt.language === language && stmt.actflLevel === actflLevel
  );
}

/**
 * Get all Can-Do Statements for a language (all levels)
 */
export function getCanDoStatementsByLanguage(language: string): CanDoStatement[] {
  return canDoStatements.filter(stmt => stmt.language === language);
}

/**
 * Get Can-Do Statements by category (communication mode)
 */
export function getCanDoStatementsByCategory(
  language: string,
  actflLevel: string,
  category: 'interpersonal' | 'interpretive' | 'presentational'
): CanDoStatement[] {
  return canDoStatements.filter(
    stmt => stmt.language === language && stmt.actflLevel === actflLevel && stmt.category === category
  );
}

/**
 * Get all ACTFL levels available for a language
 */
export function getAvailableActflLevels(language: string): string[] {
  const levels = new Set(
    canDoStatements
      .filter(stmt => stmt.language === language)
      .map(stmt => stmt.actflLevel)
  );
  return Array.from(levels);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  const languages = new Set(canDoStatements.map(stmt => stmt.language));
  return Array.from(languages);
}

/**
 * Statistics for Can-Do Statements coverage
 */
export function getCanDoStatementStats() {
  const languages = getSupportedLanguages();
  const stats = languages.map(lang => ({
    language: lang,
    totalStatements: canDoStatements.filter(s => s.language === lang).length,
    levels: getAvailableActflLevels(lang).length,
    byLevel: getAvailableActflLevels(lang).map(level => ({
      level,
      count: canDoStatements.filter(s => s.language === lang && s.actflLevel === level).length
    }))
  }));
  
  return {
    totalLanguages: languages.length,
    totalStatements: canDoStatements.length,
    languages: stats
  };
}

/**
 * Get all Can-Do Statements (for database seeding)
 */
export function getAllCanDoStatements(): CanDoStatement[] {
  return canDoStatements;
}
