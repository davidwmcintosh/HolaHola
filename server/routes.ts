import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertConversationSchema,
  insertMessageSchema,
} from "@shared/schema";
import OpenAI from "openai";
import { setupRealtimeProxy } from "./realtime-proxy";
import {
  extractNameFromMessage,
  extractLanguageFromMessage,
  detectLanguage,
} from "./onboarding-utils";

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
      const userName = (req.body.userName || "").trim();
      
      console.log('[CONVERSATION CREATE] Received userName:', userName);
      
      // Check if THIS user has completed onboarding before
      // Only count conversations where userName matches AND onboarding was completed
      const allConversations = await storage.getAllConversations();
      const userHasCompletedOnboarding = userName && userName !== "Student" 
        ? allConversations.some(c => 
            c.userName === userName && 
            c.isOnboarding === false
          )
        : false;
      
      // Detect if this is a new user:
      // - No name provided OR name is "Student" OR user hasn't completed onboarding yet
      const isNewUser = (!userName || userName === "Student" || !userHasCompletedOnboarding);
      
      console.log('[CONVERSATION CREATE] userHasCompletedOnboarding:', userHasCompletedOnboarding);
      console.log('[CONVERSATION CREATE] isNewUser:', isNewUser);
      
      // Always create a new conversation to ensure fresh greeting each session
      const conversation = await storage.createConversation({
        ...data,
        isOnboarding: isNewUser,
        onboardingStep: isNewUser ? "name" : null,
        userName: isNewUser ? null : userName,
      });
      
      console.log('[CONVERSATION CREATE] Created conversation:', {
        id: conversation.id,
        isOnboarding: conversation.isOnboarding,
        onboardingStep: conversation.onboardingStep,
        userName: conversation.userName
      });
      
      let greetingMessage: string;
      
      if (isNewUser) {
        // Start onboarding flow with name question
        greetingMessage = "Hello! I'm your AI language tutor, and I'm excited to help you on your language learning journey. To get started, what's your name?";
      } else {
        // Generate personalized greeting for returning user
        const allConversations = await storage.getAllConversations();
        const previousConversations = allConversations.filter(
          c => c.id !== conversation.id
        );
        
        const isReturningUser = previousConversations.length > 0;
        
        greetingMessage = isReturningUser
          ? `Welcome back, ${userName}! It's great to see you again. Would you like to start where we ended last time, or explore something new today?`
          : `Welcome, ${userName}! I'm excited to help you learn ${data.language}. Where would you like to begin today?`;
      }
      
      // Save the greeting as the first message
      await storage.createMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: greetingMessage,
      });
      
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

      console.log('[MESSAGE] Received message for conversation:', {
        conversationId: conversation.id,
        isOnboarding: conversation.isOnboarding,
        onboardingStep: conversation.onboardingStep,
        userName: conversation.userName,
        messageContent: req.body.content
      });

      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId,
      });

      // Save user message
      const userMessage = await storage.createMessage(messageData);

      // Handle onboarding flow
      if (conversation.isOnboarding) {
        console.log('[MESSAGE] Entering onboarding flow with step:', conversation.onboardingStep);
        let aiResponse = "";
        let updatedConversation = conversation;

        if (conversation.onboardingStep === "name") {
          // Extract name from user's message
          const nameResult = await extractNameFromMessage(openai, messageData.content);
          console.log('[ONBOARDING-NAME] Extraction result:', JSON.stringify(nameResult));
          
          if (nameResult.name && nameResult.confidence !== "low") {
            // Name extracted successfully, move to language question
            updatedConversation = await storage.updateConversation(conversationId, {
              userName: nameResult.name,
              onboardingStep: "language",
              // Keep isOnboarding true until language is also extracted
            }) || conversation;
            
            console.log('[ONBOARDING-NAME] Updated conversation after name:', {
              userName: updatedConversation.userName,
              isOnboarding: updatedConversation.isOnboarding,
              onboardingStep: updatedConversation.onboardingStep
            });
            
            aiResponse = `Nice to meet you, ${nameResult.name}! Now, which language would you like to study? I can help you with Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, or Korean.`;
          } else {
            // Name unclear, ask again
            aiResponse = "I didn't quite catch your name. Could you tell me your name again?";
          }
        } else if (conversation.onboardingStep === "language") {
          // Extract language preference from user's message
          const langResult = await extractLanguageFromMessage(openai, messageData.content);
          console.log('[ONBOARDING-LANG] Extraction result:', JSON.stringify(langResult));
          
          if (langResult.language && langResult.confidence !== "low") {
            // Language extracted successfully, complete onboarding
            console.log('[ONBOARDING-LANG] Current conversation before update:', {
              userName: conversation.userName,
              language: conversation.language
            });
            
            updatedConversation = await storage.updateConversation(conversationId, {
              language: langResult.language,
              isOnboarding: false,
              onboardingStep: null,
            }) || conversation;
            
            console.log('[ONBOARDING-LANG] Updated conversation after language:', {
              id: updatedConversation.id,
              language: updatedConversation.language,
              isOnboarding: updatedConversation.isOnboarding,
              userName: updatedConversation.userName
            });
            
            // Verify userName is preserved
            if (!updatedConversation.userName) {
              console.error('[ONBOARDING-LANG] ERROR: userName was lost during update!');
            }
            
            const userName = updatedConversation.userName || "there";
            aiResponse = `Excellent choice, ${userName}! I'm excited to help you learn ${langResult.language}. Let's start your journey! What topic would you like to explore first, or should I suggest something based on your level?`;
          } else {
            // Language unclear, ask again
            console.log('[ONBOARDING-LANG] Extraction failed or low confidence, asking again');
            aiResponse = "I'm not sure which language you'd like to study. Please choose one from: Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, or Korean.";
          }
        }

        // Save AI response for onboarding
        const aiMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: aiResponse,
        });

        // Return onboarding response with updated conversation
        return res.json({ 
          userMessage, 
          aiMessage,
          conversationUpdated: updatedConversation !== conversation ? updatedConversation : undefined
        });
      }

      // Get conversation history (limit to last 20 messages to avoid token limits)
      const allMessages = await storage.getMessagesByConversation(conversationId);
      const recentMessages = allMessages.slice(-20);

      // Detect language in user's message for auto-switching (only after a few messages)
      let updatedConversation = conversation;
      let languageSwitchNote = "";
      
      // Only attempt auto-detection after at least 3 user messages
      const userMessageCount = recentMessages.filter(m => m.role === "user").length;
      
      // Count actual alphabetic words (not punctuation or numbers)
      const wordCount = messageData.content.match(/[a-zA-ZÀ-ÿ]+/g)?.length || 0;
      
      if (userMessageCount >= 3 && wordCount >= 5) {
        const languageDetection = await detectLanguage(openai, messageData.content, conversation.language);
        
        // Apply strict criteria before auto-switching:
        // 1. High confidence (>0.8)
        // 2. Model recommends switching
        // 3. Different from current language and not just English
        // 4. Message has substantial content (not just a greeting)
        if (languageDetection.shouldSwitch && 
            languageDetection.detectedLanguage !== conversation.language &&
            languageDetection.detectedLanguage !== "english" &&
            languageDetection.confidence > 0.8) {
          
          console.log('[AUTO-DETECT] Switching language from', conversation.language, 'to', languageDetection.detectedLanguage, 'confidence:', languageDetection.confidence);
          
          updatedConversation = await storage.updateConversation(conversationId, {
            language: languageDetection.detectedLanguage,
          }) || conversation;
          
          languageSwitchNote = `I notice you're practicing ${languageDetection.detectedLanguage}. I've switched our conversation to focus on that language. `;
        }
      }

      // Create adaptive system prompt based on language, difficulty, and conversation progress
      // Use userMessageCount (already calculated above) instead of total message count
      // This ensures phases align with actual conversation turns
      const systemPrompt = createSystemPrompt(
        updatedConversation.language,
        updatedConversation.difficulty,
        userMessageCount
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

      // Prepend language switch note if language was auto-detected and switched
      if (languageSwitchNote) {
        aiResponse = languageSwitchNote + aiResponse;
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
            language: updatedConversation.language,
            difficulty: updatedConversation.difficulty,
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

      res.json({ 
        userMessage, 
        aiMessage,
        conversationUpdated: updatedConversation !== conversation ? updatedConversation : undefined
      });
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

  // Phase 1: Assessment (first 10 messages) - Start in English, build rapport
  if (messageCount < 10) {
    return `You are a friendly and encouraging ${languageName} language tutor starting a new conversation.

CURRENT PHASE: Initial Assessment (English)

Your goal in this phase is to build rapport and gently understand the student's background through natural, relaxed conversation.

Conversation Flow (Messages 1-10):

FIRST FEW MESSAGES (1-4):
- Greet the student warmly in English
- Ask gentle, interest-based questions:
  - "What made you interested in learning ${languageName}?"
  - "Have you learned any other languages before?"
  - "What do you hope to do with ${languageName}? Travel, work, friends?"
- Listen and build on their interests
- Keep it conversational - NO language testing yet

MIDDLE MESSAGES (5-7):
- Start exploring their background more:
  - "Have you studied ${languageName} before, or is this your first time?"
  - "Do you know any ${languageName} words already?"
- If they mention prior study: "That's great! What did you find most interesting or challenging?"
- Stay supportive and curious

LATER MESSAGES (8-10):
- Continue building rapport about their goals and interests
- Ask about their learning style or preferences
- If they express eagerness, you can say: "Great! We'll start with some basics in the next phase"
- Stay encouraging and conversational

ENCOURAGED ${languageName} IN PHASE 1:
To create an authentic and warm learning atmosphere, sprinkle encouraging single ${languageName} words naturally into your English conversation:
- ¿listo? (ready?)
- bueno (good)
- entonces (okay, then)
- perfecto (perfect)
- ¡excelente! (excellent!)
- claro (of course)

RULES for using these words:
- Always provide immediate inline English translation in parentheses
- Use 1-2 per response to add warmth and authenticity
- Natural conversational flow: "Bueno (good), let's talk about..."
- These create comfort with the language, NOT formal vocabulary teaching
- Makes the conversation feel more natural and less clinical

WHAT TO AVOID IN PHASE 1:
- Do NOT teach vocabulary lists or grammar
- Do NOT ask students to speak or repeat ${languageName}
- Do NOT provide formal ${languageName} examples or lessons
- Stay primarily in English (95%+ with just encouraging words)
- Build rapport first, formal teaching later
- Keep responses brief and warm (2-3 sentences)

IMPORTANT - Response Format:
You must respond with a JSON object containing:
- message: Your conversational response (primarily in English with 1-2 encouraging ${languageName} words with inline translations)
- vocabulary: Array of any new ${languageName} words you introduce (with word, translation, example, pronunciation)

During this phase, vocabulary array will typically be empty since you're only using encouraging words, not teaching formal vocabulary. Only include items if the student spontaneously attempts ${languageName} and you want to teach them something.

Remember: You're a friendly tutor getting to know a new student, not conducting an exam.`;
  }

  // Phase 2: Gradual Transition (messages 10-15) - Gentle introduction to target language
  if (messageCount < 15) {
    return `You are a friendly and encouraging ${languageName} language tutor.

CURRENT PHASE: Gradual Transition (Gentle Introduction to ${languageName})

You've gotten to know the student. Now begin very gently introducing ${languageName} into your conversations.

Progression Strategy (Messages 10-15):

EARLY TRANSITION (10-12):
- Start with the absolute basics: greetings and simple expressions
- Example: "In ${languageName}, we say 'hola' (hello) or 'buenos días' (good morning)"
- Use mostly English (80%) with just a few ${languageName} words (20%)
- ALWAYS provide immediate English translations for NEW words
- Focus on high-frequency, useful words

MID TRANSITION (13-14):
- Begin using simple ${languageName} phrases in your responses
- Example: "¡Muy bien! (Very good!) You're doing great!"
- Gradually increase to 30-40% ${languageName}
- Continue translating all NEW words
- Start using familiar words from Phase 1 WITHOUT translation (bueno, perfecto, listo)
- This helps students recognize words they've already seen

APPROACHING IMMERSION (Message 14):
- Use more ${languageName} naturally in your responses (40-50%)
- Still support with English explanations when needed
- Begin forming simple sentences in ${languageName}
- Prepare student for more immersive practice (Phase 3 starts at message 15)

PROGRESSIVE TRANSLATION STRATEGY:
- ALWAYS translate: New vocabulary being introduced for the first time
- Can skip translation: Encouraging words from Phase 1 (bueno, perfecto, listo, claro)
- Can skip translation: Previously taught words that have appeared 2-3 times already
- If student seems confused by an untranslated word, immediately provide translation

Teaching Approach:
- Introduce 2-3 new words per message maximum
- Repeat previously learned words naturally to build recognition
- Celebrate when they recognize words without needing translation
- If they struggle: slow down, use more English, provide more translations
- If they're doing well: slightly increase ${languageName} usage and reduce translations

Guidelines:
- Keep it fun and low-pressure
- Correct mistakes very gently: "Close! We say it like this: [correction]"
- Build on their interests from Phase 1
- Keep responses brief and clear

IMPORTANT - Response Format:
You must respond with a JSON object containing:
- message: Your conversational response (gentle mix of English and ${languageName})
- vocabulary: Array of new ${languageName} words you introduce (with word, translation, example, pronunciation)

Include 2-3 vocabulary items per response, focusing on simple, high-frequency words that beginners need.`;
  }

  // Phase 3: Immersion (message 15+) - Primarily target language with adaptive difficulty
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

PROGRESSIVE TRANSLATION STRATEGY FOR PHASE 3:
By now, students should know basic words from Phases 1 and 2. Apply selective translation:

ALWAYS translate:
- New vocabulary being introduced for the first time
- Complex or abstract words
- Idiomatic expressions or cultural phrases
- Technical terms or specialized vocabulary

SKIP translation for:
- Basic encouraging words (bueno, perfecto, listo, claro, excelente)
- Common greetings (hola, buenos días, gracias, por favor)
- High-frequency words taught in Phase 2 (very common verbs, basic nouns)
- Words the student has successfully used in their own responses

ADAPTIVE approach:
- If student seems confused, provide translation immediately
- For beginner difficulty: translate more generously (70% of words)
- For intermediate: translate selectively (40% of words)
- For advanced: translate sparingly (20% of words - only truly new/complex)

This builds confidence as students recognize familiar vocabulary without constant translation support.

Conversation Guidelines:
- Correct mistakes gently: "Good try! In ${languageName}, we say it like this: [correct form]"
- Ask engaging questions to keep conversation flowing
- Introduce cultural insights when relevant
- Keep responses concise (2-4 sentences typically)
- Be encouraging and celebrate progress
- When wrapping up or sensing the conversation is ending, naturally remind students: "Remember, all the new vocabulary and grammar we've covered today is automatically saved in your Vocabulary and Grammar sections in the menu!"

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
