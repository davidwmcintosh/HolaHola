/**
 * Unified Tutor Orchestration Types
 * 
 * PHILOSOPHY: "One Tutor, Many Voices"
 * 
 * All intelligence flows through Daniela's brain. Different "voices" are
 * presentation layers only - the same neural network, same learning loop,
 * same procedural memory, just different instruments she plays.
 * 
 * Voices include:
 * - Language voices (Spanish Daniela, German Frau Müller, etc.)
 * - Gender voices (Professora vs Professor for linguistic teaching)
 * - Mode voices (conversational Daniela vs drill-mode Aris)
 * 
 * All voices are Daniela using different paintbrushes.
 */

/**
 * Orchestration mode determines response style and format
 */
export type OrchestratorMode = 
  | 'conversation'      // Streaming voice conversation (full context, open-ended)
  | 'drill'             // Focused practice mode (concise, structured feedback)
  | 'narrative'         // Storytelling/immersive scenario mode
  | 'assessment'        // Testing/evaluation mode (objective, measured)
  | 'greeting'          // Session start greeting (contextual, welcoming)
  | 'summary'           // Session summary (reflective, encouraging);

/**
 * Response channel determines how output is delivered
 */
export type ResponseChannel = 
  | 'stream'            // Streaming text for real-time TTS
  | 'batch_text'        // Complete text response (non-streaming)
  | 'batch_json';       // Structured JSON response

/**
 * Pedagogical persona metadata from the Persona Registry
 * Shapes how the tutor teaches, not just how they sound
 */
export interface PedagogicalPersona {
  pedagogicalFocus?: 'grammar' | 'fluency' | 'pronunciation' | 'culture' | 'vocabulary' | 'mixed';
  teachingStyle?: 'structured' | 'conversational' | 'drill_focused' | 'adaptive' | 'socratic';
  errorTolerance?: 'high' | 'medium' | 'low';
  vocabularyLevel?: 'beginner_friendly' | 'intermediate' | 'advanced' | 'academic';
  personalityTraits?: string;         // e.g., "warm, patient, uses humor"
  scenarioStrengths?: string;         // e.g., "roleplay, casual conversation"
  teachingPhilosophy?: string;        // Core teaching belief
}

/**
 * Voice presentation metadata - presentation layer only
 * This does NOT change intelligence, just how it's expressed
 * Extended with Pedagogical Persona Registry for teaching style
 */
export interface VoicePresentation {
  voiceId: string;                    // TTS voice ID (Cartesia)
  name: string;                       // Display name ("Daniela", "Aris", "Professor García")
  gender: 'male' | 'female';          // For linguistic agreement
  speakingRate?: number;              // 0.6-1.5 range
  emotionStyle?: string;              // Cartesia emotion preset
  uiAvatar?: string;                  // Avatar image for UI
  styleDeltas?: VoiceStyleDeltas;     // Stylistic modifications
  persona?: PedagogicalPersona;       // Teaching personality profile
}

/**
 * Style deltas applied on top of Daniela's core persona
 * These are additive modifications, not replacements
 */
export interface VoiceStyleDeltas {
  responseLength?: 'concise' | 'normal' | 'verbose';
  formalityLevel?: 'casual' | 'neutral' | 'formal';
  encouragementLevel?: 'minimal' | 'moderate' | 'high';
  targetLanguageRatio?: number;       // 0-1, how much target language to use
  additionalInstructions?: string;    // Mode-specific behavioral notes
  interventionSettings?: InterventionSettings;  // Granular error correction controls
}

/**
 * Granular Intervention Controls
 * 
 * Precision modifiers for how Daniela handles errors and teaching moments.
 * These settings allow fine-tuned control over micro-interventions during
 * conversation and drill modes.
 */
export interface InterventionSettings {
  /**
   * When to correct errors
   * - 'immediate': Correct right away (good for beginners)
   * - 'delayed': Wait for natural pause or turn end (less disruptive)
   * - 'on_request': Only correct when student asks (maximum autonomy)
   */
  correctionTiming?: 'immediate' | 'delayed' | 'on_request';
  
  /**
   * How much explanation to provide with corrections
   * - 'minimal': Just the correct form ("It's 'está', not 'es'")
   * - 'moderate': Brief rule reminder + correct form
   * - 'comprehensive': Full explanation with examples
   */
  correctionDepth?: 'minimal' | 'moderate' | 'comprehensive';
  
  /**
   * How much scaffolding/help to provide
   * - 'none': Let student figure it out
   * - 'hints': Provide clues without answers
   * - 'guided': Step-by-step prompts toward answer
   * - 'explicit': Provide the answer with explanation
   */
  scaffoldingLevel?: 'none' | 'hints' | 'guided' | 'explicit';
  
  /**
   * How strict to be about errors
   * - 'strict': Correct all errors including minor ones
   * - 'moderate': Correct significant errors, note minor ones
   * - 'lenient': Only correct errors that impede communication
   */
  errorTolerance?: 'strict' | 'moderate' | 'lenient';
  
  /**
   * Whether to interrupt the student's flow to correct
   * - 'never': Wait for student to finish completely
   * - 'critical_only': Only interrupt for major misunderstandings
   * - 'on_pattern': Interrupt if same error repeats
   */
  interruptBehavior?: 'never' | 'critical_only' | 'on_pattern';
  
  /**
   * How to handle pronunciation issues
   * - 'ignore': Focus on meaning, not sound
   * - 'note': Acknowledge but don't drill
   * - 'practice': Offer slow pronunciation practice
   * - 'drill': Initiate a pronunciation micro-drill
   */
  pronunciationHandling?: 'ignore' | 'note' | 'practice' | 'drill';
}

/**
 * Session context - all the information Daniela needs for inference
 */
export interface OrchestratorContext {
  userId: number;
  conversationId?: string;
  targetLanguage: string;
  nativeLanguage: string;
  proficiencyLevel: string;           // ACTFL level
  
  conversationHistory: Array<{
    role: 'user' | 'model';
    content: string;
  }>;
  
  proceduralMemory?: {
    toolKnowledge?: string;           // From procedural memory retrieval
    teachingPrinciples?: string;      // Core pedagogical beliefs
    situationalPatterns?: string;     // Context-triggered behaviors
  };
  
  compassContext?: {
    sessionPhase?: string;
    currentTopic?: string;
    studentEnergy?: string;
    recentProgress?: string;
  };
  
  curriculumContext?: {
    currentSyllabus?: string;
    upcomingTopics?: string[];
    recentlyMastered?: string[];
  };
  
  drillContext?: {
    drillType: string;
    focusArea?: string;
    currentItem?: any;
    sessionProgress?: {
      correct: number;
      incorrect: number;
      remaining: number;
    };
    recentAttempts?: Array<{
      item: any;
      wasCorrect: boolean;
      responseTimeMs?: number;
    }>;
  };
}

/**
 * Orchestrator request - input to the unified pipeline
 */
export interface OrchestratorRequest {
  mode: OrchestratorMode;
  responseChannel: ResponseChannel;
  context: OrchestratorContext;
  voice: VoicePresentation;
  
  userInput?: string;                 // What the student said/typed
  additionalPromptContext?: string;   // Mode-specific additions
  
  options?: {
    maxTokens?: number;
    temperature?: number;
    includeWhiteboardCommands?: boolean;
    logToNeuralNetwork?: boolean;     // Default true - log for learning
  };
}

/**
 * Orchestrator response - output from the unified pipeline
 */
export interface OrchestratorResponse {
  success: boolean;
  
  text?: string;                      // For batch_text responses
  json?: any;                         // For batch_json responses
  stream?: AsyncIterable<string>;     // For streaming responses
  
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    whiteboardCommands?: any[];
    emotionDetected?: string;
  };
  
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Drill feedback structure for batch_json mode
 */
export interface DrillFeedbackResponse {
  isCorrect: boolean;
  feedback: string;
  correction?: string;
  hint?: string;
  encouragement?: string;
  progressNote?: string;
}

/**
 * Session greeting structure for batch_json mode
 */
export interface SessionGreetingResponse {
  greeting: string;
  suggestedTopic?: string;
  motivationalNote?: string;
}

/**
 * Session summary structure for batch_json mode
 */
export interface SessionSummaryResponse {
  summary: string;
  achievements: string[];
  areasToImprove: string[];
  nextSteps?: string;
  encouragement: string;
}
