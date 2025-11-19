import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertProgressHistorySchema,
  insertPronunciationScoreSchema,
  updateUserPreferencesSchema,
  conversations,
} from "@shared/schema";
import OpenAI from "openai";
import { setupRealtimeProxy } from "./realtime-proxy";
import {
  extractNameFromMessage,
  extractLanguageFromMessage,
  extractNativeLanguageFromMessage,
  detectLanguage,
  detectNativeLanguageChangeRequest,
} from "./onboarding-utils";
import { createSystemPrompt } from "./system-prompt";
import { assessMessage, analyzePerformance } from "./difficulty-adjustment";
import { setupAuth, isAuthenticated } from "./replitAuth";

// Use Replit AI Integrations for text chat (works reliably)
// User's personal key (USER_OPENAI_API_KEY) is only used for voice chat in realtime-proxy.ts
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up Replit Auth
  await setupAuth(app);

  // Auth user route
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user learning preferences
  app.put('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validationResult = updateUserPreferencesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid preferences data",
          errors: validationResult.error.errors 
        });
      }
      
      const { targetLanguage, nativeLanguage, difficultyLevel, onboardingCompleted } = validationResult.data;
      
      const updated = await storage.updateUserPreferences(userId, {
        targetLanguage,
        nativeLanguage,
        difficultyLevel,
        onboardingCompleted,
      });
      
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Get user usage statistics (voice messages)
  app.get('/api/user/usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserUsageStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ message: "Failed to fetch usage stats" });
    }
  });

  // Check if user can send voice message (and increment counter)
  app.post('/api/user/check-voice-usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.checkAndIncrementVoiceUsage(userId);
      
      if (!result.allowed) {
        return res.status(403).json({
          allowed: false,
          message: "Monthly voice message limit reached. Upgrade to continue using voice chat.",
          remaining: result.remaining,
          limit: result.limit,
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error checking voice usage:", error);
      res.status(500).json({ message: "Failed to check voice usage" });
    }
  });

  // ===== Stripe Billing Routes =====
  
  // Middleware to check Stripe readiness for billing operations
  const checkStripeReady = (_req: any, res: any, next: any) => {
    // Import stripeReady from index.ts would create circular dependency
    // Instead, check if we can access Stripe data
    next();
  };

  // List available subscription products and prices
  app.get('/api/billing/products', async (_req, res) => {
    try {
      const products = await storage.listProducts(true);
      const prices = await storage.listPrices(true);
      
      // Group prices by product
      const productsWithPrices = products.map(product => ({
        ...product,
        prices: prices.filter(price => price.product === product.id)
      }));
      
      res.json({ products: productsWithPrices });
    } catch (error: any) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get user's subscription status
  app.get('/api/billing/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeSubscriptionId) {
        return res.json({ subscription: null, tier: user?.subscriptionTier || 'free' });
      }

      const subscription = await storage.getSubscription(user.stripeSubscriptionId);
      res.json({ 
        subscription, 
        tier: user.subscriptionTier,
        status: user.subscriptionStatus
      });
    } catch (error: any) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Create checkout session
  app.post('/api/billing/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      // Ensure user exists and has email
      if (!user) {
        // Create user from auth claims
        user = await storage.upsertUser({
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }

      if (!user.email) {
        return res.status(400).json({ message: "User email is required for billing" });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email, userId);
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Create checkout session
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/settings?checkout=success`,
        `${baseUrl}/settings?checkout=cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      // Check if error is due to missing Stripe configuration
      if (error.message && (error.message.includes('connection not found') || error.message.includes('X_REPLIT_TOKEN'))) {
        return res.status(503).json({ 
          message: "Billing service is not configured. Please set up Stripe integration in Replit Secrets." 
        });
      }
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Create customer portal session (manage subscription)
  app.post('/api/billing/portal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      // Check if error is due to missing Stripe configuration
      if (error.message && (error.message.includes('connection not found') || error.message.includes('X_REPLIT_TOKEN'))) {
        return res.status(503).json({ 
          message: "Billing service is not configured. Please set up Stripe integration in Replit Secrets." 
        });
      }
      res.status(500).json({ message: "Failed to create portal session" });
    }
  });

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
      // Use the latest mini model for testing since it's cost-effective
      const testUrl = 'https://api.openai.com/v1/realtime/sessions';
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model: 'gpt-realtime-mini-2025-10-06',  // Latest GPT-4o-mini Realtime
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
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Fetch user record to get saved preferences (defensive fallback)
      const userRecord = await storage.getUser(userId);
      
      // Parse request body, but use user preferences as defaults if not provided
      const data = insertConversationSchema.parse({
        ...req.body,
        language: req.body.language || userRecord?.targetLanguage || "spanish",
        difficulty: req.body.difficulty || userRecord?.difficultyLevel || "beginner",
        nativeLanguage: req.body.nativeLanguage || userRecord?.nativeLanguage || "english"
      });
      
      // Get userName - use from request or fallback to user profile
      // Treat "Student" as a placeholder and replace with profile name
      const requestUserName = (req.body.userName || "").trim();
      const isPlaceholder = !requestUserName || requestUserName.toLowerCase() === "student";
      const profileUserName = userRecord?.firstName && userRecord?.lastName
        ? `${userRecord.firstName} ${userRecord.lastName}`.trim()
        : userRecord?.firstName || "";
      const userName = isPlaceholder ? profileUserName : requestUserName;
      const isOnboardingExplicit = req.body.isOnboarding;
      
      console.log('[CONVERSATION CREATE] Received userName:', userName);
      console.log('[CONVERSATION CREATE] isOnboarding explicit:', isOnboardingExplicit);
      console.log('[CONVERSATION CREATE] Using preferences:', {
        language: data.language,
        difficulty: data.difficulty,
        nativeLanguage: data.nativeLanguage,
        userName,
        onboardingCompleted: userRecord?.onboardingCompleted,
        source: req.body.language ? 'request' : 'user_record'
      });
      
      // Determine if this should be an onboarding conversation
      // Use the dedicated onboardingCompleted flag instead of userName matching
      let isOnboarding: boolean;
      let userNativeLanguage: string | undefined;
      
      if (typeof isOnboardingExplicit === 'boolean') {
        // Explicitly set - use it (for manually created threads)
        isOnboarding = isOnboardingExplicit;
      } else {
        // Auto-detect based on onboardingCompleted flag in user record
        // If user has completed onboarding, never trigger onboarding again
        isOnboarding = !userRecord?.onboardingCompleted;
        
        console.log('[CONVERSATION CREATE] onboardingCompleted from user record:', userRecord?.onboardingCompleted);
        console.log('[CONVERSATION CREATE] isOnboarding (auto-detected):', isOnboarding);
      }
      
      // ALWAYS attempt to inherit nativeLanguage from previous conversations if user has a name
      // This runs for both explicitly set and auto-detected onboarding status
      if (!isOnboarding && userName && userName !== "Student") {
        const allConversations = await storage.getUserConversations(userId);
        
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
      
      // Always create a new conversation to ensure fresh greeting each session
      const conversation = await storage.createConversation({
        ...data,
        userId,
        isOnboarding,
        onboardingStep: isOnboarding ? "name" : null,
        userName: isOnboarding ? null : userName,
        nativeLanguage: userNativeLanguage || data.nativeLanguage || "english",
      } as typeof conversations.$inferInsert);
      
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
          const previousConversations = await storage.getConversationsByLanguage(data.language, userId);
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

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await storage.getConversation(req.params.id, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/by-language/:language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversationsByLanguage(req.params.language, userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await storage.getConversation(req.params.id, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await storage.deleteConversation(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = req.params.id;
      const conversation = await storage.getConversation(conversationId, userId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
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
        const latestConversation = await storage.getConversation(conversationId, userId);
        if (latestConversation) {
          const isSuccessful = assessment.isSuccessful;
          await storage.updateConversation(conversationId, userId, {
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
          await storage.updateConversation(conversationId, userId, {
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
            updatedConversation = await storage.updateConversation(conversationId, userId, {
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
            
            updatedConversation = await storage.updateConversation(conversationId, userId, {
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
            aiResponse = "I'm not sure which language you'd like to study. Please choose one from: English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, or Korean.";
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
            
            updatedConversation = await storage.updateConversation(conversationId, userId, {
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
          
          updatedConversation = await storage.updateConversation(conversationId, userId, {
            language: languageDetection.detectedLanguage,
          }) || conversation;
          
          languageSwitchNote = `I notice you're practicing ${languageDetection.detectedLanguage}. I've switched our conversation to focus on that language. `;
        }
      }

      // Detect if user is requesting to change their native language
      const nativeLanguageChangeRequest = await detectNativeLanguageChangeRequest(
        openai,
        messageData.content,
        updatedConversation.nativeLanguage || "english"
      );

      // Only update if actually requesting a change to a different language
      if (nativeLanguageChangeRequest.wantsToChange && 
          nativeLanguageChangeRequest.newNativeLanguage &&
          nativeLanguageChangeRequest.confidence !== "low" &&
          nativeLanguageChangeRequest.newNativeLanguage !== updatedConversation.nativeLanguage) {
        
        console.log('[NATIVE-LANG-CHANGE] Changing native language from', updatedConversation.nativeLanguage, 'to', nativeLanguageChangeRequest.newNativeLanguage);
        
        updatedConversation = await storage.updateConversation(conversationId, userId, {
          nativeLanguage: nativeLanguageChangeRequest.newNativeLanguage,
        }) || updatedConversation;
        
        languageSwitchNote += `I've switched the explanations to ${nativeLanguageChangeRequest.newNativeLanguage}. Let's continue! `;
      }

      // Fetch previous conversations for this user and language (for conversation switching)
      const allUserConversations = await storage.getConversationsByLanguage(updatedConversation.language, userId);
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

      // Extract vocabulary taught in recent session (recently learned words for recap)
      // Query vocabulary database for words matching this conversation's language/difficulty
      // that were created recently (approximates "session-taught vocabulary")
      const allSessionVocab = await storage.getVocabularyWords(
        updatedConversation.language,
        userId,
        updatedConversation.difficulty
      );
      
      // Get words created in the last hour (approximate session boundary)
      // Sort by createdAt ascending (oldest first) to preserve teaching order
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const sessionVocabulary = allSessionVocab
        .filter(v => new Date(v.createdAt) > oneHourAgo)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) // Oldest first
        .slice(-10) // Take last 10 (most recent 10 words, in teaching order)
        .map(v => ({
          word: v.word,
          translation: v.translation,
          example: v.example,
          pronunciation: v.pronunciation
        }));

      // Fetch due vocabulary for review (integrate SRS with conversation)
      const dueVocabulary = await storage.getDueVocabulary(
        updatedConversation.language,
        userId,
        updatedConversation.difficulty,
        5 // Limit to 5 most overdue words
      );

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
        updatedConversation.nativeLanguage,
        dueVocabulary.length > 0 ? dueVocabulary.map(v => ({
          word: v.word,
          translation: v.translation,
          example: v.example,
          pronunciation: v.pronunciation
        })) : undefined,
        sessionVocabulary.length > 0 ? sessionVocabulary : undefined
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
                },
                media: {
                  type: "array",
                  description: "Images to display with this message (0-2 images max). For type='stock', include query field. For type='ai_generated', include prompt field.",
                  items: {
                    anyOf: [
                      {
                        type: "object",
                        properties: {
                          type: { type: "string", enum: ["stock"] },
                          query: { type: "string", description: "Search query for stock images (e.g., 'red apple', 'french cafe')" },
                          alt: { type: "string", description: "Alt text for accessibility" }
                        },
                        required: ["type", "query", "alt"],
                        additionalProperties: false
                      },
                      {
                        type: "object",
                        properties: {
                          type: { type: "string", enum: ["ai_generated"] },
                          prompt: { type: "string", description: "DALL-E prompt (e.g., 'A cozy Parisian cafe with outdoor seating')" },
                          alt: { type: "string", description: "Alt text for accessibility" }
                        },
                        required: ["type", "prompt", "alt"],
                        additionalProperties: false
                      }
                    ]
                  }
                }
              },
              required: ["message", "vocabulary", "media"],
              additionalProperties: false
            }
          }
        }
      });

      // Parse AI response with error handling
      const responseContent = completion.choices[0]?.message?.content || "";
      let aiResponse = "I'm sorry, I couldn't generate a response.";
      let parsedResponse: { message?: string; vocabulary?: any[]; media?: any[] } = {};

      try {
        parsedResponse = JSON.parse(responseContent);
        aiResponse = parsedResponse.message || aiResponse;
      } catch (parseError) {
        // Fallback to plain text if JSON parsing fails
        console.error("Failed to parse AI response as JSON, using plain text:", parseError);
        aiResponse = responseContent || aiResponse;
      }
      
      // Process media requests from AI (fetch stock images or generate AI images)
      let mediaJson: string | null = null;
      const mediaItems = Array.isArray(parsedResponse.media) ? parsedResponse.media : [];
      
      if (mediaItems.length > 0) {
        const processedMedia = [];
        
        for (const item of mediaItems.slice(0, 2)) { // Max 2 images per message
          try {
            if (item.type === "stock" && item.query) {
              // Normalize the search query to improve cache hit rate
              // Extract core concept by removing modifiers like colors, adjectives
              const normalizeQuery = (query: string): string => {
                // Common vocabulary words that should be cached consistently
                const coreWords = ['coffee', 'tea', 'sandwich', 'bread', 'apple', 'banana', 'orange',
                  'dog', 'cat', 'bird', 'car', 'house', 'book', 'water', 'milk', 'cheese',
                  'pizza', 'pasta', 'rice', 'chicken', 'beef', 'fish', 'vegetable', 'fruit',
                  'croissant', 'baguette', 'wine', 'beer', 'restaurant', 'cafe', 'hotel'];
                
                const lowerQuery = query.toLowerCase();
                
                // Find the first core word in the query
                for (const word of coreWords) {
                  if (lowerQuery.includes(word)) {
                    return word;
                  }
                }
                
                // If no core word found, use the original query but clean it up
                // Remove common modifiers: colors, textures, etc.
                return query
                  .toLowerCase()
                  .replace(/\b(white|black|red|green|blue|yellow|brown|golden|fresh|delicious|hot|cold|iced|warm|large|small|big|tiny)\b/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              };
              
              const normalizedQuery = normalizeQuery(item.query);
              console.log('[CACHE] Normalized query:', item.query, '→', normalizedQuery);
              
              // Check cache first for stock images using normalized query
              const cachedImage = await storage.getCachedStockImage(normalizedQuery);
              
              if (cachedImage) {
                // Cache hit! Use cached image and increment usage
                console.log('[CACHE HIT] Found cached stock image for query:', item.query, '(usage:', cachedImage.usageCount, ')');
                await storage.incrementImageUsage(cachedImage.id);
                
                // Parse attribution from JSON
                const attribution = cachedImage.attributionJson 
                  ? JSON.parse(cachedImage.attributionJson)
                  : undefined;
                
                processedMedia.push({
                  type: "stock",
                  query: item.query,
                  url: cachedImage.url,
                  thumbnailUrl: cachedImage.thumbnailUrl || undefined,
                  altText: item.alt || cachedImage.description || item.query,
                  attribution
                });
              } else {
                // Cache miss - fetch from Unsplash
                console.log('[CACHE MISS] Fetching new stock image for query:', item.query);
                const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
                if (!unsplashAccessKey) {
                  console.warn('[MULTIMEDIA] Unsplash API key not configured, skipping stock image');
                  continue;
                }
                
                const response = await fetch(
                  `https://api.unsplash.com/photos/random?query=${encodeURIComponent(item.query)}&orientation=landscape&content_filter=high`,
                  {
                    headers: {
                      'Authorization': `Client-ID ${unsplashAccessKey}`,
                      'Accept-Version': 'v1'
                    }
                  }
                );
                
                if (response.ok) {
                  const data = await response.json();
                  const attribution = {
                    photographer: data.user.name,
                    photographerUrl: data.user.links.html,
                    unsplashUrl: data.links.html
                  };
                  
                  processedMedia.push({
                    type: "stock",
                    query: item.query,
                    url: data.urls.regular,
                    thumbnailUrl: data.urls.small,
                    altText: item.alt || data.alt_description || item.query,
                    attribution
                  });
                  
                  // Cache the image for future use (using normalized query as cache key)
                  try {
                    await storage.cacheImage({
                      uploadedBy: null, // System-cached image
                      mediaType: "image",
                      url: data.urls.regular,
                      thumbnailUrl: data.urls.small,
                      filename: `stock-${normalizedQuery.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.jpg`,
                      mimeType: "image/jpeg",
                      description: data.alt_description || item.query,
                      imageSource: "stock",
                      searchQuery: normalizedQuery, // Use normalized query as cache key
                      attributionJson: JSON.stringify(attribution),
                      usageCount: 1
                    });
                    console.log('[CACHE STORE] Cached stock image for normalized query:', normalizedQuery, '(original:', item.query, ')');
                  } catch (cacheError) {
                    console.error('[CACHE STORE] Failed to cache stock image:', cacheError);
                    // Don't fail the request if caching fails
                  }
                } else {
                  console.warn('[MULTIMEDIA] Failed to fetch stock image for query:', item.query);
                }
              }
            } else if (item.type === "ai_generated" && item.prompt) {
              // Create hash of the prompt for cache lookups
              const crypto = await import('crypto');
              const promptHash = crypto.createHash('sha256').update(item.prompt).digest('hex');
              
              // Check cache first for AI-generated images
              const cachedImage = await storage.getCachedAIImage(promptHash);
              
              if (cachedImage) {
                // Cache hit! Use cached image and increment usage
                console.log('[CACHE HIT] Found cached AI image for prompt:', item.prompt.substring(0, 50) + '...', '(usage:', cachedImage.usageCount, ')');
                await storage.incrementImageUsage(cachedImage.id);
                
                processedMedia.push({
                  type: "ai_generated",
                  prompt: item.prompt,
                  url: cachedImage.url,
                  altText: item.alt || cachedImage.description || item.prompt
                });
              } else {
                // Cache miss - generate with DALL-E
                console.log('[CACHE MISS] Generating new AI image for prompt:', item.prompt.substring(0, 50) + '...');
                const enhancedPrompt = `${item.prompt}. Educational illustration style, clear and engaging, suitable for language learning.`;
                
                const imageResponse = await openai.images.generate({
                  model: "gpt-image-1",
                  prompt: enhancedPrompt,
                  n: 1,
                  size: "1024x1024",
                  quality: "standard"
                });
                
                const imageUrl = imageResponse?.data?.[0]?.url;
                if (imageUrl) {
                  processedMedia.push({
                    type: "ai_generated",
                    prompt: item.prompt,
                    url: imageUrl,
                    altText: item.alt || item.prompt
                  });
                  
                  // Cache the generated image for future use
                  try {
                    await storage.cacheImage({
                      uploadedBy: null, // System-cached image
                      mediaType: "image",
                      url: imageUrl,
                      thumbnailUrl: null,
                      filename: `ai-generated-${promptHash.substring(0, 16)}.png`,
                      mimeType: "image/png",
                      description: item.prompt,
                      imageSource: "ai_generated",
                      promptHash: promptHash,
                      attributionJson: null,
                      usageCount: 1
                    });
                    console.log('[CACHE STORE] Cached AI-generated image with hash:', promptHash.substring(0, 16));
                  } catch (cacheError) {
                    console.error('[CACHE STORE] Failed to cache AI image:', cacheError);
                    // Don't fail the request if caching fails
                  }
                } else {
                  console.warn('[MULTIMEDIA] Failed to generate AI image for prompt:', item.prompt);
                }
              }
            }
          } catch (error) {
            console.error('[MULTIMEDIA] Error processing media item:', error);
            // Continue processing other media items even if one fails
          }
        }
        
        if (processedMedia.length > 0) {
          mediaJson = JSON.stringify(processedMedia);
          console.log('[MULTIMEDIA] Processed', processedMedia.length, 'media items');
        }
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
        const targetConversation = await storage.getConversation(targetConversationId, userId);
        
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

      // Save AI message with media
      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
        mediaJson: mediaJson || undefined,
      });

      // Save vocabulary items from conversation (only if we have valid data)
      const vocabulary = Array.isArray(parsedResponse.vocabulary) ? parsedResponse.vocabulary : [];
      for (const vocab of vocabulary) {
        if (vocab?.word && vocab?.translation && vocab?.example) {
          await storage.createVocabularyWord({
            userId,
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
  app.get("/api/vocabulary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language, difficulty } = req.query;
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }
      const words = await storage.getVocabularyWords(
        language as string,
        userId,
        difficulty as string | undefined
      );
      res.json(words);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vocabulary with path parameters (RESTful alternative)
  app.get("/api/vocabulary/:language/:difficulty", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language, difficulty } = req.params;
      const words = await storage.getVocabularyWords(language, userId, difficulty);
      res.json(words);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/vocabulary/:id/review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { isCorrect } = req.body;
      
      if (typeof isCorrect !== "boolean") {
        return res.status(400).json({ error: "isCorrect must be a boolean" });
      }
      
      // First verify the vocabulary word belongs to the user
      const word = await storage.getVocabularyWord(id);
      if (!word || word.userId !== userId) {
        return res.status(404).json({ message: "Vocabulary word not found" });
      }
      
      const updatedWord = await storage.updateVocabularyReview(id, isCorrect);
      
      if (!updatedWord) {
        return res.status(404).json({ message: "Vocabulary word not found" });
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
  app.get("/api/progress/:language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getOrCreateUserProgress(req.params.language, userId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Progress History
  app.get("/api/progress-history/:language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const history = await storage.getProgressHistory(req.params.language, userId, days);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/progress-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Convert date string to Date object if necessary
      const data = {
        ...req.body,
        userId, // Use authenticated userId instead of trusting request body
        date: req.body.date ? new Date(req.body.date) : undefined,
      };
      const validated = insertProgressHistorySchema.parse(data);
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
  app.get("/api/difficulty-recommendation/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await storage.getConversation(req.params.conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
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
      const progress = await storage.getOrCreateUserProgress(conversation.language, userId);

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
  app.patch("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateConversation(req.params.id, userId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH progress by language (convenience endpoint for difficulty adjustments)
  app.patch("/api/progress/:languageOrId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // First try to find by language, then by ID
      const progress = await storage.getOrCreateUserProgress(req.params.languageOrId, userId);
      
      // Convert date strings to Date objects if present
      const updateData: any = { ...req.body };
      if (updateData.lastPracticeDate && typeof updateData.lastPracticeDate === 'string') {
        updateData.lastPracticeDate = new Date(updateData.lastPracticeDate);
      }
      if (updateData.lastDifficultyAdjustment && typeof updateData.lastDifficultyAdjustment === 'string') {
        updateData.lastDifficultyAdjustment = new Date(updateData.lastDifficultyAdjustment);
      }
      
      const updated = await storage.updateUserProgress(progress.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Progress not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Pronunciation Scores - Analyze and save
  app.post("/api/pronunciation-scores/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId, conversationId, transcribedText } = req.body;
      
      if (!messageId || !conversationId || !transcribedText) {
        return res.status(400).json({ error: "messageId, conversationId, and transcribedText are required" });
      }

      // Get conversation to determine language and difficulty - verify ownership
      const conversation = await storage.getConversation(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
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
  app.post("/api/pronunciation-scores", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertPronunciationScoreSchema.parse(req.body);
      // Verify the conversation belongs to the user
      const conversation = await storage.getConversation(validated.conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      const score = await storage.createPronunciationScore(validated);
      res.status(201).json(score);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid pronunciation score data", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pronunciation-scores/conversation/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await storage.getConversation(req.params.conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      const scores = await storage.getPronunciationScoresByConversation(req.params.conversationId);
      res.json(scores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pronunciation-scores/message/:messageId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const score = await storage.getPronunciationScoreByMessage(req.params.messageId);
      if (!score) {
        return res.status(404).json({ message: "Pronunciation score not found" });
      }
      // Verify the conversation belongs to the user
      const conversation = await storage.getConversation(score.conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(score);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/pronunciation-scores/stats/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await storage.getConversation(req.params.conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
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

  // Multimedia - Fetch stock image from Unsplash
  app.post("/api/media/stock-image", isAuthenticated, async (req: any, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Missing required field: query" });
      }

      const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!unsplashAccessKey) {
        return res.status(500).json({ error: "Unsplash API key not configured" });
      }

      // Fetch random image from Unsplash
      const response = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
        {
          headers: {
            'Authorization': `Client-ID ${unsplashAccessKey}`,
            'Accept-Version': 'v1'
          }
        }
      );

      if (!response.ok) {
        console.error('Unsplash API error:', await response.text());
        return res.status(500).json({ error: "Failed to fetch stock image" });
      }

      const data = await response.json();
      
      res.json({
        url: data.urls.regular,
        thumbnailUrl: data.urls.small,
        altText: data.alt_description || query,
        attribution: {
          photographer: data.user.name,
          photographerUrl: data.user.links.html,
          unsplashUrl: data.links.html
        }
      });
    } catch (error: any) {
      console.error('Stock image fetch error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Multimedia - Generate AI image with DALL-E
  app.post("/api/media/generate-image", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, context } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing required field: prompt" });
      }

      // Enhance prompt with educational context if provided
      const enhancedPrompt = context 
        ? `${prompt}. Educational illustration style, clear and engaging, suitable for language learning.`
        : prompt;

      // Generate image with DALL-E via OpenAI integration
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });

      const imageUrl = response?.data?.[0]?.url;
      if (!imageUrl) {
        return res.status(500).json({ error: "Failed to generate image" });
      }

      res.json({
        url: imageUrl,
        prompt: enhancedPrompt
      });
    } catch (error: any) {
      console.error('AI image generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Media Files - Image Upload
  app.post("/api/media/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { base64Data, filename, mimeType, caption, messageId } = req.body;
      
      if (!base64Data || !filename || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: base64Data, filename, mimeType" });
      }

      // Validate image MIME type
      if (!mimeType.startsWith('image/')) {
        return res.status(400).json({ error: "Only images are supported" });
      }

      // If messageId is provided, verify the message belongs to the user's conversation
      if (messageId) {
        const message = await storage.getMessage(messageId, userId);
        if (!message) {
          return res.status(403).json({ error: "Unauthorized: message does not belong to your conversation" });
        }
      }

      // Calculate file size from base64
      const base64Length = base64Data.length - (base64Data.indexOf(',') + 1);
      const fileSize = Math.floor((base64Length * 3) / 4);

      // Create media file record
      const mediaFile = await storage.createMediaFile({
        uploadedBy: userId,
        mediaType: 'image',
        url: base64Data, // Store base64 directly for MVP
        filename,
        mimeType,
        fileSize,
      });

      // If messageId is provided, link the image to the message
      if (messageId) {
        await storage.createMessageMedia({
          messageId,
          mediaFileId: mediaFile.id,
          caption: caption || null,
        });
      }

      res.json(mediaFile);
    } catch (error: any) {
      console.error('Image upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get images for a message
  app.get("/api/messages/:messageId/media", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messageId = req.params.messageId;

      // Verify the message belongs to the user's conversation
      const message = await storage.getMessage(messageId, userId);
      if (!message) {
        return res.status(403).json({ error: "Unauthorized: message does not belong to your conversation" });
      }

      // Fetch and return media
      const media = await storage.getMessageMedia(messageId);
      res.json(media);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's media files
  app.get("/api/media/my-uploads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const mediaFiles = await storage.getUserMediaFiles(userId);
      res.json(mediaFiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket proxy for Realtime API
  setupRealtimeProxy(httpServer);
  
  return httpServer;
}
