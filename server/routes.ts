import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertProgressHistorySchema,
  insertPronunciationScoreSchema,
} from "@shared/schema";
import OpenAI from "openai";
import { setupRealtimeProxy } from "./realtime-proxy";
import {
  extractNameFromMessage,
  extractLanguageFromMessage,
  extractNativeLanguageFromMessage,
  detectLanguage,
} from "./onboarding-utils";
import { createSystemPrompt } from "./system-prompt";
import { assessMessage, analyzePerformance } from "./difficulty-adjustment";

// Use Replit AI Integrations for text chat (works reliably)
// User's personal key (USER_OPENAI_API_KEY) is only used for voice chat in realtime-proxy.ts
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Realtime API capability check - actually tests API access
  // Cache the result for 5 minutes to avoid repeated checks
  let capabilityCache: { available: boolean; reason: string; code?: string; timestamp: number } | null = null;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  app.get("/api/realtime/capability", async (req, res) => {
    try {
      // Check if client is forcing a fresh check (e.g., via "Recheck Access" button)
      const forceRecheck = req.query.force === 'true';
      
      // Return cached result if still valid and not forcing recheck
      if (!forceRecheck && capabilityCache && (Date.now() - capabilityCache.timestamp < CACHE_DURATION)) {
        return res.json({
          available: capabilityCache.available,
          reason: capabilityCache.reason,
          code: capabilityCache.code,
          cached: true,
        });
      }

      const apiKey = process.env.USER_OPENAI_API_KEY;
      
      // Check if we have the required credentials
      if (!apiKey) {
        const result = {
          available: false,
          reason: 'Voice chat requires an OpenAI API key with Realtime API access. Please set USER_OPENAI_API_KEY in your Replit Secrets with a key from platform.openai.com.',
          code: 'missing_api_key',
          timestamp: Date.now(),
        };
        capabilityCache = result;
        return res.json(result);
      }

      // Actually test Realtime API access with a minimal session request
      const testUrl = 'https://api.openai.com/v1/realtime/sessions';
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy',
        }),
      });

      if (testResponse.ok) {
        // Success! API key has Realtime access
        const result = {
          available: true,
          reason: 'Voice chat is ready! Your API key has Realtime API access.',
          code: 'ready',
          timestamp: Date.now(),
        };
        capabilityCache = result;
        return res.json(result);
      }

      // Parse error response
      const errorData = await testResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || 'Unknown error';
      const errorType = errorData.error?.type || 'unknown';

      // Map specific error types to helpful messages
      let reason = '';
      let code = '';
      
      if (testResponse.status === 401 || testResponse.status === 403) {
        reason = 'Your API key doesn\'t have access to the Realtime API. This requires a paid OpenAI account with Realtime API enabled. Please check your account at platform.openai.com.';
        code = 'access_denied';
      } else if (testResponse.status === 429) {
        reason = 'Rate limit exceeded or quota reached. Please check your OpenAI account billing and usage at platform.openai.com.';
        code = 'rate_limit';
      } else if (testResponse.status >= 500) {
        reason = 'OpenAI\'s servers are experiencing issues. Please try again in a few minutes.';
        code = 'server_error';
      } else {
        reason = `Voice chat unavailable: ${errorMessage}`;
        code = 'unknown_error';
      }

      const result = {
        available: false,
        reason,
        code,
        timestamp: Date.now(),
      };
      capabilityCache = result;
      res.json(result);

    } catch (error: any) {
      const result = {
        available: false,
        reason: `Failed to check voice chat availability: ${error.message}. Please check your internet connection.`,
        code: 'network_error',
        timestamp: Date.now(),
      };
      capabilityCache = result;
      res.json(result);
    }
  });

  // Chat / Conversations
  app.post("/api/conversations", async (req, res) => {
    try {
      const data = insertConversationSchema.parse(req.body);
      const userName = (req.body.userName || "").trim();
      const isOnboardingExplicit = req.body.isOnboarding;
      
      console.log('[CONVERSATION CREATE] Received userName:', userName);
      console.log('[CONVERSATION CREATE] isOnboarding explicit:', isOnboardingExplicit);
      
      // If isOnboarding is explicitly set (e.g., from ThreadSelector), use it
      // Otherwise, auto-detect based on user's onboarding status
      let isOnboarding: boolean;
      let userNativeLanguage: string | undefined;
      
      if (typeof isOnboardingExplicit === 'boolean') {
        // Explicitly set - use it (for manually created threads)
        isOnboarding = isOnboardingExplicit;
      } else {
        // Auto-detect for first-time visits
        const allConversations = await storage.getAllConversations();
        const userHasCompletedOnboarding = userName && userName !== "Student" 
          ? allConversations.some(c => 
              c.userName === userName && 
              c.isOnboarding === false
            )
          : false;
        
        const isNewUser = (!userName || userName === "Student" || !userHasCompletedOnboarding);
        isOnboarding = isNewUser;
        
        // If user has completed onboarding, retrieve their nativeLanguage from previous conversations
        if (!isNewUser && userName) {
          console.log('[CONVERSATION CREATE] Looking for previous conversations for user:', userName);
          console.log('[CONVERSATION CREATE] Total conversations in storage:', allConversations.length);
          console.log('[CONVERSATION CREATE] All conversations:', allConversations.map(c => ({ 
            id: c.id, 
            userName: c.userName, 
            nativeLanguage: c.nativeLanguage, 
            isOnboarding: c.isOnboarding,
            language: c.language
          })));
          
          const userPreviousConversations = allConversations
            .filter(c => c.userName === userName && c.nativeLanguage)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          
          console.log('[CONVERSATION CREATE] Found', userPreviousConversations.length, 'previous conversations for user:', userName);
          console.log('[CONVERSATION CREATE] Previous conversations:', userPreviousConversations.map(c => ({ id: c.id, nativeLanguage: c.nativeLanguage, isOnboarding: c.isOnboarding })));
          
          if (userPreviousConversations.length > 0) {
            userNativeLanguage = userPreviousConversations[0].nativeLanguage || undefined;
            console.log('[CONVERSATION CREATE] Inherited nativeLanguage from previous conversation:', userNativeLanguage);
          } else {
            console.log('[CONVERSATION CREATE] No previous conversations with nativeLanguage found, will use default');
          }
        }
        
        console.log('[CONVERSATION CREATE] userHasCompletedOnboarding:', userHasCompletedOnboarding);
        console.log('[CONVERSATION CREATE] isNewUser (auto-detected):', isNewUser);
      }
      
      // Always create a new conversation to ensure fresh greeting each session
      const conversation = await storage.createConversation({
        ...data,
        isOnboarding,
        onboardingStep: isOnboarding ? "name" : null,
        userName: isOnboarding ? null : userName,
        nativeLanguage: userNativeLanguage || data.nativeLanguage || "english",
      });
      
      console.log('[CONVERSATION CREATE] Created conversation:', {
        id: conversation.id,
        isOnboarding: conversation.isOnboarding,
        onboardingStep: conversation.onboardingStep,
        userName: conversation.userName,
        nativeLanguage: conversation.nativeLanguage
      });
      
      let greetingMessage: string;
      
      if (isOnboarding) {
        // Start onboarding flow with name question
        greetingMessage = "Hello! I'm your AI language tutor, and I'm excited to help you on your language learning journey. To get started, may I ask your name please?";
      } else {
        // Check if we should include previous conversation history
        const includeHistory = req.body.includeConversationHistory === true;
        
        if (includeHistory) {
          // Fetch previous conversations for this user and language
          const previousConversations = await storage.getConversationsByLanguage(data.language);
          const userPreviousConvos = previousConversations.filter(
            c => c.id !== conversation.id && 
                 !c.isOnboarding && 
                 c.userName === userName &&
                 c.messageCount && c.messageCount > 1 // Only include conversations with actual back-and-forth
          );
          
          if (userPreviousConvos.length > 0) {
            // Format previous conversation info for the AI
            const conversationContext = userPreviousConvos
              .slice(0, 5) // Limit to 5 most recent
              .map((c, idx) => `${idx + 1}. "${c.title || `Conversation from ${new Date(c.createdAt).toLocaleDateString()}`}" (${c.messageCount} messages)`)
              .join('\n');
            
            // Generate greeting in native language with conversation history
            const nativeLanguage = conversation.nativeLanguage || "english";
            console.log('[GREETING WITH HISTORY] Generating greeting:', {
              nativeLanguage,
              userName,
              targetLanguage: data.language,
              conversationId: conversation.id
            });
            
            const greetingPrompt = `You are a ${data.language} language tutor. The student's name is ${userName} and their native language is ${nativeLanguage}.
            
            Write a brief, friendly greeting IN ${nativeLanguage} welcoming them back. Mention they have previous conversations and ask if they want to continue one or start fresh. Use ONLY ${nativeLanguage}.`;
            
            console.log('[GREETING PROMPT]', greetingPrompt);
            
            try {
              const greetingResponse = await openai.chat.completions.create({
                model: "gpt-5",
                messages: [{ role: "user", content: greetingPrompt }],
                max_completion_tokens: 150,
              });
              greetingMessage = greetingResponse.choices[0].message.content || `Welcome back, ${userName}! I see you have some previous conversations. Would you like to continue one or start fresh?`;
              console.log('[GREETING SUCCESS] Generated:', greetingMessage.substring(0, 100));
            } catch (error) {
              console.error('[GREETING ERROR]', error);
              greetingMessage = `Welcome back, ${userName}! I see you have some previous conversations:\n\n${conversationContext}\n\nWould you like to continue one of these conversations, or shall we start something new today?`;
              console.log('[GREETING FALLBACK] Using English fallback');
            }
          } else {
            // First conversation for this language - generate in native language
            const nativeLanguage = conversation.nativeLanguage || "english";
            console.log('[GREETING FIRST TIME] Generating greeting:', {
              nativeLanguage,
              userName,
              targetLanguage: data.language,
              conversationId: conversation.id
            });
            
            const greetingPrompt = `You are a ${data.language} language tutor. The student's name is ${userName} and their native language is ${nativeLanguage}.
            
            Write a brief, friendly greeting IN ${nativeLanguage} welcoming them and asking where they'd like to begin learning ${data.language}. Use ONLY ${nativeLanguage}.`;
            
            console.log('[GREETING PROMPT]', greetingPrompt);
            
            try {
              const greetingResponse = await openai.chat.completions.create({
                model: "gpt-5",
                messages: [{ role: "user", content: greetingPrompt }],
                max_completion_tokens: 150,
              });
              greetingMessage = greetingResponse.choices[0].message.content || `Welcome, ${userName}! I'm excited to help you learn ${data.language}. Where would you like to begin today?`;
              console.log('[GREETING SUCCESS] Generated:', greetingMessage.substring(0, 100));
            } catch (error) {
              console.error('[GREETING ERROR]', error);
              greetingMessage = `Welcome, ${userName}! I'm excited to help you learn ${data.language}. Where would you like to begin today?`;
              console.log('[GREETING FALLBACK] Using English fallback');
            }
          }
        } else {
          // Standard greeting without history - generate in native language
          const nativeLanguage = conversation.nativeLanguage || "english";
          console.log('[GREETING STANDARD] Generating greeting:', {
            nativeLanguage,
            userName,
            targetLanguage: data.language,
            conversationId: conversation.id
          });
          
          const greetingPrompt = `You are a ${data.language} language tutor. The student's name is ${userName} and their native language is ${nativeLanguage}.
          
          Write a brief, friendly greeting IN ${nativeLanguage} welcoming them and asking where they'd like to begin learning ${data.language}. Use ONLY ${nativeLanguage}.`;
          
          console.log('[GREETING PROMPT]', greetingPrompt);
          
          try {
            const greetingResponse = await openai.chat.completions.create({
              model: "gpt-5",
              messages: [{ role: "user", content: greetingPrompt }],
              max_completion_tokens: 150,
            });
            greetingMessage = greetingResponse.choices[0].message.content || `Welcome, ${userName}! I'm excited to help you learn ${data.language}. Where would you like to begin today?`;
            console.log('[GREETING SUCCESS] Generated:', greetingMessage.substring(0, 100));
          } catch (error) {
            console.error('[GREETING ERROR]', error);
            greetingMessage = `Welcome, ${userName}! I'm excited to help you learn ${data.language}. Where would you like to begin today?`;
            console.log('[GREETING FALLBACK] Using English fallback');
          }
        }
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

  app.get("/api/conversations/by-language/:language", async (req, res) => {
    try {
      const conversations = await storage.getConversationsByLanguage(req.params.language);
      res.json(conversations);
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

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const success = await storage.deleteConversation(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ success: true });
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

      // Save user message (initially without performance score)
      const userMessage = await storage.createMessage(messageData);
      
      // Track performance for non-onboarding messages
      if (!conversation.isOnboarding) {
        const assessment = assessMessage(messageData.content, conversation.difficulty);
        
        // Update message with performance score (persist to storage)
        await storage.updateMessage(userMessage.id, {
          performanceScore: assessment.score,
        });
        
        // Update conversation performance stats - re-fetch to get latest values
        const latestConversation = await storage.getConversation(conversationId);
        if (latestConversation) {
          const isSuccessful = assessment.isSuccessful;
          await storage.updateConversation(conversationId, {
            successfulMessages: latestConversation.successfulMessages + (isSuccessful ? 1 : 0),
            totalAssessedMessages: latestConversation.totalAssessedMessages + 1,
          });
        }
      }

      // Simple inappropriate content check for onboarding
      const containsInappropriateContent = (message: string): boolean => {
        const lowerMessage = message.toLowerCase();
        const inappropriateTerms = [
          'offensive', 'curse', 'swear', 'bad words', 'profan', 'explicit', 'sexual',
          'violent', 'insult', 'slur', 'derogatory', 'fuck', 'shit', 'damn', 'hell',
          'crap', 'ass', 'bitch',
        ];
        return inappropriateTerms.some(term => lowerMessage.includes(term));
      };

      // Handle onboarding flow
      if (conversation.isOnboarding) {
        console.log('[MESSAGE] Entering onboarding flow with step:', conversation.onboardingStep);
        
        // Check for inappropriate content during onboarding
        if (containsInappropriateContent(messageData.content)) {
          // Reset onboarding to the beginning - clear all onboarding state
          await storage.updateConversation(conversationId, {
            userName: undefined,
            language: conversation.language, // Keep existing language
            onboardingStep: "name",
            isOnboarding: true,
          });
          
          const aiMessage = await storage.createMessage({
            conversationId,
            role: "assistant",
            content: "I focus on teaching practical, everyday language. Let's get started with your language learning! May I ask your name please?",
          });
          return res.json({ userMessage, aiMessage });
        }

        let aiResponse = "";
        let updatedConversation = conversation;

        if (conversation.onboardingStep === "name") {
          // Extract name from user's message
          const nameResult = await extractNameFromMessage(openai, messageData.content);
          console.log('[ONBOARDING-NAME] Extraction result:', JSON.stringify(nameResult));
          
          if (nameResult.name && nameResult.confidence !== "low") {
            // Name extracted successfully, move to target language question
            updatedConversation = await storage.updateConversation(conversationId, {
              userName: nameResult.name,
              onboardingStep: "targetLanguage",
              // Keep isOnboarding true until all steps are complete
            }) || conversation;
            
            console.log('[ONBOARDING-NAME] Updated conversation after name:', {
              userName: updatedConversation.userName,
              isOnboarding: updatedConversation.isOnboarding,
              onboardingStep: updatedConversation.onboardingStep
            });
            
            aiResponse = `Nice to meet you, ${nameResult.name}! Which language would you like to study?`;
          } else {
            // Name unclear, ask again
            aiResponse = "I didn't quite catch your name. Could you tell me your name again?";
          }
        } else if (conversation.onboardingStep === "targetLanguage" || conversation.onboardingStep === "language") {
          // Extract target language preference from user's message
          // Note: "language" is for backward compatibility with existing conversations
          const langResult = await extractLanguageFromMessage(openai, messageData.content);
          console.log('[ONBOARDING-TARGET-LANG] Extraction result:', JSON.stringify(langResult));
          
          if (langResult.language && langResult.confidence !== "low") {
            // Target language extracted successfully, move to native language question
            console.log('[ONBOARDING-TARGET-LANG] Current conversation before update:', {
              userName: conversation.userName,
              language: conversation.language
            });
            
            updatedConversation = await storage.updateConversation(conversationId, {
              language: langResult.language,
              onboardingStep: "nativeLanguage",
              // Keep isOnboarding true until native language is also extracted
            }) || conversation;
            
            console.log('[ONBOARDING-TARGET-LANG] Updated conversation after target language:', {
              id: updatedConversation.id,
              language: updatedConversation.language,
              isOnboarding: updatedConversation.isOnboarding,
              userName: updatedConversation.userName,
              onboardingStep: updatedConversation.onboardingStep
            });
            
            // Verify userName is preserved
            if (!updatedConversation.userName) {
              console.error('[ONBOARDING-TARGET-LANG] ERROR: userName was lost during update!');
            }
            
            const userName = updatedConversation.userName || "there";
            aiResponse = `Great! And what is your native language, ${userName}? (The language you already speak)`;
          } else {
            // Language unclear, ask again
            console.log('[ONBOARDING-TARGET-LANG] Extraction failed or low confidence, asking again');
            aiResponse = "I'm not sure which language you'd like to study. Please choose one from: Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, or Korean.";
          }
        } else if (conversation.onboardingStep === "nativeLanguage") {
          // Extract native language from user's message
          const nativeLangResult = await extractNativeLanguageFromMessage(openai, messageData.content);
          console.log('[ONBOARDING-NATIVE-LANG] Extraction result:', JSON.stringify(nativeLangResult));
          
          if (nativeLangResult.language && nativeLangResult.confidence !== "low") {
            // Native language extracted successfully, complete onboarding
            console.log('[ONBOARDING-NATIVE-LANG] Current conversation before update:', {
              userName: conversation.userName,
              language: conversation.language,
              nativeLanguage: conversation.nativeLanguage
            });
            
            updatedConversation = await storage.updateConversation(conversationId, {
              nativeLanguage: nativeLangResult.language,
              isOnboarding: false,
              onboardingStep: null,
            }) || conversation;
            
            console.log('[ONBOARDING-NATIVE-LANG] Updated conversation after native language:', {
              id: updatedConversation.id,
              language: updatedConversation.language,
              nativeLanguage: updatedConversation.nativeLanguage,
              isOnboarding: updatedConversation.isOnboarding,
              userName: updatedConversation.userName
            });
            
            // Verify userName is preserved
            if (!updatedConversation.userName) {
              console.error('[ONBOARDING-NATIVE-LANG] ERROR: userName was lost during update!');
            }
            
            const userName = updatedConversation.userName || "there";
            const targetLanguage = updatedConversation.language;
            const nativeLanguage = updatedConversation.nativeLanguage || "english";
            
            console.log('[ONBOARDING-COMPLETION] Generating completion message:', {
              userName,
              targetLanguage,
              nativeLanguage,
              conversationId: updatedConversation.id
            });
            
            // Generate the completion message in the user's native language
            const nativeLanguagePrompt = `You are a language tutor. The student's name is ${userName}, they want to learn ${targetLanguage}, and their native language is ${nativeLanguage}. 
            
            Write a brief, friendly message IN ${nativeLanguage} asking them what motivated them to learn ${targetLanguage}. Keep it conversational and encouraging. Use ONLY ${nativeLanguage} for your response.`;
            
            console.log('[ONBOARDING-COMPLETION PROMPT]', nativeLanguagePrompt);
            
            try {
              const completionResponse = await openai.chat.completions.create({
                model: "gpt-5",
                messages: [{ role: "user", content: nativeLanguagePrompt }],
                max_completion_tokens: 150,
              });
              
              aiResponse = completionResponse.choices[0].message.content || `Perfect, ${userName}! What made you interested in learning ${targetLanguage}?`;
              console.log('[ONBOARDING-COMPLETION SUCCESS] Generated:', aiResponse.substring(0, 100));
            } catch (error) {
              console.error('[ONBOARDING-COMPLETION ERROR]', error);
              aiResponse = `Perfect, ${userName}! What made you interested in learning ${targetLanguage}?`;
              console.log('[ONBOARDING-COMPLETION FALLBACK] Using English fallback');
            }
          } else {
            // Native language unclear, ask again
            console.log('[ONBOARDING-NATIVE-LANG] Extraction failed or low confidence, asking again');
            aiResponse = "I didn't quite catch that. What language do you speak? (For example: English, Spanish, French, German, etc.)";
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

      // Fetch previous conversations for this user and language (for conversation switching)
      const allUserConversations = await storage.getConversationsByLanguage(updatedConversation.language);
      const previousConversations = allUserConversations
        .filter(c => 
          c.id !== conversationId && 
          !c.isOnboarding && 
          c.userName === updatedConversation.userName &&
          c.messageCount && c.messageCount > 1
        )
        .slice(0, 5) // Limit to 5 most recent
        .map(c => ({
          id: c.id,
          title: c.title,
          messageCount: c.messageCount,
          createdAt: c.createdAt.toISOString()
        }));

      // Create adaptive system prompt based on language, difficulty, and conversation progress
      // Use userMessageCount (already calculated above) instead of total message count
      // This ensures phases align with actual conversation turns
      const systemPrompt = createSystemPrompt(
        updatedConversation.language,
        updatedConversation.difficulty,
        userMessageCount,
        false, // not voice mode
        updatedConversation.topic,
        previousConversations.length > 0 ? previousConversations : undefined,
        updatedConversation.nativeLanguage
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

      // Check for conversation switching directive
      const switchDirectivePattern = /\[\[SWITCH_CONVERSATION:([a-f0-9-]+)\]\]/i;
      const switchMatch = aiResponse.match(switchDirectivePattern);
      let switchedConversation: any = null;
      
      if (switchMatch) {
        const targetConversationId = switchMatch[1];
        console.log('[CONVERSATION SWITCH] Detected switch directive to:', targetConversationId);
        
        // Validate the target conversation exists and belongs to the user
        const targetConversation = await storage.getConversation(targetConversationId);
        
        if (targetConversation && 
            targetConversation.userName === updatedConversation.userName &&
            targetConversation.language === updatedConversation.language &&
            !targetConversation.isOnboarding) {
          
          console.log('[CONVERSATION SWITCH] Valid switch target found:', {
            id: targetConversation.id,
            title: targetConversation.title,
            messageCount: targetConversation.messageCount
          });
          
          // Strip the directive from the response
          aiResponse = aiResponse.replace(switchDirectivePattern, '').trim();
          
          // Set the switched conversation for the response
          switchedConversation = {
            id: targetConversation.id,
            switchedFrom: conversationId,
            title: targetConversation.title,
            messageCount: targetConversation.messageCount
          };
        } else {
          console.warn('[CONVERSATION SWITCH] Invalid switch target - conversation not found or not accessible');
          // Strip the directive even if invalid, so it doesn't show to the user
          aiResponse = aiResponse.replace(switchDirectivePattern, '').trim();
        }
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
        conversationUpdated: updatedConversation !== conversation ? updatedConversation : undefined,
        switchedConversation: switchedConversation || undefined
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

  app.patch("/api/vocabulary/:id/review", async (req, res) => {
    try {
      const { id } = req.params;
      const { isCorrect } = req.body;
      
      if (typeof isCorrect !== "boolean") {
        return res.status(400).json({ error: "isCorrect must be a boolean" });
      }
      
      const updatedWord = await storage.updateVocabularyReview(id, isCorrect);
      
      if (!updatedWord) {
        return res.status(404).json({ error: "Vocabulary word not found" });
      }
      
      res.json(updatedWord);
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

  // Progress History
  app.get("/api/progress-history/:language", async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const history = await storage.getProgressHistory(req.params.language, days);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/progress-history", async (req, res) => {
    try {
      const validated = insertProgressHistorySchema.parse(req.body);
      const history = await storage.createProgressHistory(validated);
      res.status(201).json(history);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid progress history data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Difficulty adjustment recommendation
  app.get("/api/difficulty-recommendation/:conversationId", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Get recent message scores for average calculation
      const messages = await storage.getMessagesByConversation(req.params.conversationId);
      const assessedMessages = messages
        .filter(m => m.role === "user" && m.performanceScore !== null);
      
      // Get last 20 assessed messages (take from end of array)
      const recentScores = assessedMessages
        .slice(Math.max(0, assessedMessages.length - 20))
        .map(m => m.performanceScore!);

      // Get user progress for last adjustment date
      const progress = await storage.getOrCreateUserProgress(conversation.language);

      // Analyze performance - convert date if it's a string
      const lastAdjustment = progress.lastDifficultyAdjustment 
        ? new Date(progress.lastDifficultyAdjustment)
        : null;
      
      const analysis = analyzePerformance(
        conversation.successfulMessages,
        conversation.totalAssessedMessages,
        conversation.difficulty,
        lastAdjustment,
        recentScores
      );

      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH conversation
  app.patch("/api/conversations/:id", async (req, res) => {
    try {
      const updated = await storage.updateConversation(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH progress by language (convenience endpoint for difficulty adjustments)
  app.patch("/api/progress/:languageOrId", async (req, res) => {
    try {
      // First try to find by language, then by ID
      const progress = await storage.getOrCreateUserProgress(req.params.languageOrId);
      const updated = await storage.updateUserProgress(progress.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Progress not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Pronunciation Scores - Analyze and save
  app.post("/api/pronunciation-scores/analyze", async (req, res) => {
    try {
      const { messageId, conversationId, transcribedText } = req.body;
      
      if (!messageId || !conversationId || !transcribedText) {
        return res.status(400).json({ error: "messageId, conversationId, and transcribedText are required" });
      }

      // Get conversation to determine language and difficulty
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Import pronunciation analysis
      const { analyzePronunciation } = await import("./pronunciation-analysis");
      
      // Analyze pronunciation
      const analysis = await analyzePronunciation(
        transcribedText,
        conversation.language,
        conversation.difficulty
      );

      // Save the score
      const score = await storage.createPronunciationScore({
        messageId,
        conversationId,
        transcribedText,
        targetPhrase: null,
        score: analysis.score,
        feedback: analysis.feedback,
        phoneticIssues: analysis.phoneticIssues.length > 0 ? analysis.phoneticIssues : null,
      });

      // Return full analysis to client
      res.status(201).json({
        ...score,
        strengths: analysis.strengths,
      });
    } catch (error: any) {
      console.error("Error analyzing pronunciation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Pronunciation Scores - Create manually (for future use)
  app.post("/api/pronunciation-scores", async (req, res) => {
    try {
      const validated = insertPronunciationScoreSchema.parse(req.body);
      const score = await storage.createPronunciationScore(validated);
      res.status(201).json(score);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid pronunciation score data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pronunciation-scores/conversation/:conversationId", async (req, res) => {
    try {
      const scores = await storage.getPronunciationScoresByConversation(req.params.conversationId);
      res.json(scores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pronunciation-scores/message/:messageId", async (req, res) => {
    try {
      const score = await storage.getPronunciationScoreByMessage(req.params.messageId);
      if (!score) {
        return res.status(404).json({ error: "Pronunciation score not found" });
      }
      res.json(score);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pronunciation-scores/stats/:conversationId", async (req, res) => {
    try {
      const stats = await storage.getPronunciationScoreStats(req.params.conversationId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Topics
  app.get("/api/topics", async (req, res) => {
    try {
      const topics = await storage.getTopics();
      res.json(topics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/topics/:id", async (req, res) => {
    try {
      const topic = await storage.getTopic(req.params.id);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cultural Tips
  app.get("/api/cultural-tips/:language", async (req, res) => {
    try {
      const tips = await storage.getCulturalTips(req.params.language);
      res.json(tips);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/cultural-tips/id/:id", async (req, res) => {
    try {
      const tip = await storage.getCulturalTip(req.params.id);
      if (!tip) {
        return res.status(404).json({ error: "Cultural tip not found" });
      }
      res.json(tip);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket proxy for Realtime API
  setupRealtimeProxy(httpServer);
  
  return httpServer;
}
