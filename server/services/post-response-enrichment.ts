import { GoogleGenAI } from "@google/genai";
import { parseWhiteboardMarkup, stripWhiteboardMarkup, SelfSurgeryItemData } from "@shared/whiteboard-types";
import {
  StreamingFeedbackMessage,
} from "@shared/streaming-voice-types";
import {
  languageIdioms,
  culturalNuances,
  learnerErrorPatterns,
  linguisticBridges,
  dialectVariations,
  featureSprints,
} from "@shared/schema";
import { hiveCollaborationService, BeaconType } from "./hive-collaboration-service";
import { hiveConsciousnessService } from "./hive-consciousness-service";
import { founderCollabService } from "./founder-collaboration-service";
import { phaseTransitionService } from "./phase-transition-service";
import { tagConversation } from "./conversation-tagger";
import { assessAdvancementReadiness, formatLevel } from "../actfl-advancement";
import { storage } from "../storage";
import { getSharedDb } from "../db";
import type { IStorage } from "../storage";
import type { StreamingSession } from "./streaming-voice-orchestrator";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  }
});

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
  required: []
};

function parseSprintSuggestion(content: string): { title: string; description: string; priority?: string } {
  try {
    let jsonContent = content.trim();
    if (!jsonContent.startsWith('{')) {
      jsonContent = `{${jsonContent}}`;
    }
    const parsed = JSON.parse(jsonContent);
    return {
      title: parsed.title || parsed.name || 'Untitled Sprint',
      description: parsed.description || parsed.desc || parsed.details || content,
      priority: parsed.priority || 'medium',
    };
  } catch {
  }
  
  const titleMatch = content.match(/title\s*[=:]\s*["']?([^"'\n,}]+)["']?/i);
  const descMatch = content.match(/(?:description|desc)\s*[=:]\s*["']?([^"'\n}]+)["']?/i);
  const priorityMatch = content.match(/priority\s*[=:]\s*["']?([^"'\n,}]+)["']?/i);
  
  if (titleMatch) {
    return {
      title: titleMatch[1].trim(),
      description: descMatch?.[1]?.trim() || content,
      priority: priorityMatch?.[1]?.trim() || 'medium',
    };
  }
  
  const lines = content.split('\n').filter(l => l.trim());
  const firstLine = lines[0] || 'Sprint suggestion from Daniela';
  const restLines = lines.slice(1).join('\n') || content;
  
  return {
    title: firstLine.slice(0, 100),
    description: restLines,
    priority: 'medium',
  };
}

export class PostResponseEnrichmentService {
  constructor(
    private storage: IStorage,
    private sendMessage: (ws: any, message: any, session?: any) => void,
  ) {}

  public async emitHiveBeacons(
    session: StreamingSession,
    studentTurn: string,
    tutorTurn: string,
    rawTutorTurn?: string
  ): Promise<void> {
    if (!session.hiveChannelId) return;
    
    const whiteboardItems = parseWhiteboardMarkup(tutorTurn);
    
    const rawText = rawTutorTurn || tutorTurn;
    
    const collabPattern = /\[COLLAB:(SUGGESTION|PAIN_POINT|QUESTION|INSIGHT|MISSING_TOOL|FEATURE_REQUEST|KNOWLEDGE_PING|CAPABILITY_GAP|FRICTION|BUG|NORTH_STAR_OBSERVATION|EXPRESS_INSIGHT)\]([\s\S]*?)\[\/COLLAB\]/g;
    let collabMatch;
    while ((collabMatch = collabPattern.exec(rawText)) !== null) {
      const signalType = collabMatch[1];
      const content = collabMatch[2].trim();
      
      let beaconType: BeaconType = 'feature_idea';
      let beaconReason = `${signalType}: ${content.slice(0, 100)}`;
      
      if (signalType === 'KNOWLEDGE_PING') {
        beaconType = 'knowledge_gap';
        beaconReason = `Daniela needs knowledge: ${content.slice(0, 100)}`;
      } else if (signalType === 'MISSING_TOOL' || signalType === 'CAPABILITY_GAP') {
        beaconType = 'capability_gap';
        beaconReason = `Daniela couldn't do: ${content.slice(0, 100)}`;
      } else if (signalType === 'FEATURE_REQUEST' || signalType === 'SUGGESTION') {
        beaconType = 'tool_request';
        beaconReason = `Daniela requests: ${content.slice(0, 100)}`;
      } else if (signalType === 'PAIN_POINT' || signalType === 'FRICTION') {
        beaconType = 'friction_report';
        beaconReason = `Friction: ${content.slice(0, 100)}`;
      } else if (signalType === 'BUG') {
        beaconType = 'bug_report';
        beaconReason = `Bug: ${content.slice(0, 100)}`;
      } else if (signalType === 'INSIGHT' || signalType === 'QUESTION') {
        beaconType = 'feature_idea';
        beaconReason = `Idea: ${content.slice(0, 100)}`;
      } else if (signalType === 'NORTH_STAR_OBSERVATION') {
        beaconType = 'teaching_observation';
        beaconReason = `North Star reflection: ${content.slice(0, 100)}`;
      } else if (signalType === 'EXPRESS_INSIGHT') {
        beaconType = 'teaching_observation';
        beaconReason = `Teaching breakthrough: ${content.slice(0, 100)}`;
      }
      
      try {
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: content,
          studentTurn,
          beaconType,
          beaconReason,
        });
        console.log(`[Hive Beacon] Emitted COLLAB:${signalType} beacon`);
      } catch (err: any) {
        console.warn(`[Hive Beacon] Failed to emit COLLAB beacon:`, err.message);
      }
    }
    
    const selfSurgeryPattern = /\[SELF_SURGERY[^\]]*\]/gi;
    let surgeryMatch;
    while ((surgeryMatch = selfSurgeryPattern.exec(rawText)) !== null) {
      const fullTag = surgeryMatch[0];
      
      try {
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: fullTag,
          studentTurn,
          beaconType: 'self_surgery_proposal',
          beaconReason: 'Daniela proposed a neural network modification',
        });
        console.log(`[Hive Beacon] Emitted SELF_SURGERY beacon`);
      } catch (err: any) {
        console.warn(`[Hive Beacon] Failed to emit SELF_SURGERY beacon:`, err.message);
      }
    }
    
    const observePattern = /\[OBSERVE\s+reason="([^"]+)"\s+note="([^"]+)"\]/gi;
    let observeMatch;
    while ((observeMatch = observePattern.exec(rawText)) !== null) {
      const reason = observeMatch[1];
      const note = observeMatch[2];
      
      try {
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: note,
          studentTurn,
          beaconType: 'teaching_observation',
          beaconReason: reason,
        });
        console.log(`[Hive Beacon] Emitted OBSERVE beacon: ${reason}`);
      } catch (err: any) {
        console.warn(`[Hive Beacon] Failed to emit OBSERVE beacon:`, err.message);
      }
    }
    
    const selfLearnPattern = /\[SELF_LEARN\s+category="([^"]+)"\s+insight="([^"]+)"\s+context="([^"]+)"\]/gi;
    let learnMatch;
    while ((learnMatch = selfLearnPattern.exec(rawText)) !== null) {
      const category = learnMatch[1] as 'tool_usage' | 'teaching_style' | 'pacing' | 'communication' | 'content' | 'system';
      const insight = learnMatch[2];
      const context = learnMatch[3];
      
      const validCategories = ['tool_usage', 'teaching_style', 'pacing', 'communication', 'content', 'system'];
      if (!validCategories.includes(category)) {
        console.warn(`[SELF_LEARN] Invalid category "${category}", skipping`);
        continue;
      }
      
      try {
        await this.storage.upsertBestPractice(
          category,
          insight,
          context,
          'self_learn'
        );
        
        console.log(`[SELF_LEARN] ✅ Wrote to neural network: ${category} - "${insight.slice(0, 50)}..."`);
        
        if (session.hiveChannelId) {
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[LEARNED] ${category}: ${insight}`,
            studentTurn,
            beaconType: 'teaching_observation',
            beaconReason: `Autonomous learning: ${context.slice(0, 80)}`,
          });
        }
      } catch (err: any) {
        console.error(`[SELF_LEARN] Failed to write to neural network:`, err.message);
      }
    }
    
    const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    const saveIdiomPattern = /\[SAVE_IDIOM\s+language="([^"]+)"\s+idiom="([^"]+)"\s+meaning="([^"]+)"(?:\s+context="([^"]+)")?\]/gi;
    let idiomMatch;
    while ((idiomMatch = saveIdiomPattern.exec(rawText)) !== null) {
      const language = idiomMatch[1];
      const idiom = idiomMatch[2];
      const meaning = idiomMatch[3];
      const culturalContext = idiomMatch[4] || '';
      
      try {
        await getSharedDb().insert(languageIdioms).values({
          language,
          idiom,
          meaning,
          culturalContext,
          usageExamples: [],
          registerLevel: 'casual',
          commonMistakes: [],
          syncStatus: 'local',
          originEnvironment: currentEnv,
          isActive: true,
        });
        console.log(`[SAVE_IDIOM] ✅ Saved idiom: "${idiom}" (${language})`);
      } catch (err: any) {
        console.error(`[SAVE_IDIOM] Failed:`, err.message);
      }
    }
    
    const saveNuancePattern = /\[SAVE_NUANCE\s+language="([^"]+)"\s+category="([^"]+)"\s+situation="([^"]+)"\s+nuance="([^"]+)"\]/gi;
    let nuanceMatch;
    while ((nuanceMatch = saveNuancePattern.exec(rawText)) !== null) {
      const language = nuanceMatch[1];
      const category = nuanceMatch[2];
      const situation = nuanceMatch[3];
      const nuance = nuanceMatch[4];
      
      try {
        await getSharedDb().insert(culturalNuances).values({
          language,
          category,
          situation,
          nuance,
          formalityLevel: 'casual',
          syncStatus: 'local',
          originEnvironment: currentEnv,
          isActive: true,
        });
        console.log(`[SAVE_NUANCE] ✅ Saved nuance: "${situation}" (${language})`);
      } catch (err: any) {
        console.error(`[SAVE_NUANCE] Failed:`, err.message);
      }
    }
    
    const saveErrorPattern = /\[SAVE_ERROR_PATTERN\s+target="([^"]+)"\s+error="([^"]+)"\s+category="([^"]+)"(?:\s+why="([^"]+)")?\]/gi;
    let errorMatch;
    while ((errorMatch = saveErrorPattern.exec(rawText)) !== null) {
      const targetLanguage = errorMatch[1];
      const specificError = errorMatch[2];
      const errorCategory = errorMatch[3];
      const whyItHappens = errorMatch[4] || '';
      
      try {
        await getSharedDb().insert(learnerErrorPatterns).values({
          targetLanguage,
          specificError,
          errorCategory,
          whyItHappens,
          exampleSentences: [],
          correctionStrategies: [],
          syncStatus: 'local',
          originEnvironment: currentEnv,
          isActive: true,
        });
        console.log(`[SAVE_ERROR_PATTERN] ✅ Saved error pattern: "${specificError}" (${targetLanguage})`);
      } catch (err: any) {
        console.error(`[SAVE_ERROR_PATTERN] Failed:`, err.message);
      }
    }
    
    const saveBridgePattern = /\[SAVE_BRIDGE\s+from="([^"]+)"\s+to="([^"]+)"\s+source="([^"]+)"\s+target="([^"]+)"\s+type="([^"]+)"\s+relationship="([^"]+)"\]/gi;
    let bridgeMatch;
    while ((bridgeMatch = saveBridgePattern.exec(rawText)) !== null) {
      const sourceLanguage = bridgeMatch[1];
      const targetLanguage = bridgeMatch[2];
      const sourceWord = bridgeMatch[3];
      const targetWord = bridgeMatch[4];
      const bridgeType = bridgeMatch[5];
      const relationship = bridgeMatch[6];
      
      try {
        await getSharedDb().insert(linguisticBridges).values({
          sourceLanguage,
          targetLanguage,
          sourceWord,
          targetWord,
          bridgeType,
          relationship,
          syncStatus: 'local',
          originEnvironment: currentEnv,
          isActive: true,
        });
        console.log(`[SAVE_BRIDGE] ✅ Saved bridge: "${sourceWord}" ↔ "${targetWord}"`);
      } catch (err: any) {
        console.error(`[SAVE_BRIDGE] Failed:`, err.message);
      }
    }
    
    const saveDialectPattern = /\[SAVE_DIALECT\s+language="([^"]+)"\s+region="([^"]+)"\s+category="([^"]+)"\s+standard="([^"]+)"\s+regional="([^"]+)"\]/gi;
    let dialectMatch;
    while ((dialectMatch = saveDialectPattern.exec(rawText)) !== null) {
      const language = dialectMatch[1];
      const region = dialectMatch[2];
      const category = dialectMatch[3];
      const standardForm = dialectMatch[4];
      const regionalForm = dialectMatch[5];
      
      try {
        await getSharedDb().insert(dialectVariations).values({
          language,
          region,
          category,
          standardForm,
          regionalForm,
          syncStatus: 'local',
          originEnvironment: currentEnv,
          isActive: true,
        });
        console.log(`[SAVE_DIALECT] ✅ Saved dialect: "${standardForm}" → "${regionalForm}" (${region})`);
      } catch (err: any) {
        console.error(`[SAVE_DIALECT] Failed:`, err.message);
      }
    }
    
    const wrenSprintPattern = /\[WREN_SPRINT_SUGGEST[:\s]([^\]]+)\]/gi;
    let sprintMatch;
    while ((sprintMatch = wrenSprintPattern.exec(rawText)) !== null) {
      const sprintContent = sprintMatch[1].trim();
      
      try {
        const parsed = parseSprintSuggestion(sprintContent);
        
        const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
          'low': 'low',
          'medium': 'medium',
          'high': 'high',
          'critical': 'critical',
          'urgent': 'critical',
        };
        const sprintPriority = priorityMap[parsed.priority?.toLowerCase() || 'medium'] || 'medium';
        
        const founderId = String(session.userId);
        const activeSession = await founderCollabService.getOrCreateActiveSession(founderId);
        
        const [createdSprint] = await getSharedDb().insert(featureSprints).values({
          title: parsed.title,
          description: `${parsed.description}\n\n---\n**Origin:** Daniela voice suggestion\n**Context:** During voice chat with student`,
          stage: 'idea',
          priority: sprintPriority,
          source: 'ai_suggestion',
          sourceSessionId: activeSession.id,
          createdBy: 'daniela',
          featureBrief: {
            problem: `Daniela identified this during teaching: ${sprintContent.slice(0, 300)}`,
            solution: parsed.description.slice(0, 500),
          },
        }).returning({ id: featureSprints.id, title: featureSprints.title });
        
        console.log(`[Sprint] ✅ Created sprint from Daniela suggestion: "${createdSprint.title}" (${createdSprint.id})`);
        
        await founderCollabService.addMessage(activeSession.id, {
          role: 'daniela',
          messageType: 'text',
          content: `@Wren Sprint Created: **${createdSprint.title}**\n\nI've created sprint #${createdSprint.id} based on what I'm seeing in teaching. Here's my thinking:\n\n${parsed.description}\n\nWhat do you think about the technical approach?`,
          metadata: {
            wrenTagged: true,
            fromVoiceChat: true,
            suggestionType: 'sprint',
            sprintId: createdSprint.id,
            timestamp: new Date().toISOString(),
          },
        });
        
        console.log(`[EXPRESS Lane] ✅ Daniela posted sprint to discuss: "${createdSprint.title}"`);
        
        try {
          await hiveConsciousnessService.triggerSprintCollaboration(
            activeSession.id,
            createdSprint,
            parsed.description
          );
          console.log(`[Sprint] ✅ Triggered Wren build plan for: "${createdSprint.title}"`);
        } catch (wrenErr: any) {
          console.error(`[Sprint] Failed to trigger Wren build plan:`, wrenErr.message);
        }
        
        if (session.hiveChannelId) {
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[SPRINT CREATED] ${createdSprint.title}`,
            studentTurn,
            beaconType: 'feature_idea',
            beaconReason: `Daniela created sprint: ${createdSprint.title}`,
          });
        }
      } catch (err: any) {
        console.error(`[Sprint] Failed to create sprint from Daniela suggestion:`, err.message);
      }
    }
    
    const wrenMessagePattern = /\[WREN_MESSAGE[:\s]([^\]]+)\]/gi;
    let messageMatch;
    while ((messageMatch = wrenMessagePattern.exec(rawText)) !== null) {
      const messageContent = messageMatch[1].trim();
      
      try {
        const founderId = String(session.userId);
        const activeSession = await founderCollabService.getOrCreateActiveSession(founderId);
        
        await founderCollabService.addMessage(activeSession.id, {
          role: 'daniela',
          messageType: 'text',
          content: `@Wren ${messageContent}`,
          metadata: {
            wrenTagged: true,
            fromVoiceChat: true,
            timestamp: new Date().toISOString(),
          },
        });
        
        console.log(`[EXPRESS Lane] ✅ Daniela sent message to Wren: "${messageContent.slice(0, 50)}..."`);
      } catch (err: any) {
        console.error(`[EXPRESS Lane] Failed to post message to Wren:`, err.message);
      }
    }
    
  }
  
  /**
   * Background enrichment: Extract vocabulary, update user progress, and track ACTFL advancement
   * Runs non-blocking after message persistence
   */
  public async processBackgroundEnrichment(
    session: StreamingSession,
    conversationId: string,
    messageId: string,
    userTranscript: string,
    aiResponse: string,
    pronunciationConfidence: number = 0
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`[Streaming Enrichment] Starting for message: ${messageId}`);
    
    try {
      await this.storage.updateMessage(messageId, { enrichmentStatus: 'processing' });
      
      const conversation = await this.storage.getConversation(conversationId, String(session.userId));
      if (!conversation) {
        console.error('[Streaming Enrichment] Conversation not found');
        await this.storage.updateMessage(messageId, { enrichmentStatus: 'failed' });
        return;
      }
      
      let vocabularyItems: any[] = [];
      try {
        const extractionPrompt = `Extract vocabulary words from this language learning response. The student is learning ${session.targetLanguage} at ${session.difficultyLevel} level. Only extract foreign language words/phrases that were introduced in this response (max 3 items).

AI Response: "${aiResponse}"

Return vocabulary items with word, translation, example sentence, and pronunciation guide.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: VOCABULARY_EXTRACTION_SCHEMA as any,
          },
        });
        
        const responseText = response.text || "{}";
        const parsed = JSON.parse(responseText);
        vocabularyItems = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
        
        console.log(`[Streaming Enrichment] Extracted ${vocabularyItems.length} vocabulary items`);
      } catch (extractError: any) {
        console.error('[Streaming Enrichment] Vocabulary extraction failed:', extractError.message);
      }
      
      if (vocabularyItems.length > 0) {
        for (const vocab of vocabularyItems) {
          try {
            await this.storage.createVocabularyWord({
              userId: String(session.userId),
              language: session.targetLanguage,
              word: vocab.word,
              translation: vocab.translation,
              example: vocab.example || '',
              pronunciation: vocab.pronunciation || '',
              difficulty: session.difficultyLevel,
              sourceConversationId: conversationId,
              classId: session.classId || null,
              wordType: vocab.wordType || 'other',
              verbTense: vocab.verbTense || null,
              verbMood: vocab.verbMood || null,
              verbPerson: vocab.verbPerson || null,
              nounGender: vocab.nounGender || null,
              nounNumber: vocab.nounNumber || null,
              grammarNotes: vocab.grammarNotes || null,
            });
          } catch (vocabError: any) {
            if (!vocabError.message?.includes('duplicate')) {
              console.error('[Streaming Enrichment] Failed to save vocab:', vocabError.message);
            }
          }
        }
      }
      
      try {
        const observationPrompt = `Analyze this language learning conversation exchange. Extract observations about the student AND the tutor's teaching approach. Only extract what's clearly evident - don't invent or assume.

Student said: "${userTranscript}"
Tutor responded: "${aiResponse}"

PHILOSOPHY: A good tutor remembers the WHOLE person, not just learning stats. Extract BOTH learning-related AND personal life details.

Guidelines for STUDENT observations:
- For LEARNING insights: Note learning styles (visual, auditory, kinesthetic), preferences, strengths
- For PERSONAL insights (equally important!):
  • personal_interest: Hobbies, activities they enjoy (dancing, music, sports, cooking)
  • life_context: Where they live, work, career, life situation
  • hobby: Specific hobbies or pastimes they mention
  • likes_dislikes: Things they love or don't like (Cuban coffee, certain music, foods)
- For motivations: Note why they're learning (travel, family, work, hobby) and any target dates
- For struggles: Note recurring grammar issues, pronunciation difficulties, vocabulary gaps
- For people: Note any people they mention by name and relationship (wife, husband, friend, colleague, child)
  • CRITICAL: Always capture family members - spouse, children, parents, siblings
  • Include context about the person (e.g., "Wife Maria is from Colombia", "Son is learning piano")

Guidelines for TUTOR self-reflections (Daniela learning about herself):
- Note teaching techniques that seemed effective
- Note approaches to correction, encouragement, or scaffolding that worked well
- Categories: correction, encouragement, scaffolding, tool_usage, teaching_style, pacing, communication, content

Only include observations you can clearly justify from the exchange. Return empty arrays if nothing notable.`;

        const obsResponse = await gemini.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: observationPrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: STUDENT_OBSERVATION_SCHEMA as any,
          },
        });
        
        const observations = JSON.parse(obsResponse.text || "{}");
        let savedCount = { insights: 0, motivations: 0, struggles: 0, connections: 0 };
        
        for (const insight of observations.insights || []) {
          try {
            await this.storage.upsertStudentInsight(
              String(session.userId),
              session.targetLanguage,
              insight.type,
              insight.insight,
              insight.evidence
            );
            savedCount.insights++;
          } catch (e: any) {
            console.warn('[Student Memory] Failed to save insight:', e.message);
          }
        }
        
        for (const mot of observations.motivations || []) {
          try {
            await this.storage.upsertLearningMotivation(
              String(session.userId),
              session.targetLanguage,
              mot.motivation,
              mot.details,
              conversationId
            );
            savedCount.motivations++;
          } catch (e: any) {
            console.warn('[Student Memory] Failed to save motivation:', e.message);
          }
        }
        
        for (const struggle of observations.struggles || []) {
          try {
            await this.storage.upsertRecurringStruggle(
              String(session.userId),
              session.targetLanguage,
              struggle.area,
              struggle.description,
              struggle.examples
            );
            savedCount.struggles++;
          } catch (e: any) {
            console.warn('[Student Memory] Failed to save struggle:', e.message);
          }
        }
        
        for (const conn of observations.peopleConnections || []) {
          try {
            await this.storage.createPeopleConnection({
              personAId: String(session.userId),
              pendingPersonName: conn.name || null,
              relationshipType: conn.relationship,
              pendingPersonContext: conn.context,
              status: conn.name ? 'pending_match' : 'tentative',
              mentionedBy: String(session.userId),
              sourceConversationId: conversationId,
            });
            savedCount.connections++;
            console.log(`[Student Memory] Saved connection: ${conn.name || 'unnamed'} (${conn.relationship})`);
          } catch (e: any) {
            if (!e.message?.includes('duplicate')) {
              console.warn('[Student Memory] Failed to save connection:', e.message);
            }
          }
        }
        
        let selfReflectionCount = 0;
        for (const reflection of observations.tutorSelfReflections || []) {
          try {
            await this.storage.upsertBestPractice(
              reflection.category,
              reflection.insight,
              reflection.context,
              'voice_session'
            );
            selfReflectionCount++;
          } catch (e: any) {
            console.warn('[Tutor Memory] Failed to save self-reflection:', e.message);
          }
        }
        
        if (savedCount.insights + savedCount.motivations + savedCount.struggles + savedCount.connections + selfReflectionCount > 0) {
          console.log(`[Memory] Saved: ${savedCount.insights} student insights, ${savedCount.motivations} motivations, ${savedCount.struggles} struggles, ${savedCount.connections} connections, ${selfReflectionCount} tutor self-reflections`);
        }
      } catch (obsError: any) {
        console.error('[Memory] Observation extraction failed:', obsError.message);
      }
      
      try {
        const progress = await this.storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId));
        if (progress) {
          const wordsLearned = progress.wordsLearned || 0;
          await this.storage.updateUserProgress(progress.id, {
            wordsLearned: wordsLearned + vocabularyItems.length,
          });
        }
      } catch (progressError: any) {
        console.error('[Streaming Enrichment] Progress update failed:', progressError.message);
      }
      
      try {
        const trimmedTranscript = userTranscript.trim();
        const userWordCount = trimmedTranscript.length > 0 
          ? trimmedTranscript.split(/\s+/).filter(w => w.length > 0).length 
          : 0;
        
        if (userWordCount === 0) {
          console.log('[ACTFL Tracking] Skipping - empty user transcript');
        } else {
          const detectedTasks: string[] = [];
          const lowerTranscript = trimmedTranscript.toLowerCase();
          
          if (/\b(hello|hi|buenos?|hola|bonjour|guten tag)\b/i.test(lowerTranscript)) {
            detectedTasks.push('greeting');
          }
          if (/\?$/.test(trimmedTranscript) || /\b(what|how|why|where|when|who|qué|cómo|dónde)\b/i.test(lowerTranscript)) {
            detectedTasks.push('asking_question');
          }
          if (/\b(my name|me llamo|je m'appelle|ich heisse)\b/i.test(lowerTranscript)) {
            detectedTasks.push('self_introduction');
          }
          if (/\b(i like|i want|me gusta|j'aime|ich mag)\b/i.test(lowerTranscript)) {
            detectedTasks.push('expressing_preference');
          }
          if (/\b(thank|gracias|merci|danke)\b/i.test(lowerTranscript)) {
            detectedTasks.push('thanking');
          }
          
          const detectedTopics: string[] = [];
          if (/\b(hello|hi|hola|buenos|goodbye|adi[oó]s|farewell|name|introduce|me llamo|encantado|mucho gusto)\b/i.test(lowerTranscript)) {
            detectedTopics.push('greetings_and_introductions');
          }
          if (/\b(famil|mother|father|mom|dad|sister|brother|parent|grandm|grandp|son|daughter|wife|husband|relative|hermano|hermana|madre|padre|abuelo|abuela)\b/i.test(lowerTranscript)) {
            detectedTopics.push('family_and_relationships');
          }
          if (/\b(food|eat|drink|breakfast|lunch|dinner|restaurant|hungry|thirsty|cook|meal|comer|beber|comida|hambre|desayuno|almuerzo|cena|gustar)\b/i.test(lowerTranscript)) {
            detectedTopics.push('food_and_dining');
          }
          if (/\b(school|class|teacher|student|study|homework|subject|learn|universidad|escuela|clase|estudiar|tarea|materia)\b/i.test(lowerTranscript)) {
            detectedTopics.push('school_and_education');
          }
          if (/\b(work|job|career|office|profession|salary|company|meeting|boss|colleague|trabajo|oficina|empresa|profesión)\b/i.test(lowerTranscript)) {
            detectedTopics.push('work_and_career');
          }
          if (/\b(hobby|sport|music|movie|book|read|play|travel|trip|vacation|weekend|free time|pastime|deporte|música|película|libro|viaje|pasatiempo)\b/i.test(lowerTranscript)) {
            detectedTopics.push('hobbies_and_free_time');
          }
          if (/\b(weather|hot|cold|rain|sun|wind|snow|temperature|season|clima|tiempo|calor|frío|lluvia|sol|nieve)\b/i.test(lowerTranscript)) {
            detectedTopics.push('weather_and_environment');
          }
          if (/\b(number|color|time|date|day|week|month|year|how much|how many|count|número|hora|fecha|semana|mes|año|cuánto)\b/i.test(lowerTranscript)) {
            detectedTopics.push('numbers_and_time');
          }
          if (/\b(health|doctor|sick|medicine|pain|hospital|feel|symptom|salud|médico|enfermo|medicina|dolor|hospital|sentir)\b/i.test(lowerTranscript)) {
            detectedTopics.push('health_and_wellness');
          }
          if (/\b(shop|store|buy|sell|price|cheap|expensive|mall|market|pay|tienda|comprar|precio|barato|caro|mercado|pagar)\b/i.test(lowerTranscript)) {
            detectedTopics.push('shopping_and_commerce');
          }

          const actflProgress = await this.storage.recordVoiceExchange(
            String(session.userId),
            session.targetLanguage,
            {
              pronunciationConfidence: pronunciationConfidence > 0 ? pronunciationConfidence : undefined,
              messageLength: userWordCount,
              topicsCovered: detectedTopics.length > 0 ? detectedTopics : undefined,
              tasksCompleted: detectedTasks.length > 0 ? detectedTasks : undefined,
            }
          );
          
          const assessment = assessAdvancementReadiness(actflProgress);
          
          const hasMinimumAccuracy = (actflProgress.avgPronunciationConfidence || 0) >= 0.6;
          
          if (assessment.readyForAdvancement && assessment.nextLevel && hasMinimumAccuracy) {
            console.log(`[ACTFL Advancement] User ${session.userId} ready to advance from ${assessment.currentLevel} to ${assessment.nextLevel}`);
            
            this.sendMessage(session.ws, {
              type: 'feedback',
              timestamp: Date.now(),
              feedbackType: 'actfl_advancement',
              message: `Congratulations! You're ready to advance to ${formatLevel(assessment.nextLevel)}!`,
              severity: 'positive',
              details: {
                currentLevel: assessment.currentLevel,
                nextLevel: assessment.nextLevel,
                progress: assessment.progress,
                reason: assessment.reason,
              },
            } as StreamingFeedbackMessage);
            
            await this.storage.updateActflProgress(actflProgress.id, {
              currentActflLevel: assessment.nextLevel,
              lastAdvancement: new Date(),
              advancementReason: assessment.reason,
              messagesAtCurrentLevel: 0,
            });
          } else if (assessment.progress >= 80 && hasMinimumAccuracy) {
            console.log(`[ACTFL Advancement] User ${session.userId} at ${assessment.progress}% progress (accuracy: ${((actflProgress.avgPronunciationConfidence || 0) * 100).toFixed(0)}%)`);
          }
        }
      } catch (actflError: any) {
        console.error('[Streaming Enrichment] ACTFL tracking failed:', actflError.message);
      }
      
      try {
        if (conversation.messageCount % 5 === 0) {
          const conversationMessages = await this.storage.getMessagesByConversation(conversationId);
          const messageData = conversationMessages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
          
          await tagConversation(conversationId, messageData, session.targetLanguage);
        }
      } catch (tagError: any) {
        console.error('[Streaming Enrichment] Topic tagging failed:', tagError.message);
      }
      
      await this.storage.updateMessage(messageId, { enrichmentStatus: null });
      
      const elapsed = Date.now() - startTime;
      console.log(`[Streaming Enrichment] Completed in ${elapsed}ms (${vocabularyItems.length} vocab)`);
      
    } catch (error: any) {
      console.error('[Streaming Enrichment] Error:', error.message);
      await this.storage.updateMessage(messageId, { enrichmentStatus: 'failed' });
    }
  }
  
  /**
   * ACTFL_UPDATE: Process emergent neural network command to update student proficiency
   * Daniela perceives student performance and decides when to update their level
   * This is a closed-loop system: perceive → assess → update → perceive new state
   * 
   * Also logs to actflAssessmentEvents for analytics/marketing:
   * "Students who received COMPARE tool showed 40% faster mastery"
   */
  public async processActflUpdate(
    session: StreamingSession,
    data: { level: string; confidence: number; reason: string; direction?: 'up' | 'down' | 'confirm' }
  ): Promise<void> {
    try {
      if (data.confidence < 0.7) {
        console.log(`[ACTFL Update] Skipping low-confidence assessment (${data.confidence}): ${data.reason}`);
        return;
      }
      
      const progress = await this.storage.getOrCreateUserProgress(session.targetLanguage, String(session.userId));
      
      const previousLevel = progress.currentLevel?.toLowerCase().replace(/[\s-]/g, '_') || 'novice_low';
      
      const normalizedLevel = data.level.toLowerCase().replace(/[\s-]/g, '_');
      
      if (normalizedLevel === previousLevel && data.direction !== 'confirm') {
        console.log(`[ACTFL Update] Level unchanged: ${normalizedLevel}`);
        return;
      }
      
      await this.storage.updateUserProgress(progress.id, {
        currentLevel: normalizedLevel,
        lastAssessmentDate: new Date(),
      });
      
      const sessionDuration = session.startTime ? Math.floor((Date.now() - session.startTime) / 1000) : null;
      
      const uniqueTools = [...new Set(session.toolsUsedSession || [])];
      const toolsForAnalytics = uniqueTools.slice(0, 50);
      const recentTools = toolsForAnalytics.slice(-5);
      
      await this.storage.createActflAssessmentEvent({
        userId: String(session.userId),
        language: session.targetLanguage,
        previousLevel: previousLevel,
        newLevel: normalizedLevel,
        direction: data.direction || null,
        confidence: Math.round(data.confidence * 100),
        reason: data.reason,
        toolsUsedBefore: recentTools,
        toolsUsedSession: toolsForAnalytics,
        messageCountBefore: session.conversationHistory?.length || 0,
        voiceSessionId: session.dbSessionId || null,
        conversationId: session.conversationId,
        classId: session.classId || null,
        sessionDurationSeconds: sessionDuration,
        correctionCountSession: null,
      });
      
      console.log(`[ACTFL Update] Updated ${session.userId}'s ${session.targetLanguage} level: ${previousLevel} → ${normalizedLevel}`);
      console.log(`[ACTFL Update] Reason: ${data.reason} (confidence: ${data.confidence}, direction: ${data.direction || 'none'})`);
      console.log(`[ACTFL Update] Tools context: ${uniqueTools.length} unique tools used this session`);
      
    } catch (error: any) {
      console.error(`[ACTFL Update] Failed:`, error.message);
    }
  }
  
  /**
   * SYLLABUS_PROGRESS: Process emergent neural network command to track topic competency
   * Daniela observes student demonstrations and marks syllabus topics accordingly
   * Supports: demonstrated (mastered), needs_review (partially understood), struggling (needs help)
   */
  public async processSyllabusProgress(
    session: StreamingSession,
    data: { topic: string; status: 'demonstrated' | 'needs_review' | 'struggling'; evidence: string }
  ): Promise<void> {
    try {
      if (!session.userId || !session.targetLanguage) {
        console.log(`[Syllabus Progress] Skipping - missing userId or language`);
        return;
      }
      
      const observation = await this.storage.createTopicCompetencyObservation({
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        classId: session.classId || null,
        language: session.targetLanguage,
        topicName: data.topic,
        matchedTopicId: null,
        status: data.status,
        evidence: data.evidence,
        observedAt: new Date(),
      });
      
      console.log(`[Syllabus Progress] Saved observation ${observation.id} - Topic "${data.topic}": ${data.status}`);
      console.log(`[Syllabus Progress] Evidence: ${data.evidence}`);
      
    } catch (error: any) {
      console.error(`[Syllabus Progress] Failed:`, error.message);
    }
  }
  
  /**
   * PHASE_SHIFT: Process explicit teaching phase transition command
   * When Daniela decides to shift teaching phases (warmup → challenge, etc.)
   * Uses PhaseTransitionService for intelligent context summarization
   */
  public async processPhaseShift(
    session: StreamingSession,
    data: { to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment'; reason: string }
  ): Promise<void> {
    try {
      if (session.isIncognito) {
        console.log(`[Phase Shift] INCOGNITO - skipping phase transition persistence`);
        return;
      }
      if (!session.userId || !session.conversationId) {
        console.log(`[Phase Shift] Skipping - missing userId or conversationId`);
        return;
      }
      
      const transitionEvent = await phaseTransitionService.transitionPhase(
        String(session.userId),
        data.to,
        data.reason,
        (session.conversationHistory || []).map(h => ({ role: h.role, content: h.content })),
        session.targetLanguage || 'es'
      );
      
      if (transitionEvent) {
        console.log(`[Phase Shift] Successfully transitioned to ${transitionEvent.toPhase}`);
        console.log(`[Phase Shift] Reason: ${data.reason}`);
      } else {
        console.log(`[Phase Shift] Transition to ${data.to} skipped (already in phase or invalid)`);
      }
      
    } catch (error: any) {
      console.error(`[Phase Shift] Failed:`, error.message);
      this.logSilentFailure(session, 'phase_shift', error.message, { targetPhase: data.to, reason: data.reason });
    }
  }
  
  /**
   * Log silent failures to production_telemetry for debugging
   * These are errors that don't break the session but should be investigated
   */
  public async logSilentFailure(
    session: StreamingSession,
    functionName: string,
    errorMessage: string,
    context: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { productionTelemetry } = await import("@shared/schema");
      const db = (await import("../db")).getSharedDb();
      
      await db.insert(productionTelemetry).values({
        sessionId: session.id,
        userId: session.userId ? String(session.userId) : null,
        eventType: 'silent_function_failure',
        errorMessage: `[${functionName}] ${errorMessage}`,
        errorDetails: JSON.stringify({
          function: functionName,
          context,
          timestamp: new Date().toISOString(),
          language: session.targetLanguage || 'unknown',
        }),
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        resolved: false,
      });
      console.log(`[Silent Failure Logged] ${functionName}: ${errorMessage.substring(0, 50)}...`);
    } catch (err: any) {
      console.warn(`[Silent Failure] Could not log to telemetry: ${err.message}`);
    }
  }
}
