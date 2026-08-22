
/**
 * Schema for vocabulary extraction using Gemini structured output
 * Includes grammar classification for enhanced flashcard filtering
 */
const VOCABULARY_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    vocabulary: {
      type: "array",
      description: "New vocabulary words introduced in this response (max 3 per exchange)",
      items: {
        type: "object",
        properties: {
          word: { type: "string", description: "The foreign language word/phrase" },
          translation: { type: "string", description: "English translation" },
          example: { type: "string", description: "Example sentence using the word" },
          pronunciation: { type: "string", description: "Phonetic pronunciation guide" },
          wordType: { 
            type: "string", 
            enum: ["noun", "verb", "adjective", "adverb", "preposition", "conjunction", "pronoun", "article", "other"],
            description: "Grammatical category of the word" 
          },
          verbTense: { type: "string", description: "For verbs: present, past_preterite, past_imperfect, future, conditional" },
          verbMood: { type: "string", description: "For verbs: indicative, subjunctive, imperative" },
          verbPerson: { type: "string", description: "For verbs: 1st_singular, 2nd_singular, 3rd_singular, 1st_plural, 2nd_plural, 3rd_plural" },
          nounGender: { type: "string", description: "For nouns: masculine, feminine, neuter" },
          nounNumber: { type: "string", description: "For nouns: singular, plural" },
          grammarNotes: { type: "string", description: "Additional notes: irregular, reflexive, stem-changing, etc." }
        },
        required: ["word", "translation", "example", "pronunciation", "wordType"]
      }
    }
  },
  required: ["vocabulary"]
};

/**
 * Schema for student observation extraction
 * Extracts insights, motivations, struggles, and people connections from conversation
 * 
 * PHILOSOPHY: A good tutor remembers the WHOLE person, not just their learning stats.
 * This includes their hobbies, interests, family, likes/dislikes - the personal context
 * that makes conversations feel like talking to someone who genuinely cares.
 */
const STUDENT_OBSERVATION_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      description: "Observations about this student - both learning AND personal (max 3)",
      items: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["learning_style", "preference", "strength", "personality", "personal_interest", "life_context", "hobby", "likes_dislikes"], 
            description: "Type of insight - includes personal life details a caring mentor would remember" 
          },
          insight: { type: "string", description: "The observation (e.g., 'Loves salsa dancing', 'Prefers Cuban coffee', 'Works in tech')" },
          evidence: { type: "string", description: "What in the conversation led to this insight" }
        },
        required: ["type", "insight"]
      }
    },
    motivations: {
      type: "array",
      description: "Why the student is learning this language (max 1)",
      items: {
        type: "object",
        properties: {
          motivation: { type: "string", description: "The purpose (e.g., 'Trip to Spain next summer')" },
          details: { type: "string", description: "Additional context" },
          targetDate: { type: "string", description: "When they want to achieve it (ISO date if mentioned)" }
        },
        required: ["motivation"]
      }
    },
    struggles: {
      type: "array",
      description: "Recurring challenges the student faces (max 1)",
      items: {
        type: "object",
        properties: {
          area: { type: "string", enum: ["grammar", "pronunciation", "vocabulary", "listening", "cultural", "confidence"], description: "Area of struggle" },
          description: { type: "string", description: "What they struggle with" },
          examples: { type: "string", description: "Specific examples from the conversation" }
        },
        required: ["area", "description"]
      }
    },
    peopleConnections: {
      type: "array",
      description: "People the student mentioned (max 2)",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Person's name if mentioned" },
          relationship: { type: "string", description: "How they're related (friend, family, colleague, etc.)" },
          context: { type: "string", description: "Why they were mentioned" }
        },
        required: ["relationship", "context"]
      }
    },
    tutorSelfReflections: {
      type: "array",
      description: "Teaching insights Daniela noticed about her own approach (max 1)",
      items: {
        type: "object",
        properties: {
          category: { 
            type: "string", 
            enum: ["correction", "encouragement", "scaffolding", "tool_usage", "teaching_style", "pacing", "communication", "content"],
            description: "Category of teaching insight" 
          },
          insight: { type: "string", description: "What worked well or could be improved (e.g., 'Breaking down conjugations step-by-step helped understanding')" },
          context: { type: "string", description: "When this applies" }
        },
        required: ["category", "insight"]
      }
    }
  },
  required: []  // All fields optional - Gemini may not detect observations in every exchange
};

export { VOCABULARY_EXTRACTION_SCHEMA, STUDENT_OBSERVATION_SCHEMA };
