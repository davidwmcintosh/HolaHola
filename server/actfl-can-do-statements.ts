/**
 * ACTFL Can-Do Statements for Language Proficiency
 * Based on ACTFL World-Readiness Standards
 * 
 * This is a proof-of-concept implementation for Spanish Novice Low.
 * Can be expanded to all languages and proficiency levels.
 */

export interface CanDoStatement {
  language: string;
  actflLevel: string; // Internal format: "novice_low", "intermediate_mid", etc.
  category: 'interpersonal' | 'interpretive' | 'presentational';
  statement: string;
  examples?: string[];
}

/**
 * Spanish Novice Low Can-Do Statements
 * Novice Low learners can communicate minimally with memorized words and phrases
 */
export const canDoStatements: CanDoStatement[] = [
  // Interpersonal Communication (person-to-person)
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpersonal',
    statement: 'I can greet and leave people in a polite way',
    examples: ['Hola', '¿Cómo estás?', 'Adiós', 'Hasta luego']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpersonal',
    statement: 'I can introduce myself to someone',
    examples: ['Me llamo...', 'Soy...', 'Mucho gusto']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpersonal',
    statement: 'I can answer simple questions about my preferences',
    examples: ['Me gusta...', 'No me gusta...', 'Prefiero...']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpersonal',
    statement: 'I can say simple courtesy phrases',
    examples: ['Por favor', 'Gracias', 'De nada', 'Perdón']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpersonal',
    statement: 'I can state the names of familiar people, places, and objects',
    examples: ['Esta es mi casa', 'Él es mi amigo', 'Aquí está el libro']
  },
  
  // Interpretive Communication (understanding)
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpretive',
    statement: 'I can recognize familiar words and phrases about daily activities',
    examples: ['comer', 'dormir', 'estudiar', 'jugar']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpretive',
    statement: 'I can recognize numbers in authentic materials',
    examples: ['uno, dos, tres...', 'precios', 'horarios']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpretive',
    statement: 'I can recognize familiar names, words, and phrases',
    examples: ['nombres propios', 'lugares comunes', 'objetos cotidianos']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'interpretive',
    statement: 'I can understand simple questions',
    examples: ['¿Cómo te llamas?', '¿De dónde eres?', '¿Qué te gusta?']
  },
  
  // Presentational Communication (one-way communication)
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'presentational',
    statement: 'I can present information about myself using words and phrases',
    examples: ['Mi nombre es...', 'Tengo ... años', 'Vivo en...']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'presentational',
    statement: 'I can express my likes and dislikes using memorized phrases',
    examples: ['Me gusta el fútbol', 'No me gusta la pizza']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'presentational',
    statement: 'I can list family members, friends, and familiar people',
    examples: ['Mi madre', 'Mi hermano', 'Mi amigo Pedro']
  },
  {
    language: 'spanish',
    actflLevel: 'novice_low',
    category: 'presentational',
    statement: 'I can present simple information about objects in my environment',
    examples: ['Este es mi libro', 'Mi casa es grande']
  }
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
