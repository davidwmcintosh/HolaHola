import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertConversationSchema,
  insertMessageSchema,
} from "@shared/schema";
import OpenAI from "openai";
import { setupRealtimeProxy } from "./realtime-proxy";

// Use Replit AI Integrations for text chat (works reliably)
// User's personal key (USER_OPENAI_API_KEY) is only used for voice chat in realtime-proxy.ts
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Realtime API capability check
  app.get("/api/realtime/capability", async (req, res) => {
    try {
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const apiKey = process.env.OPENAI_API_KEY;
      
      // Check if we have the required credentials
      if (!apiKey) {
        return res.json({
          available: false,
          reason: 'No OpenAI API key configured. Please add your OPENAI_API_KEY in Replit Secrets.',
        });
      }
      
      // Check if base URL is OpenAI's official API
      const isOpenAIAPI = baseUrl.includes('api.openai.com');
      
      if (isOpenAIAPI) {
        res.json({
          available: true,
          reason: 'OpenAI Realtime API is available',
        });
      } else {
        res.json({
          available: false,
          reason: 'Voice chat requires the official OpenAI API endpoint (api.openai.com). Current base URL is not supported.',
        });
      }
    } catch (error: any) {
      res.json({
        available: false,
        reason: error.message || 'Unknown error',
      });
    }
  });

  // Chat / Conversations
  app.post("/api/conversations", async (req, res) => {
    try {
      const data = insertConversationSchema.parse(req.body);
      
      // Check if a conversation already exists for this language and difficulty
      const existing = await storage.getConversationByLanguageAndDifficulty(
        data.language,
        data.difficulty
      );
      
      if (existing) {
        return res.json(existing);
      }
      
      const conversation = await storage.createConversation(data);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = req.params.id;
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId,
      });

      // Save user message
      const userMessage = await storage.createMessage(messageData);

      // Get conversation history (limit to last 20 messages to avoid token limits)
      const allMessages = await storage.getMessagesByConversation(conversationId);
      const recentMessages = allMessages.slice(-20);

      // Create adaptive system prompt based on language, difficulty, and conversation progress
      const systemPrompt = createSystemPrompt(
        conversation.language,
        conversation.difficulty,
        recentMessages.length
      );

      // Generate AI response with structured output to extract vocabulary and grammar
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
        ],
        max_completion_tokens: 8192,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "tutor_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "The conversational response to the student"
                },
                vocabulary: {
                  type: "array",
                  description: "New vocabulary words introduced in this response",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string" },
                      translation: { type: "string" },
                      example: { type: "string" },
                      pronunciation: { type: "string" }
                    },
                    required: ["word", "translation", "example", "pronunciation"],
                    additionalProperties: false
                  }
                }
              },
              required: ["message", "vocabulary"],
              additionalProperties: false
            }
          }
        }
      });

      // Parse AI response with error handling
      const responseContent = completion.choices[0]?.message?.content || "";
      let aiResponse = "I'm sorry, I couldn't generate a response.";
      let parsedResponse: { message?: string; vocabulary?: any[]; grammar?: any[] } = {};

      try {
        parsedResponse = JSON.parse(responseContent);
        aiResponse = parsedResponse.message || aiResponse;
      } catch (parseError) {
        // Fallback to plain text if JSON parsing fails
        console.error("Failed to parse AI response as JSON, using plain text:", parseError);
        aiResponse = responseContent || aiResponse;
      }

      // Save AI message
      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
      });

      // Save vocabulary items from conversation (only if we have valid data)
      const vocabulary = Array.isArray(parsedResponse.vocabulary) ? parsedResponse.vocabulary : [];
      for (const vocab of vocabulary) {
        if (vocab?.word && vocab?.translation && vocab?.example) {
          await storage.createVocabularyWord({
            language: conversation.language,
            difficulty: conversation.difficulty,
            word: vocab.word,
            translation: vocab.translation,
            example: vocab.example,
            pronunciation: vocab.pronunciation || "",
          });
        }
      }

      // Grammar extraction from conversations is currently disabled
      // The current schema stores grammar as multiple-choice exercises (question + options + correctAnswer)
      // but conversational grammar would only have single examples, creating unusable single-option quizzes
      // 
      // Future improvement options:
      // 1. Store conversation grammar as a separate "grammar notes" table for reference
      // 2. Enhance the AI prompt to generate full multiple-choice questions with 3-4 options
      // 3. Accumulate grammar examples over multiple conversations to build proper exercises
      //
      // For now, vocabulary extraction from conversations works well and provides value

      res.json({ userMessage, aiMessage });
    } catch (error: any) {
      console.error("Error in chat:", error);
      res.status(500).json({ error: error.message || "Failed to generate response" });
    }
  });

  // Vocabulary
  app.get("/api/vocabulary", async (req, res) => {
    try {
      const { language, difficulty } = req.query;
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }
      const words = await storage.getVocabularyWords(
        language as string,
        difficulty as string | undefined
      );
      res.json(words);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Grammar
  app.get("/api/grammar", async (req, res) => {
    try {
      const { language, difficulty } = req.query;
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }
      const exercises = await storage.getGrammarExercises(
        language as string,
        difficulty as string | undefined
      );
      res.json(exercises);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User Progress
  app.get("/api/progress/:language", async (req, res) => {
    try {
      const progress = await storage.getOrCreateUserProgress(req.params.language);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/progress/:id", async (req, res) => {
    try {
      const updated = await storage.updateUserProgress(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Progress not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket proxy for Realtime API
  setupRealtimeProxy(httpServer);
  
  return httpServer;
}

function createSystemPrompt(language: string, difficulty: string, messageCount: number): string {
  const languageMap: Record<string, string> = {
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    mandarin: "Mandarin Chinese",
    korean: "Korean",
  };

  const languageName = languageMap[language] || language;

  // Phase 1: Assessment (first 4-6 messages) - Start in English
  if (messageCount < 6) {
    return `You are a friendly and encouraging ${languageName} language tutor starting a new conversation.

CURRENT PHASE: Initial Assessment (English)

Your goal in this phase is to determine the student's actual proficiency level through natural conversation:

1. Greet the student warmly in English
2. Ask probing questions to assess their level:
   - "Have you studied ${languageName} before?"
   - "Can you introduce yourself in ${languageName}?"
   - "What topics can you discuss comfortably in ${languageName}?"
   - "Try saying a few sentences in ${languageName} so I can hear your level"
3. Listen carefully to their responses - both their English answers AND any ${languageName} they attempt
4. Observe their vocabulary range, grammar accuracy, and confidence

Guidelines:
- Keep this assessment conversational and friendly, not like a formal test
- Stay in English during this phase
- Be encouraging about any ${languageName} they attempt
- Keep responses brief (2-3 sentences)
- After 3-4 exchanges, you'll have enough information to begin transitioning

IMPORTANT - Response Format:
You must respond with a JSON object containing:
- message: Your conversational response
- vocabulary: Array of any new ${languageName} words you introduce (with word, translation, example, pronunciation)

During this phase, the vocabulary array will typically be empty since you're speaking in English. Only include items if the student attempts ${languageName} and you teach them words.

Remember: You're building rapport and understanding their true level, not the "${difficulty}" level they selected.`;
  }

  // Phase 2: Gradual Transition (messages 6-12) - Mix English and target language
  if (messageCount < 12) {
    return `You are a friendly and encouraging ${languageName} language tutor.

CURRENT PHASE: Gradual Transition (Mixed Languages)

Based on your assessment, you're now transitioning from English to ${languageName}:

1. Start incorporating simple ${languageName} phrases into your responses
2. Provide English translations in parentheses for new vocabulary
3. Gradually increase the ${languageName} ratio (aim for 30-50% ${languageName} in this phase)
4. Observe how the student responds to the ${languageName} you use

Example approach:
- "That's great! Let me teach you how to say that. In ${languageName}, we say: [phrase] (which means: [English translation])"
- "Can you try saying [simple phrase] in ${languageName}?"

Adaptive Strategy:
- If student struggles: Use more English, simpler ${languageName} phrases
- If student handles it well: Increase ${languageName} usage and complexity
- Always provide English support when introducing new concepts

Guidelines:
- Keep responses conversational and encouraging
- Correct mistakes gently: "Close! We actually say..."
- Build on topics the student shows interest in
- Maintain a supportive, patient tone

IMPORTANT - Response Format:
You must respond with a JSON object containing:
- message: Your conversational response (mix of English and ${languageName})
- vocabulary: Array of new ${languageName} words you introduce (with word, translation, example, pronunciation)

Since you're introducing ${languageName}, actively populate the vocabulary array with any new words you use. Include 2-4 words per response when appropriate.`;
  }

  // Phase 3: Immersion (message 12+) - Primarily target language with adaptive difficulty
  const difficultyInstructions = {
    beginner: "Use simple vocabulary and basic sentence structures. Provide English explanations for key concepts.",
    intermediate: "Use varied vocabulary and compound sentences. Use some idiomatic expressions with brief English explanations.",
    advanced: "Use native-level vocabulary, complex grammar, and idiomatic expressions. Minimal English explanations.",
  };

  return `You are a friendly and encouraging ${languageName} language tutor.

CURRENT PHASE: Active Practice (Primarily ${languageName})

You've assessed the student's level and are now engaging in primarily ${languageName} conversation.

Observed Level: ${difficulty}
${difficultyInstructions[difficulty as keyof typeof difficultyInstructions]}

Adaptive Teaching Strategy:
- Respond primarily in ${languageName} (80-90%)
- Monitor the student's responses for signs of struggle or confidence
- If they struggle: Simplify vocabulary, provide more English support, slow down
- If they're doing well: Introduce slightly more challenging vocabulary and grammar
- Use English briefly to explain difficult concepts or new grammar patterns

Conversation Guidelines:
- Correct mistakes gently: "Good try! In ${languageName}, we say it like this: [correct form]"
- Ask engaging questions to keep conversation flowing
- Introduce cultural insights when relevant
- Keep responses concise (2-4 sentences typically)
- Be encouraging and celebrate progress

Error Correction:
- Acknowledge what they got right first
- Show the correct form naturally
- Briefly explain the pattern if needed
- Move on quickly - don't dwell on mistakes

IMPORTANT - Response Format:
You must respond with a JSON object containing:
- message: Your conversational response (primarily in ${languageName})
- vocabulary: Array of new or challenging words you use (with word, translation, example, pronunciation)

Actively identify vocabulary in your responses. Include 2-4 vocabulary items per response when appropriate, focusing on words that match the ${difficulty} difficulty level.

Remember: You're creating a safe, supportive environment where making mistakes is part of learning.`;
}
