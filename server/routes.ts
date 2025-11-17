import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertConversationSchema,
  insertMessageSchema,
} from "@shared/schema";
import OpenAI from "openai";

// This is using Replit's AI Integrations service for OpenAI-compatible API access
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Create system prompt based on language and difficulty
      const systemPrompt = createSystemPrompt(
        conversation.language,
        conversation.difficulty
      );

      // Generate AI response
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
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      // Save AI message
      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
      });

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
  return httpServer;
}

function createSystemPrompt(language: string, difficulty: string): string {
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

  const difficultyInstructions = {
    beginner: "Use simple vocabulary and basic sentence structures. Speak slowly and clearly. Focus on common everyday phrases and essential grammar.",
    intermediate: "Use more varied vocabulary and introduce compound sentences. You can use some idiomatic expressions but explain them when used.",
    advanced: "Use native-level vocabulary, complex grammar, and idiomatic expressions freely. Challenge the learner with nuanced language.",
  };

  return `You are a friendly and encouraging ${languageName} language tutor. 
Your student is at a ${difficulty} level.

${difficultyInstructions[difficulty as keyof typeof difficultyInstructions]}

Guidelines:
- Respond primarily in ${languageName}, but you may briefly use English to explain difficult concepts
- Correct mistakes gently and constructively
- Ask engaging questions to keep the conversation flowing
- Provide context and cultural insights when relevant
- Be encouraging and patient
- Keep responses concise and conversational (2-3 sentences typically)
- When the student makes an error, acknowledge it kindly and show the correct form

Remember: Your goal is to help the student practice ${languageName} in a natural, supportive conversation.`;
}
