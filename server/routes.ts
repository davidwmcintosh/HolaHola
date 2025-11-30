import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stripeService } from "./stripeService";
import { aiLimiter, voiceLimiter, authLimiter, mutationLimiter } from "./middleware/rate-limiter";
import { requireRole, allowRoles, loadAuthenticatedUser } from "./middleware/rbac";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertProgressHistorySchema,
  insertPronunciationScoreSchema,
  updateUserPreferencesSchema,
  insertClassHourPackageSchema,
  conversations,
} from "@shared/schema";
import { hasTeacherAccess } from "@shared/permissions";
import OpenAI, { toFile } from "openai";
import { setupUnifiedWebSocketHandler } from "./unified-ws-handler";
import {
  extractNameFromMessage,
  extractLanguageFromMessage,
  extractNativeLanguageFromMessage,
  detectNativeLanguageChangeRequest,
  detectTargetLanguageChangeRequest,
} from "./onboarding-utils";
import { franc } from "franc-min";
import { createSystemPrompt } from "./system-prompt";
import { assessMessage, analyzePerformance } from "./difficulty-adjustment";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateConversationTitle, generateConversationContextSummary } from "./conversation-utils";
import { extractTargetLanguageText, hasSignificantTargetLanguageContent } from "./text-utils";
import multer from "multer";
import { getTTSService } from "./services/tts-service";
import { usageService } from "./services/usage-service";
import { 
  getAvailableActflLevels,
  getSupportedLanguages,
  getCanDoStatementStats
} from "./actfl-can-do-statements";
import { toInternalActflLevel, toExternalActflLevel } from "./actfl-utils";
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from "@deepgram/sdk";
import { validateOneUnitRule, countConceptualUnits } from "./phrase-detection";

// ============================================================================
// AI PROVIDERS: Gemini (Text) + Deepgram (Voice STT) + Google Cloud (Voice TTS)
// ============================================================================

// Gemini for text chat via Replit AI Integrations (no API key needed)
// IMPORTANT: Must include httpOptions with baseUrl and empty apiVersion when using AI Integrations
const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

// Deepgram for voice STT (Speech-to-Text)
// 54% better accuracy for non-native speakers, <300ms latency
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

// Keep OpenAI for legacy fallback during migration
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Language name to ISO-639-1 code mapping for OpenAI Whisper API
const LANGUAGE_TO_ISO_CODE: Record<string, string> = {
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'japanese': 'ja',
  'mandarin chinese': 'zh',
  'korean': 'ko',
};

function getLanguageCode(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const normalized = language.toLowerCase().trim();
  return LANGUAGE_TO_ISO_CODE[normalized];
}

/**
 * Strip markdown formatting and phonetic content from text before TTS
 * 
 * Architecture: Sentence-level classification pipeline (per architect guidance)
 * 1. Split text into sentences
 * 2. Clean each sentence (remove parentheticals, markdown)
 * 3. Classify and filter phonetic-only sentences
 * 4. Rebuild clean text
 * 
 * Examples:
 * - "café (kah-FEH)" → "café"
 * - "Pronunciation: kah-FEH. Try it!" → "Try it!"
 * - "Café, por favor (Coffee, please; kah-FEH, por fah-VOR)" → "Café, por favor"
 * - "perro (dog)" → "perro"
 * 
 * Exported for unit testing
 */
export function stripMarkdownForSpeech(text: string): string {
  // Split text into sentences (simple approach)
  const sentences = text.split(/([.!?]+\s+)/).reduce((acc: string[], part, i, arr) => {
    if (i % 2 === 0 && part.trim()) {
      const punct = arr[i + 1] || '';
      acc.push((part + punct).trim());
    }
    return acc;
  }, []);
  
  // Process each sentence
  const cleanedSentences = sentences
    .map(sentence => cleanSentence(sentence))
    .filter(sentence => !isPhoneticInstruction(sentence))
    .filter(sentence => sentence.trim().length > 0);
  
  // Rebuild text
  return cleanedSentences.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if token is whitelisted non-phonetic pattern
 */
function isWhitelistedToken(token: string): boolean {
  // CamelCase without hyphen: iPhone, JavaScript
  if (!token.includes('-') && /[a-z]/.test(token) && /[A-Z]/.test(token)) return true;
  
  // Locale codes: en-US, es-MX
  if (/^[a-z]{2,4}-[A-Z]{2,4}$/.test(token)) return true;
  
  // Proper nouns: Pre-Columbian
  if (/^[A-Z][a-z]+-[A-Z][a-z]+/.test(token)) return true;
  
  // Normal hyphenated words: face-to-face, well-known
  if (/^[a-z]+-[a-z]+$/.test(token)) return true;
  
  return false;
}

/**
 * Check if token is phonetic syllable (stress pattern)
 * Normalizes diacritics to catch accented syllables like "fah-VÓR"
 * Returns true for: "kah-FEH", "fah-VOR", "fah-VÓR", "oh-LAH", "OH-LAH"
 * Returns false for: "en-US", "Pre-Columbian", "face-to-face", "iPhone", "say"
 */
function isPhoneticToken(token: string): boolean {
  // Must have hyphen
  if (!token.includes('-')) return false;
  
  // Check whitelist first
  if (isWhitelistedToken(token)) return false;
  
  // Normalize diacritics for pattern matching (fah-VÓR → fah-VOR)
  const normalized = normalizeDiacritics(token);
  
  // Phonetic patterns: lowercase-UPPERCASE or UPPERCASE-UPPERCASE
  return /^[a-z]+-[A-Z]+$/.test(normalized) || /^[A-Z]+-[A-Z]+$/.test(normalized);
}

/**
 * Remove phonetic tokens from a clause while preserving spacing and punctuation
 * Strips phonetic syllables while preserving normal words and whitespace
 * Examples:
 * - "kah-FEH, por fah-VOR" → "por"
 * - "kah-FEH once more" → "once more"
 * - "Pre-Columbian stories" → "Pre-Columbian stories" (preserved)
 */
function removePhoneticTokens(clause: string): string {
  // Split on word boundaries while capturing whitespace and punctuation
  const tokens = clause.split(/(\s+|,\s*)/);
  
  const cleaned = tokens.filter(token => {
    // Keep whitespace and punctuation
    if (/^[\s,]*$/.test(token)) return true;
    
    const trimmed = token.trim();
    if (trimmed.length === 0) return true;
    
    // Remove phonetic tokens
    return !isPhoneticToken(trimmed);
  });
  
  return cleaned.join('').replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').trim();
}

/**
 * Clean a single sentence by removing parentheticals, phonetic tokens, and markdown
 * Removes individual phonetic tokens from mixed clauses
 */
function cleanSentence(sentence: string): string {
  let text = sentence;
  
  // Remove parenthetical content (always safe - typically phonetics/translations)
  text = text.replace(/\([^)]+\)/g, '');
  
  // Remove phonetic tokens from equals/semicolon clauses
  text = text.replace(/(\s*[;=]\s*)([^.!?]+)/g, (match, delimiter, clause) => {
    const cleaned = removePhoneticTokens(clause);
    // If clause becomes empty after removing phonetics, remove delimiter too
    if (cleaned.length === 0) return '';
    return delimiter + cleaned;
  });
  
  // Remove markdown and quotes
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/^[\s]*[-*]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    // Remove quotes around words (prevents TTS from pronouncing "apostrophe" or "quote")
    // Matches: 'word', "word", 'word', 'word', "word", "word", «word», »word«
    .replace(/['''"""«»]+([^'''"""«»]+)['''"""«»]+/g, '$1')
    // Clean whitespace
    .replace(/\s+/g, ' ')
    .trim();
    
  return text;
}

/**
 * Normalize diacritics for phonetic detection
 */
function normalizeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Classify if sentence is purely a phonetic instruction
 */
function isPhoneticInstruction(sentence: string): boolean {
  const lower = sentence.toLowerCase().trim();
  
  // Check if sentence starts with instruction keywords
  // NOTE: "try saying" is intentionally removed - it's an important instructional phrase that should be spoken
  const keywords = [
    'pronunciation:',
    'phonetically:',
    'listen:',
    'the pronunciation is',
    'sounds like',
    'say it like'
  ];
  
  return keywords.some(keyword => lower.startsWith(keyword));
}

/**
 * Determine which GPT model to use based on subscription tier
 * Free/Basic/Institutional: gpt-4o-mini (faster, cheaper)
 * Pro: gpt-4o (best quality)
 * Developer/Admin: Can override via developerModel field
 */
function getModelForTier(tier: string | null | undefined, user?: { role?: string | null, developerModel?: string | null }): string {
  // DEVELOPER OVERRIDE: Allow developers/admins to test specific models
  if (user?.role && ['admin', 'developer'].includes(user.role)) {
    if (user.developerModel) {
      console.log(`[DEVELOPER MODE] Using override model: ${user.developerModel} (role: ${user.role})`);
      return user.developerModel;
    }
  }
  
  const subscriptionTier = tier?.toLowerCase() || 'free';
  
  // Pro tier gets the best model (Gemini 2.5 Pro)
  if (subscriptionTier === 'pro' || subscriptionTier === 'premium') {
    return 'gemini-2.5-pro';
  }
  
  // All other tiers (free, basic, institutional) get Gemini 2.5 Flash
  // Fast, cheap, excellent for daily learning (1M context, $0.10/$0.40 per 1M tokens)
  return 'gemini-2.5-flash';
}

/**
 * Call Gemini for simple text completion (no structured output)
 */
async function callGemini(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Translate OpenAI-style messages to Gemini format
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  // Build contents for Gemini
  const contents: any[] = [];
  
  // Add system instruction as first user message if present
  if (systemMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: systemMessage }]
    });
  }
  
  // Add conversation messages
  conversationMessages.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });
  
  // Call Gemini
  const response = await gemini.models.generateContent({
    model,
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }]
  });
  
  // Google GenAI returns text as a property getter
  return response.text || "";
}

/**
 * Call Gemini with JSON schema for structured output
 * Translates OpenAI-style messages to Gemini format
 */
async function callGeminiWithSchema(
  model: string,
  messages: Array<{ role: string; content: string }>,
  schema: any
): Promise<any> {
  // Translate OpenAI-style messages to Gemini format
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  // Build contents for Gemini
  const contents: any[] = [];
  
  // Add system instruction as first user message if present
  if (systemMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: systemMessage }]
    });
  }
  
  // Add conversation messages
  conversationMessages.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });
  
  // Call Gemini with JSON schema
  // Note: @google/genai uses different API structure
  const response = await gemini.models.generateContent({
    model,
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  
  // Google GenAI returns text as a property getter
  const responseText = response.text || "{}";
  return JSON.parse(responseText);
}

/**
 * Generate image with Gemini Flash-Image
 * Returns a data URL (base64-encoded image)
 * 
 * Note: Uses Gemini 2.5 Flash-Image via Replit AI Integrations
 */
async function generateImageWithGemini(prompt: string): Promise<string> {
  try {
    console.log('[GEMINI IMAGE] Generating image for prompt:', prompt.substring(0, 100) + '...');
    
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    console.log('[GEMINI IMAGE] Response received, candidates:', response.candidates?.length);
    
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      console.error('[GEMINI IMAGE] No parts in response candidate');
      throw new Error("No content parts in Gemini response");
    }
    
    console.log('[GEMINI IMAGE] Parts count:', candidate.content.parts.length);
    
    const imagePart = candidate.content.parts.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      console.error('[GEMINI IMAGE] No image data found. Parts:', candidate.content.parts.map((p: any) => Object.keys(p)));
      throw new Error("No image data in Gemini response - check API configuration");
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const dataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
    console.log('[GEMINI IMAGE] ✓ Successfully generated image, size:', imagePart.inlineData.data.length, 'bytes');
    return dataUrl;
  } catch (error) {
    console.error('[GEMINI IMAGE] ✗ Error generating image:', error);
    throw error;
  }
}

// Configure multer for audio file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (OpenAI Whisper limit)
  },
  fileFilter: (_req, file, cb) => {
    // Accept common audio formats (including Safari/iOS formats)
    const allowedMimeTypes = [
      'audio/webm',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/flac',
      'audio/m4a',
      'audio/mp4',
      'audio/mp4a-latm', // iOS Safari
      'audio/x-m4a',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up Replit Auth with rate limiting
  await setupAuth(app, authLimiter);

  // Auth user route (with rate limiting)
  app.get('/api/auth/user', authLimiter, isAuthenticated, async (req: any, res) => {
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
  // Note: tutorPersonality and tutorExpressiveness are super-admin only settings
  // Regular users can only update tutorGender (male/female) and other learning preferences
  // Get all languages user has progress in
  app.get('/api/user/languages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const languages = await storage.getUserLanguages(userId);
      res.json({ languages });
    } catch (error: any) {
      console.error('Error fetching user languages:', error);
      res.status(500).json({ error: 'Failed to fetch languages' });
    }
  });

  app.put('/api/user/preferences', isAuthenticated, loadAuthenticatedUser(storage), async (req: any, res) => {
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
      
      const { targetLanguage, nativeLanguage, difficultyLevel, onboardingCompleted, tutorGender, tutorPersonality, tutorExpressiveness } = validationResult.data;
      
      // Check if user is a super admin (developer role)
      // Only super admins can set tutorPersonality and tutorExpressiveness
      const userRole = req.authenticatedUser?.role;
      const isSuperAdmin = userRole === 'developer';
      
      const updated = await storage.updateUserPreferences(userId, {
        targetLanguage,
        nativeLanguage,
        difficultyLevel,
        onboardingCompleted,
        tutorGender,
        // Only allow super admins to update personality and expressiveness
        // For regular users, these fields are undefined and won't be updated
        tutorPersonality: isSuperAdmin ? tutorPersonality : undefined,
        tutorExpressiveness: isSuperAdmin ? tutorExpressiveness : undefined,
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
  // DEPRECATED: Use /api/usage/status instead for hour-based tracking
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

  // ===== Hour-Based Usage Tracking Routes =====
  
  // Get current usage status (balance, active session, etc.)
  app.get('/api/usage/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await usageService.getUsageStatus(userId);
      
      // Check for developer bypass
      const balance = await usageService.getBalanceWithBypass(userId);
      
      res.json({
        ...status,
        balance,
      });
    } catch (error) {
      console.error("Error fetching usage status:", error);
      res.status(500).json({ message: "Failed to fetch usage status" });
    }
  });
  
  // Check if user can start a voice session
  app.get('/api/usage/check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check for developer bypass first
      const isDeveloper = await usageService.checkDeveloperBypass(userId);
      if (isDeveloper) {
        return res.json({
          allowed: true,
          remainingSeconds: 999999 * 3600,
          remainingHours: 999999,
          message: "Developer mode - unlimited access",
        });
      }
      
      const result = await usageService.checkSufficientCredits(userId);
      res.json({
        ...result,
        remainingHours: result.remainingSeconds / 3600,
      });
    } catch (error) {
      console.error("Error checking credits:", error);
      res.status(500).json({ message: "Failed to check credits" });
    }
  });
  
  // Get usage history (ledger entries)
  app.get('/api/usage/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await usageService.getUsageHistory(userId, limit);
      res.json({ history });
    } catch (error) {
      console.error("Error fetching usage history:", error);
      res.status(500).json({ message: "Failed to fetch usage history" });
    }
  });
  
  // Get recent voice sessions
  app.get('/api/usage/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const sessions = await usageService.getRecentSessions(userId, limit);
      res.json({ sessions });
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });
  
  // Get credit balance only (lightweight endpoint)
  app.get('/api/usage/balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await usageService.getBalanceWithBypass(userId);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });
  
  // Get class-specific balance for a student enrollment
  app.get('/api/usage/class/:classId/balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { classId } = req.params;
      
      // Check for developer bypass
      const isDeveloper = await usageService.checkDeveloperBypass(userId);
      if (isDeveloper) {
        return res.json({
          classId,
          className: 'Developer Mode',
          allocatedSeconds: 432000, // 120 hours
          usedSeconds: 0,
          remainingSeconds: 432000,
          remainingHours: 120,
          percentUsed: 0,
          isExhausted: false,
        });
      }
      
      const classBalance = await usageService.getClassBalance(userId, classId);
      if (!classBalance) {
        return res.status(404).json({ message: "Not enrolled in this class" });
      }
      res.json(classBalance);
    } catch (error) {
      console.error("Error fetching class balance:", error);
      res.status(500).json({ message: "Failed to fetch class balance" });
    }
  });
  
  // Get purchased hours balance (not tied to any class)
  app.get('/api/usage/purchased', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check for developer bypass
      const isDeveloper = await usageService.checkDeveloperBypass(userId);
      if (isDeveloper) {
        return res.json({
          remainingSeconds: 999999 * 3600,
          remainingHours: 999999,
        });
      }
      
      const purchasedBalance = await usageService.getPurchasedBalance(userId);
      res.json(purchasedBalance);
    } catch (error) {
      console.error("Error fetching purchased balance:", error);
      res.status(500).json({ message: "Failed to fetch purchased balance" });
    }
  });
  
  // Check credits with class context (for starting sessions)
  app.get('/api/usage/check/:classId?', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const classId = req.params.classId || req.query.classId;
      
      // Check for developer bypass first
      const isDeveloper = await usageService.checkDeveloperBypass(userId);
      if (isDeveloper) {
        return res.json({
          allowed: true,
          remainingSeconds: 999999 * 3600,
          remainingHours: 999999,
          source: 'purchased',
          message: "Developer mode - unlimited access",
        });
      }
      
      const result = await usageService.checkSufficientCredits(userId, classId);
      res.json({
        ...result,
        remainingHours: result.remainingSeconds / 3600,
      });
    } catch (error) {
      console.error("Error checking credits:", error);
      res.status(500).json({ message: "Failed to check credits" });
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
  
  // ===== Hour Package Purchase Flow =====
  
  // Get available hour packages
  app.get('/api/billing/hour-packages', async (_req, res) => {
    try {
      const packages = stripeService.getHourPackages();
      res.json({ packages });
    } catch (error: any) {
      console.error("Error fetching hour packages:", error);
      res.status(500).json({ message: "Failed to fetch hour packages" });
    }
  });
  
  // Create checkout session for hour package purchase
  app.post('/api/billing/hour-packages/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      const { packageTier } = req.body;

      if (!packageTier) {
        return res.status(400).json({ message: "Package tier is required" });
      }

      // Validate package tier
      const validTiers = ['try_it', 'starter', 'regular', 'committed'];
      if (!validTiers.includes(packageTier)) {
        return res.status(400).json({ message: "Invalid package tier" });
      }

      // Ensure user exists and has email
      if (!user) {
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

      // Create hour package checkout session
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripeService.createHourPackageCheckoutSession(
        customerId,
        userId,
        packageTier,
        `${baseUrl}/settings?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/settings?purchase=cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating hour package checkout session:", error);
      if (error.message && (error.message.includes('connection not found') || error.message.includes('X_REPLIT_TOKEN'))) {
        return res.status(503).json({ 
          message: "Billing service is not configured. Please set up Stripe integration in Replit Secrets." 
        });
      }
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });
  
  // Fulfill hour package after successful payment (called from frontend after redirect)
  app.post('/api/billing/hour-packages/fulfill', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      
      // Pass the requesting userId for security verification
      const result = await stripeService.fulfillHourPackage(sessionId, userId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      // If already processed, return success but indicate no new hours
      if (result.alreadyProcessed) {
        return res.json({ 
          success: true, 
          hoursAdded: 0,
          alreadyProcessed: true,
          message: "Payment already processed"
        });
      }
      
      res.json({ 
        success: true, 
        hoursAdded: result.hoursAdded,
        message: `Successfully added ${result.hoursAdded} hour(s) to your account!`
      });
    } catch (error: any) {
      console.error("Error fulfilling hour package:", error);
      res.status(500).json({ message: "Failed to process purchase" });
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
      // Use GA model for testing (Aug 2025)
      const testUrl = 'https://api.openai.com/v1/realtime/sessions';
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: JSON.stringify({
          model: 'gpt-realtime',  // GA model (Aug 2025)
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

      // Debug: Log full error details
      console.log('[REALTIME CAPABILITY] Test failed with status:', testResponse.status);
      console.log('[REALTIME CAPABILITY] Error data:', JSON.stringify(errorData, null, 2));
      console.log('[REALTIME CAPABILITY] Error message:', errorMessage);
      console.log('[REALTIME CAPABILITY] Error type:', errorType);

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

  // Create ephemeral Realtime API token for client-side connection
  // This bypasses server-side WebSocket blocking in Replit infrastructure
  app.post("/api/realtime/token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const apiKey = process.env.USER_OPENAI_API_KEY;
      
      if (!apiKey) {
        return res.status(503).json({ 
          message: 'Voice chat requires an OpenAI API key with Realtime API access.' 
        });
      }

      // Determine subscription tier and model
      // NOTE: Both free and pro tiers use the same model - 'gpt-realtime' is not a valid model name
      const subscriptionTier = user.subscriptionTier || 'free';
      const model = 'gpt-4o-realtime-preview-2024-12-17';

      console.log(`[REALTIME TOKEN] Creating ephemeral session for user ${userId}, tier: ${subscriptionTier}, model: ${model}`);

      // Create ephemeral session via OpenAI REST API
      // CRITICAL: Use minimal payload - only model is required
      // Do NOT send voice, turn_detection, or other config here (send via session.update instead)
      const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model
          // Removed: voice (configure via session.update after connection)
          // Removed: turn_detection (configure via session.update after connection)
        })
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error('[REALTIME TOKEN] Failed to create session:', sessionResponse.status, errorText);
        return res.status(sessionResponse.status).json({ 
          message: `Failed to create voice session: ${errorText}` 
        });
      }

      const sessionData = await sessionResponse.json();
      const ephemeralToken = sessionData.client_secret.value;
      
      console.log('[REALTIME TOKEN] ✓ Ephemeral session created successfully');

      // Return token to client for direct WebSocket connection
      res.json({
        token: ephemeralToken,
        model,
        expires_at: sessionData.expires_at
      });

    } catch (error: any) {
      console.error('[REALTIME TOKEN] Error:', error);
      res.status(500).json({ message: `Failed to create voice session: ${error.message}` });
    }
  });

  // Chat / Conversations
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Fetch user record to get saved preferences (defensive fallback)
      let userRecord = await storage.getUser(userId);
      
      // Defensive sync: If user has valid preferences but onboardingCompleted is false, update it
      if (userRecord && !userRecord.onboardingCompleted) {
        const hasValidPreferences = userRecord.targetLanguage && userRecord.difficultyLevel && (userRecord.firstName || userRecord.lastName);
        if (hasValidPreferences) {
          console.log('[DEFENSIVE SYNC] User has valid preferences but onboardingCompleted is false, updating...');
          await storage.updateUserPreferences(userId, {
            onboardingCompleted: true
          });
          // Refetch user record with updated flag
          userRecord = await storage.getUser(userId);
          console.log('[DEFENSIVE SYNC] Updated onboardingCompleted to true');
        }
      }
      
      // Parse request body, but use user preferences as defaults if not provided
      const data = insertConversationSchema.parse({
        ...req.body,
        language: req.body.language || userRecord?.targetLanguage || "spanish",
        difficulty: req.body.difficulty || userRecord?.difficultyLevel || "beginner",
        nativeLanguage: req.body.nativeLanguage || userRecord?.nativeLanguage || "english"
      });
      
      // Get userName - use from request or fallback to user profile (first name only)
      // Treat "Student" as a placeholder and replace with profile name
      const requestUserName = (req.body.userName || "").trim();
      const isPlaceholder = !requestUserName || requestUserName.toLowerCase() === "student";
      const profileUserName = userRecord?.firstName || "";
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
      
      // Use nativeLanguage from user record (set during onboarding)
      // Native language is a user property, not a conversation property - it should not be inherited
      userNativeLanguage = data.nativeLanguage; // Already set from userRecord?.nativeLanguage on line 858
      console.log('[CONVERSATION CREATE] Using nativeLanguage from user record:', userNativeLanguage);
      
      // REUSE EXISTING CONVERSATIONS: Check if a recent conversation exists for this user/language
      // Only create a new one if necessary (prevents creating 100+ conversations)
      const allConversations = await storage.getUserConversations(userId);
      const recentConversation = allConversations
        .filter(c => 
          c.language === data.language && 
          c.isOnboarding === isOnboarding &&
          (!userName || c.userName === userName) // Match userName if provided
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      
      let conversation;
      let isNewConversation = false;
      
      console.log('[CONVERSATION CREATE] forceNew flag:', req.body.forceNew, 'recentConversation exists:', !!recentConversation);
      
      // Check if recent conversation has messages before reusing
      let canReuseConversation = false;
      if (recentConversation && !req.body.forceNew) {
        const existingMessages = await storage.getMessagesByConversation(recentConversation.id);
        canReuseConversation = existingMessages.length > 0;
        console.log('[CONVERSATION CREATE] Recent conversation has', existingMessages.length, 'messages, canReuse:', canReuseConversation);
      }
      
      if (canReuseConversation && recentConversation) {
        // Reuse existing conversation (only if it has messages)
        conversation = recentConversation;
        console.log('[CONVERSATION REUSE] Using existing conversation:', conversation.id);
        isNewConversation = false;
      } else {
        // Create new conversation only if none exists or explicitly requested
        conversation = await storage.createConversation({
          ...data,
          userId,
          isOnboarding,
          onboardingStep: isOnboarding ? "name" : null,
          userName: isOnboarding ? null : userName,
          nativeLanguage: userNativeLanguage || data.nativeLanguage || "english",
        } as typeof conversations.$inferInsert);
        
        console.log('[CONVERSATION CREATE] Created new conversation:', conversation.id);
        isNewConversation = true;
      }
      
      console.log('[CONVERSATION CREATE] Created conversation:', {
        id: conversation.id,
        isOnboarding: conversation.isOnboarding,
        onboardingStep: conversation.onboardingStep,
        userName: conversation.userName,
        nativeLanguage: conversation.nativeLanguage
      });
      
      // NOTE: Hardcoded greeting removed - now using dynamic AI-generated greeting via streaming pipeline
      // The greeting is generated when the client sends a 'request_greeting' message after session starts
      // See replit.md "Reversion Notes" section for how to restore hardcoded greeting if needed
      
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

  // IMPORTANT: This route MUST come before /api/conversations/:id to avoid "filtered" being treated as an ID
  app.get("/api/conversations/filtered", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { timeFilter, starredOnly, topicId } = req.query;
      
      const conversations = await storage.getFilteredConversations(userId, {
        timeFilter: timeFilter as 'today' | 'week' | 'month' | 'older' | undefined,
        starredOnly: starredOnly === 'true',
        topicId: topicId as string | undefined
      });
      
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Week 1 Feature: Smart search across all user conversations
  app.get("/api/search/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const results = await storage.searchMessages(userId, query, limit);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Week 1 Feature: AI-powered practice suggestions based on conversation history
  app.get("/api/practice-suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = req.user;
      const userProfile = await storage.getUser(userId);
      
      if (!userProfile) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get recent conversations and messages to analyze (sorted by recency)
      const conversations = await storage.getUserConversations(userId);
      const recentConversations = conversations
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3); // Last 3 conversations by creation date
      
      // Collect recent messages from these conversations
      const messagePromises = recentConversations.map(c => storage.getMessagesByConversation(c.id));
      const allMessages = await Promise.all(messagePromises);
      const flatMessages = allMessages.flat();
      
      // Extract recent user messages and AI responses for pattern analysis
      const recentHistory = flatMessages.slice(-30).map(m => ({
        role: m.role,
        content: m.content.substring(0, 200) // Limit content to reduce token usage
      }));
      
      // Use Gemini to analyze patterns and generate suggestions
      const model = getModelForTier(user.subscriptionTier, user);
      const analysisPrompt = `You are analyzing a language learning conversation history to provide personalized practice suggestions.

STUDENT PROFILE:
- Learning: ${userProfile.targetLanguage}
- Native Language: ${userProfile.nativeLanguage || 'English'}
- Difficulty: ${userProfile.difficultyLevel}
- ACTFL Level: ${userProfile.actflLevel || 'Not assessed'}

RECENT CONVERSATION HISTORY (last 30 messages):
${recentHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

TASK: Analyze the conversation history and generate 3-5 personalized practice suggestions. For each suggestion, identify:
1. A specific pattern, gap, or opportunity you noticed
2. A clear, actionable practice recommendation
3. Why this would benefit the student

Focus on:
- Common mistakes or confusion patterns
- Grammar/vocabulary gaps
- Topics not yet covered
- Areas where student shows readiness to advance

Return a JSON array of suggestions with this format:
{
  "suggestions": [
    {
      "pattern": "Student confuses ser vs estar",
      "suggestion": "Practice using ser and estar in different contexts",
      "reason": "Mastering this distinction will improve accuracy in describing states vs characteristics"
    }
  ]
}`;

      const response = await callGeminiWithSchema(
        model,
        [{ role: "user", content: analysisPrompt }],
        {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pattern: { type: "string" },
                  suggestion: { type: "string" },
                  reason: { type: "string" }
                },
                required: ["pattern", "suggestion", "reason"]
              }
            }
          },
          required: ["suggestions"]
        }
      );
      
      const parsed = JSON.parse(response);
      res.json(parsed.suggestions || []);
    } catch (error: any) {
      console.error('[PRACTICE SUGGESTIONS] Error:', error);
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
      
      // Add resume metadata for Week 1 feature
      const allMessages = await storage.getMessagesByConversation(req.params.id);
      // Use 100 messages as context limit for all conversations (Gemini's 1M context window supports this)
      const contextLimit = 100;
      const isResuming = allMessages.length > contextLimit;
      
      res.json({
        ...conversation,
        resumeMetadata: {
          isResuming,
          totalMessages: allMessages.length,
          contextLimit,
          lastActiveAt: allMessages.length > 0 
            ? allMessages[allMessages.length - 1].createdAt 
            : conversation.createdAt
        }
      });
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

  app.post("/api/conversations/:id/messages", aiLimiter, isAuthenticated, async (req: any, res) => {
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
            
            Write a brief, friendly message IN ${nativeLanguage} that:
            1. Welcomes them warmly
            2. Introduces one simple ${targetLanguage} word (like "Hola" for Spanish) with its meaning
            3. Optionally asks what topics interest them (travel, food, music, etc.) to personalize learning
            
            Keep it conversational and encouraging. Use ONLY ${nativeLanguage} for explanations.`;
            
            console.log('[ONBOARDING-COMPLETION PROMPT]', nativeLanguagePrompt);
            
            try {
              const user = req.user;
              const model = getModelForTier(user.subscriptionTier, user);
              
              aiResponse = await callGemini(model, [
                { role: "user", content: nativeLanguagePrompt }
              ]);
              
              console.log('[ONBOARDING-COMPLETION SUCCESS] Generated:', aiResponse.substring(0, 100));
            } catch (error) {
              console.error('[ONBOARDING-COMPLETION ERROR]', error);
              aiResponse = `Perfect, ${userName}! Let's start with a simple word. What topics interest you - travel, food, music, or something else?`;
              console.log('[ONBOARDING-COMPLETION FALLBACK] Using English fallback');
            }
          } else {
            // Native language unclear, ask again
            console.log('[ONBOARDING-NATIVE-LANG] Extraction failed or low confidence, asking again');
            aiResponse = "I didn't quite catch that. What language do you speak? (For example: English, Spanish, French, German, etc.)";
          }
        }

        // Check if this is a voice mode request (for onboarding too)
        const isVoiceMode = req.body.isVoiceMode === true;

        // Extract target language text for voice mode onboarding
        const targetLanguageText = isVoiceMode ? extractTargetLanguageText(aiResponse) : null;
        const hasTargetLanguage = targetLanguageText && hasSignificantTargetLanguageContent(targetLanguageText);

        // Save AI response for onboarding (with enrichmentStatus for voice mode)
        // Only include enrichmentStatus if voice mode to avoid undefined→null conversion
        const aiMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: aiResponse,
          ...(hasTargetLanguage ? { targetLanguageText } : {}),
          ...(isVoiceMode ? { enrichmentStatus: "pending" } : {}),
        });

        // Return onboarding response with updated conversation
        res.json({ 
          userMessage, 
          aiMessage,
          conversationUpdated: updatedConversation !== conversation ? updatedConversation : undefined
        });

        // Queue background enrichment for voice mode onboarding (non-blocking)
        if (isVoiceMode) {
          setImmediate(async () => {
            try {
              console.log('[ONBOARDING VOICE ENRICHMENT] Starting for message:', aiMessage.id);
              await storage.updateMessage(aiMessage.id, { enrichmentStatus: null });
              console.log('[ONBOARDING VOICE ENRICHMENT] Completed (onboarding messages get minimal enrichment)');
            } catch (enrichError) {
              console.error('[ONBOARDING VOICE ENRICHMENT] Error:', enrichError);
              await storage.updateMessage(aiMessage.id, { enrichmentStatus: "failed" });
            }
          });
        }

        return; // Exit early for onboarding
      }

      // Check if this is a voice mode request (fast response needed)
      // Note: isVoiceMode is already declared above for onboarding, but onboarding returns early
      // so we need to re-declare it here for the regular chat flow
      const isVoiceMode = req.body.isVoiceMode === true;

      // VOICE MODE FAST-PATH: Skip expensive operations for sub-5s responses
      if (isVoiceMode) {
        console.log('[VOICE FAST-PATH] Entering optimized voice mode path');
        const startTime = Date.now();

        // Fetch conversation history with Gemini's 1M context window (can handle 100+ messages)
        const allMessages = await storage.getMessagesByConversation(conversationId);
        const contextLimit = 10; // VOICE MODE: Keep small for fast responses (<6s target)
        const recentMessages = allMessages.slice(-contextLimit);
        const userMessageCount = recentMessages.filter(m => m.role === "user").length;
        const isResumingConversation = allMessages.length > contextLimit && userMessageCount > 0;
        
        if (isResumingConversation) {
          console.log(`[RESUME] Voice conversation has ${allMessages.length} total messages, resuming with last ${contextLimit}`);
        }

        // OPTIMIZATION: Fast heuristic check for language change keywords BEFORE expensive AI call
        // Only check for language change if message contains relevant keywords
        const languageChangeKeywords = [
          'switch', 'change', 'learn', 'start', 'instead', 'different',
          'spanish', 'french', 'german', 'italian', 'portuguese', 
          'japanese', 'mandarin', 'korean', 'english'
        ];
        const messageContent = messageData.content.toLowerCase();
        const mightWantLanguageChange = languageChangeKeywords.some(keyword => 
          messageContent.includes(keyword)
        );

        // CRITICAL: Detect target language change BEFORE generating AI response
        // This ensures the AI knows the correct language for this response
        // ONLY run expensive AI detection if heuristic suggests possible change
        let targetLanguageChangeRequest: any = { wantsToChange: false, newTargetLanguage: null };
        if (mightWantLanguageChange) {
          console.log('[VOICE OPTIMIZATION] Possible language change detected, running AI detection...');
          targetLanguageChangeRequest = await detectTargetLanguageChangeRequest(
            openai,
            messageData.content,
            conversation.language
          );
        } else {
          console.log('[VOICE OPTIMIZATION] No language change keywords detected, skipping AI check');
        }

        // Use updatedConversation for the rest of the request if language changed
        let activeConversation = conversation;
        if (targetLanguageChangeRequest.wantsToChange && 
            targetLanguageChangeRequest.newTargetLanguage &&
            targetLanguageChangeRequest.confidence !== "low" &&
            targetLanguageChangeRequest.newTargetLanguage !== conversation.language) {
          
          console.log('[VOICE FAST-PATH] Target language change detected:', conversation.language, '→', targetLanguageChangeRequest.newTargetLanguage);
          
          const updated = await storage.updateConversation(conversationId, userId, {
            language: targetLanguageChangeRequest.newTargetLanguage,
          });
          
          if (updated) {
            activeConversation = updated;
          }
        }

        // VOICE MODE: Always use Gemini 2.5 Flash for speed (same 1M context as Pro)
        // Pro model testing can be enabled later via user preference
        const user = req.user;
        
        // Get user's personality and expressiveness preferences for system prompt
        const tutorPersonality = (user?.tutorPersonality as 'warm' | 'calm' | 'energetic' | 'professional') || 'warm';
        const tutorExpressiveness = user?.tutorExpressiveness || 3;

        // Create minimal system prompt (skip vocabulary/conversation queries for speed)
        const systemPrompt = createSystemPrompt(
          activeConversation.language,
          activeConversation.difficulty,
          userMessageCount,
          true, // IS voice mode - use voice-specific language balance
          activeConversation.topic,
          [], // No previous conversations (deferred to background)
          activeConversation.nativeLanguage,
          undefined, // No due vocabulary (deferred to background)
          undefined, // No session vocabulary (deferred to background)
          activeConversation.actflLevel, // ACTFL proficiency level
          isResumingConversation, // Week 1 Feature: Resume conversation awareness
          allMessages.length, // Total message count for resume context
          tutorPersonality, // Tutor personality style
          tutorExpressiveness // Expressiveness level (1-5)
        );
        const model = 'gemini-2.5-flash'; // Force Flash for voice (~200ms TTFT vs ~500ms+ for Pro)
        
        const fetchTime = Date.now() - startTime;
        console.log(`[VOICE FAST-PATH] Using ${model} for speed, context fetched in ${fetchTime}ms`);

        // Quick structured completion for voice mode (enforces target/native format) - Gemini
        const completionStart = Date.now();
        const nativeLanguageName = activeConversation.nativeLanguage || 'english';
        const targetLanguageName = activeConversation.language;
        
        // SCHEMA-LEVEL PREVENTION: Enforce rules BEFORE AI generates response
        // This prevents issues instead of fixing them after
        const difficultyLevel = activeConversation.difficulty || 'beginner';
        
        // Import emotion types for schema (tutorPersonality/tutorExpressiveness defined above)
        const { getAllowedEmotions } = await import('./services/tts-service');
        const allowedEmotions = getAllowedEmotions(tutorPersonality, tutorExpressiveness);
        
        const voiceResponseSchema = difficultyLevel === 'beginner' ? {
          type: "object",
          properties: {
            target: { 
              type: "string",
              description: `CRITICAL: ALWAYS put the word/phrase being TAUGHT (max 15 characters). 

WHAT GOES HERE:
- Extract the ${targetLanguageName} word from the quotes in "Try saying 'word'!" at the end of your native field
- This is the NEXT word the student should learn
- Examples: 'Hola', 'Buenos días', 'Gracias'

WHAT NEVER GOES HERE:
- NO encouragement words like '¡Excelente!', '¡Perfecto!' (those go in TTS audio, not here)
- NO ${nativeLanguageName} words

EXAMPLES:
Native: "You just said 'Hello'! Try saying 'Buenos días'!"
Target: "Buenos días"  ← Extract from quotes

Native: "Great! Now try 'Gracias'!"
Target: "Gracias"  ← Extract from quotes`,
              maxLength: 15
            },
            native: { 
              type: "string",
              description: `STRICT: Brief ${nativeLanguageName} teaching content (30-150 characters max).

STRUCTURE (IF giving feedback on student's speech):
"¡Excelente! [feedback in ${nativeLanguageName}]. Try saying word!"

STRUCTURE (IF teaching first word):
"[Teaching in ${nativeLanguageName}]. Try saying word!"

CRITICAL RULES:
1. OPTIONALLY start with ${targetLanguageName} encouragement word (¡Excelente!, ¡Perfecto!, etc.) when praising student
2. Main content in ${nativeLanguageName} ONLY
3. DO NOT use quotes or punctuation around ${targetLanguageName} words - just write them plain (NO 'word' or "word")
4. MUST end with "Try saying word!" where word matches your target field exactly (no quotes)
5. NO text after the "Try saying" encouragement
6. Keep punctuation simple - avoid multiple periods, colons, semicolons
7. NEVER include phonetic pronunciations (like boo-EHN-ahs or NO-chehs) - the voice pronounces perfectly already
8. NO pronunciation guides, syllable breakdowns, or phonetic hints in parentheses

EXAMPLES:
Good: "¡Excelente! You said Hello! Try saying Buenos días!"  (target: "Buenos días")
Good: "Hola means hello. Try saying Hola!"  (target: "Hola")
Good: "¡Buen intento! Remember the B sound and the -ches ending. Try saying Buenas noches!"
Bad: "Hola (OH-la) means hello."  (phonetic guide - unnecessary)
Bad: "Try Buenas noches, boo-EHN-ahs NO-chehs."  (phonetic pronunciation spoken out loud)
Bad: "'Hola' means 'hello'. Try saying 'Hola'!"  (has quotes - causes pronunciation artifacts)`,
              minLength: 30,
              maxLength: 150
            },
            emotion: {
              type: "string",
              enum: allowedEmotions,
              description: `Select the emotion that best matches this response's tone. Choose from: ${allowedEmotions.join(', ')}. This controls the TTS voice expressiveness.`
            }
          },
          required: ["target", "native", "emotion"]
        } : {
          // Intermediate/Advanced: Less strict
          type: "object",
          properties: {
            target: { 
              type: "string",
              description: `Target language text (${targetLanguageName}) - REQUIRED, NEVER EMPTY. Must be in ${targetLanguageName} language. ${difficultyLevel === 'intermediate' ? 'Use 70-80% target language.' : 'Use 85-95% target language.'}`
            },
            native: { 
              type: "string",
              description: `Student's native language (${nativeLanguageName}) explanations and teaching content. ${difficultyLevel === 'intermediate' ? 'Use 20-30% native language.' : 'Use 5-15% native language.'}`
            },
            emotion: {
              type: "string",
              enum: allowedEmotions,
              description: `Select the emotion that best matches this response's tone. Choose from: ${allowedEmotions.join(', ')}. This controls the TTS voice expressiveness.`
            }
          },
          required: ["target", "native", "emotion"]
        };
        
        const parsed = await callGeminiWithSchema(
          model,
          [
            { role: "system", content: systemPrompt },
            ...recentMessages.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ],
          voiceResponseSchema
        );
        const completionTime = Date.now() - completionStart;

        const responseContent = JSON.stringify(parsed);
        
        // Parse and validate structured JSON response (schema-enforced)
        let aiResponse: string;
        let targetLanguageText = '';
        let hasTargetLanguage = false;
        let subtitlesJson: string | null = null; // For dual-subtitle sequences
        let aiSelectedEmotion: string | undefined; // AI-selected emotion for TTS
        
        try {
          let parsed = JSON.parse(responseContent);
          
          // Extract AI-selected emotion for TTS expressiveness
          aiSelectedEmotion = parsed.emotion;
          
          // SANITIZER: Trim any extra content after "Try saying" or "Try it!"
          // This prevents AI from adding marketing-style closers after the encouragement
          if (parsed.native && difficultyLevel === 'beginner') {
            // Look for "Try saying 'word'!" or "Try it!" and truncate after it
            const tryPatterns = [
              /Try saying '[^']+!'[^!]*/i,  // Match "Try saying 'word'!" and capture excess
              /Try it![^!]*/i                // Match "Try it!" and capture excess
            ];
            
            for (const pattern of tryPatterns) {
              const match = parsed.native.match(pattern);
              if (match) {
                // Find the position of the exclamation mark
                const exclamationIndex = parsed.native.indexOf('!', match.index);
                if (exclamationIndex !== -1) {
                  // Truncate everything after the exclamation mark
                  const truncated = parsed.native.substring(0, exclamationIndex + 1).trim();
                  if (truncated !== parsed.native) {
                    console.log(`[VOICE SANITIZER] Trimmed extra content after encouragement:`);
                    console.log(`  Original: ${parsed.native}`);
                    console.log(`  Trimmed: ${truncated}`);
                    parsed.native = truncated;
                  }
                }
                break;
              }
            }
          }
          
          // Strict validation: Ensure both target and native fields exist
          if (typeof parsed.target !== 'string' || typeof parsed.native !== 'string') {
            console.error('[VOICE VALIDATION ERROR] Missing required fields:', {
              hasTarget: typeof parsed.target === 'string',
              hasNative: typeof parsed.native === 'string',
              response: responseContent.substring(0, 200)
            });
            throw new Error('Structured response missing target or native fields');
          }
          
          let target = (parsed.target || '').trim();
          let native = (parsed.native || '').trim();
          
          // SCHEMA + LIGHTWEIGHT DETECTION: Schema enforces length, we check language
          const targetLangName = conversation.language || 'spanish';
          const nativeLangName = conversation.nativeLanguage || 'english';
          
          // Safety net: Empty strings (schema should prevent)
          if (!target || !native) {
            console.error('[VOICE SCHEMA VIOLATION] Empty fields despite schema enforcement');
            const defaultGreetings: Record<string, string> = {
              spanish: "Hola", french: "Bonjour", german: "Hallo", italian: "Ciao",
              portuguese: "Olá", japanese: "こんにちは", korean: "안녕하세요",
              mandarin: "你好", russian: "Привет"
            };
            target = defaultGreetings[targetLangName] || "Hello";
            native = `Let's practice the most common greeting: '${target}'. Try saying it!`;
          }
          
          // UNIVERSAL LANGUAGE GUARD: Detect and fix wrong language in target (all native languages)
          if (conversation.difficulty === 'beginner') {
            // Map language names to ISO-639-3 codes for franc-min
            const langToISO: Record<string, string> = {
              'english': 'eng', 'spanish': 'spa', 'french': 'fra', 'german': 'deu',
              'italian': 'ita', 'portuguese': 'por', 'japanese': 'jpn', 'korean': 'kor',
              'mandarin chinese': 'cmn', 'mandarin': 'cmn', 'russian': 'rus', 'chinese': 'cmn'
            };
            
            let isWrongLanguage = false;
            
            // For short strings (<3 chars), check against native language stoplist
            // Don't block ALL short words - many valid target language words are short!
            if (target.length < 3) {
              // Per-language stoplists for common short native words
              const chineseWords = ['是', '不', '我', '你', '他', '她', '的', '了', '在', '和'];
              const shortNativeWords: Record<string, string[]> = {
                'english': ['ok', 'hi', 'no', 'yes', 'go', 'me', 'we', 'is', 'am', 'be', 'or', 'to', 'up'],
                'spanish': ['sí', 'no', 'yo', 'tú', 'él', 'la', 'el', 'de', 'es', 'un'],
                'french': ['oui', 'non', 'je', 'tu', 'il', 'la', 'le', 'de', 'un', 'et'],
                'german': ['ja', 'nein', 'ich', 'du', 'er', 'sie', 'es', 'der', 'die', 'das', 'und'],
                'italian': ['sì', 'no', 'io', 'tu', 'lui', 'lei', 'la', 'il', 'di', 'un', 'e'],
                'portuguese': ['sim', 'não', 'eu', 'tu', 'ele', 'ela', 'o', 'a', 'de', 'um', 'e'],
                'russian': ['да', 'нет', 'я', 'ты', 'он', 'она', 'и', 'в', 'на', 'не'],
                'japanese': ['はい', 'いいえ', 'ね', 'よ', 'か', 'な', 'の', 'を', 'に', 'が'],
                'korean': ['네', '아니', '예', '나', '너', '그', '이', '의', '가', '을'],
                'mandarin': chineseWords,
                'mandarin chinese': chineseWords, // Support both variants
                'chinese': chineseWords  // Support all variants
              };
              
              const nativeStoplist = shortNativeWords[nativeLangName] || [];
              const targetLower = target.toLowerCase().replace(/[¡!¿?.,;]/g, '').trim();
              
              if (nativeStoplist.includes(targetLower)) {
                console.warn(`[VOICE LANG GUARD] Short native language word (${nativeLangName}) detected: "${target}"`);
                isWrongLanguage = true;
              }
            } else if (target.length >= 3) {
              // For longer strings, use franc-min for universal language detection
              let detectedISO = 'und';
              try {
                detectedISO = franc(target); // franc-min returns ISO 639-3 codes
              } catch (e) {
                console.warn('[VOICE LANG GUARD] Detection failed:', e);
              }
              
              const expectedTargetISO = langToISO[targetLangName] || 'und';
              const expectedNativeISO = langToISO[nativeLangName] || 'eng';
              isWrongLanguage = detectedISO === expectedNativeISO && detectedISO !== expectedTargetISO;
              
              console.log(`[VOICE LANG GUARD] Detected=${detectedISO}, expected=${expectedTargetISO}, native=${expectedNativeISO}, wrong=${isWrongLanguage}`);
            }
            
            if (isWrongLanguage) {
              console.warn(`[VOICE LANG GUARD] Target is in native language: "${target}"`);
              // Extract target language word from quotes in native field  
              const quotedWords = [...native.matchAll(/['"`''"\"「」『』«»‹›]([^'"`''"\"「」『』«»‹›]+)['"`''"\"「」『』«»‹›]/g)];
              if (quotedWords.length > 0) {
                // Use LAST quoted word (the new word being taught)
                target = quotedWords[quotedWords.length - 1][1].trim();
                console.log(`[VOICE LANG GUARD] ✓ Extracted from quotes: "${target}"`);
              } else {
                // Fallback to language-specific encouragement
                const encouragements: Record<string, string> = {
                  spanish: "¡Perfecto!", french: "Parfait!", german: "Gut!", italian: "Perfetto!",
                  portuguese: "Perfeito!", japanese: "すごい!", korean: "좋아요!", mandarin: "好!", russian: "Отлично!"
                };
                target = encouragements[targetLangName] || "Hola";
                console.log(`[VOICE LANG GUARD] ✓ Using encouragement fallback: "${target}"`);
              }
            }
          }
          
          // SIMPLE ARCHITECTURE:
          // - Screen shows: target field (word being taught - extracted from quotes)
          // - Voice speaks: native field (may include encouragement at start, e.g., "¡Excelente! You said...")
          
          targetLanguageText = target;
          hasTargetLanguage = hasSignificantTargetLanguageContent(targetLanguageText);
          
          // Voice speaks the native field directly
          // If AI wants encouragement, it's already included at the start of native field
          aiResponse = native;
          
          console.log('[VOICE SIMPLE] ✓ Target (teaching):', target.substring(0, 50), '| Native (audio):', native.substring(0, 50));
        } catch (error) {
          // Schema enforcement should prevent this, but log if it happens
          console.error('[VOICE CRITICAL ERROR] Failed to parse structured response:', error);
          console.error('[VOICE RAW RESPONSE]:', responseContent.substring(0, 500));
          
          // Fallback: Use native language error message (no Spanish to avoid confusion)
          aiResponse = "I'm having trouble generating a response. Please try again.";
          targetLanguageText = '';
          hasTargetLanguage = false;
        }
        
        console.log('[VOICE MESSAGE] Content:', aiResponse.length, 'chars | Target lang:', targetLanguageText.length, 'chars');
        
        // Save message immediately with enrichmentStatus="pending"
        const aiMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: aiResponse,
          targetLanguageText: hasTargetLanguage ? targetLanguageText : undefined,
          enrichmentStatus: "pending", // Mark for background enrichment
        });

        const totalTime = Date.now() - startTime;
        console.log(`[VOICE FAST-PATH] Completed in ${totalTime}ms (fetch: ${fetchTime}ms, AI: ${completionTime}ms)`);

        // Return response immediately for fast TTS
        // Include nativeLanguage so client uses correct TTS voice (English voice for English text)
        // Include emotion for expressive TTS with 3-layer emotion system
        res.json({ 
          userMessage, 
          aiMessage: {
            ...aiMessage,
            nativeLanguage: conversation.nativeLanguage || 'english',
            emotion: aiSelectedEmotion || 'friendly' // AI-selected emotion for TTS
          }
        });
        
        console.log(`[VOICE EMOTION] AI selected emotion: ${aiSelectedEmotion || 'friendly (default)'} for TTS`);

        // Queue comprehensive background enrichment (non-blocking)
        setImmediate(async () => {
          try {
            console.log('[VOICE BACKGROUND] Starting comprehensive enrichment for message:', aiMessage.id);
            const bgStart = Date.now();
            
            // Mark as processing
            await storage.updateMessage(aiMessage.id, { enrichmentStatus: "processing" });

            // Fetch all required data for enrichment (that we skipped in fast-path)
            const allMessagesForEnrichment = await storage.getMessagesByConversation(conversationId);
            const recentMessagesForEnrichment = allMessagesForEnrichment.slice(-20);
            const userMessageCountForEnrichment = recentMessagesForEnrichment.filter(m => m.role === "user").length;
            const wordCount = messageData.content.match(/[a-zA-ZÀ-ÿ]+/g)?.length || 0;

            // Get latest conversation state (may have changed)
            let enrichmentConversation = await storage.getConversation(conversationId, userId);
            if (!enrichmentConversation) {
              console.error('[VOICE BACKGROUND] Conversation no longer exists, aborting enrichment');
              await storage.updateMessage(aiMessage.id, { enrichmentStatus: "failed" });
              return;
            }

            // Detect language changes (deferred from fast-path)
            // TODO: Re-enable language auto-detection after implementing proper language detection
            // Currently disabled to avoid OpenAI dependency issues
            // if (userMessageCountForEnrichment >= 3 && wordCount >= 5) {
            //   const languageDetection = await detectLanguage(openai, messageData.content, enrichmentConversation.language);
            //   
            //   if (languageDetection.shouldSwitch && 
            //       languageDetection.detectedLanguage !== enrichmentConversation.language &&
            //       languageDetection.detectedLanguage !== "english" &&
            //       languageDetection.confidence > 0.8) {
            //     
            //     console.log('[VOICE BACKGROUND] Auto-detected language switch:', enrichmentConversation.language, '→', languageDetection.detectedLanguage);
            //     
            //     enrichmentConversation = await storage.updateConversation(conversationId, userId, {
            //       language: languageDetection.detectedLanguage,
            //     }) || enrichmentConversation;
            //   }
            // }

            // Detect native language change requests (deferred from fast-path)
            const nativeLanguageChangeRequest = await detectNativeLanguageChangeRequest(
              openai,
              messageData.content,
              enrichmentConversation.nativeLanguage || "english"
            );

            if (nativeLanguageChangeRequest.wantsToChange && 
                nativeLanguageChangeRequest.newNativeLanguage &&
                nativeLanguageChangeRequest.confidence !== "low" &&
                nativeLanguageChangeRequest.newNativeLanguage !== enrichmentConversation.nativeLanguage) {
              
              console.log('[VOICE BACKGROUND] Native language change detected:', enrichmentConversation.nativeLanguage, '→', nativeLanguageChangeRequest.newNativeLanguage);
              
              enrichmentConversation = await storage.updateConversation(conversationId, userId, {
                nativeLanguage: nativeLanguageChangeRequest.newNativeLanguage,
              }) || enrichmentConversation;
            }

            // Fetch vocabulary and conversation context (deferred from fast-path)
            const allUserConversations = await storage.getConversationsByLanguage(enrichmentConversation.language, userId);
            const previousConversations = allUserConversations
              .filter(c => 
                c.id !== conversationId && 
                !c.isOnboarding && 
                c.userName === enrichmentConversation.userName &&
                c.messageCount && c.messageCount > 1
              )
              .slice(0, 5)
              .map(c => ({
                id: c.id,
                title: c.title,
                messageCount: c.messageCount,
                createdAt: c.createdAt.toISOString()
              }));

            const allSessionVocab = await storage.getVocabularyWords(
              enrichmentConversation.language,
              userId,
              enrichmentConversation.difficulty
            );
            
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const sessionVocabulary = allSessionVocab
              .filter(v => new Date(v.createdAt) > oneHourAgo)
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .slice(-10)
              .map(v => ({
                word: v.word,
                translation: v.translation,
                example: v.example,
                pronunciation: v.pronunciation
              }));

            const dueVocabulary = await storage.getDueVocabulary(
              enrichmentConversation.language,
              userId,
              enrichmentConversation.difficulty,
              5
            );

            // Generate enriched completion with structured output
            // Use default personality for background enrichment (not TTS-related)
            const enrichedSystemPrompt = createSystemPrompt(
              enrichmentConversation.language,
              enrichmentConversation.difficulty,
              userMessageCountForEnrichment,
              false,
              enrichmentConversation.topic,
              previousConversations,
              enrichmentConversation.nativeLanguage,
              dueVocabulary.length > 0 ? dueVocabulary.map(v => ({
                word: v.word,
                translation: v.translation,
                example: v.example,
                pronunciation: v.pronunciation
              })) : undefined,
              sessionVocabulary.length > 0 ? sessionVocabulary : undefined,
              enrichmentConversation.actflLevel, // ACTFL proficiency level
              false, // Background enrichment doesn't need resume context
              0, // Background enrichment doesn't need total message count
              'warm', // Default personality for background enrichment
              3 // Default expressiveness for background enrichment
            );

            const enrichmentSchema = {
              type: "object",
              properties: {
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
                    required: ["word", "translation", "example", "pronunciation"]
                  }
                },
                media: {
                  type: "array",
                  description: "Images to display with this message (0-2 images max)",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["stock", "ai_generated"] },
                      query: { type: "string", nullable: true },
                      prompt: { type: "string", nullable: true },
                      alt: { type: "string" }
                    },
                    required: ["type", "alt"]
                  }
                }
              },
              required: ["vocabulary", "media"]
            };
            
            let enrichmentData: { vocabulary?: any[]; media?: any[] } = {};
            
            try {
              enrichmentData = await callGeminiWithSchema(
                model,
                [
                  { role: "system", content: enrichedSystemPrompt },
                  ...recentMessagesForEnrichment.map((msg) => ({
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                  })),
                ],
                enrichmentSchema
              );
            } catch (parseError) {
              console.error('[VOICE BACKGROUND] Failed to generate enrichment data:', parseError);
            }

            // Process media
            let mediaJson: string | null = null;
            const mediaItems = Array.isArray(enrichmentData.media) ? enrichmentData.media : [];
            
            if (mediaItems.length > 0) {
              const processedMedia = [];
              
              for (const item of mediaItems.slice(0, 2)) {
                try {
                  if (item.type === "stock" && item.query) {
                    const cachedImage = await storage.getCachedStockImage(item.query);
                    
                    if (cachedImage) {
                      await storage.incrementImageUsage(cachedImage.id);
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
                    }
                  }
                } catch (error) {
                  console.error('[VOICE BACKGROUND] Error processing media:', error);
                }
              }
              
              if (processedMedia.length > 0) {
                mediaJson = JSON.stringify(processedMedia);
              }
            }

            // Save vocabulary to database with source conversation link
            if (Array.isArray(enrichmentData.vocabulary) && enrichmentData.vocabulary.length > 0) {
              for (const vocab of enrichmentData.vocabulary) {
                try {
                  await storage.createVocabularyWord({
                    userId,
                    language: enrichmentConversation.language,
                    word: vocab.word,
                    translation: vocab.translation,
                    example: vocab.example,
                    pronunciation: vocab.pronunciation,
                    difficulty: enrichmentConversation.difficulty,
                    sourceConversationId: conversationId,
                  });
                } catch (vocabError) {
                  console.error('[VOICE BACKGROUND] Failed to save vocabulary:', vocabError);
                }
              }
            }

            // TODO: Generate TTS with word timings (requires Google Cloud beta API)
            // For now, enrichment focuses on vocabulary and media
            // Word timing support to be added in future iteration

            // Update message with enriched data
            await storage.updateMessage(aiMessage.id, {
              mediaJson: mediaJson || undefined,
              enrichmentStatus: null, // null = complete (enriched)
            });

            const bgTime = Date.now() - bgStart;
            console.log(`[VOICE BACKGROUND] Enrichment completed in ${bgTime}ms (${enrichmentData.vocabulary?.length || 0} vocab, ${mediaItems.length} media)`);
          } catch (enrichError: any) {
            console.error('[VOICE BACKGROUND] Enrichment failed:', enrichError);
            await storage.updateMessage(aiMessage.id, { enrichmentStatus: "failed" });
          }
        });

        return; // Exit early for voice mode fast-path
      }

      // TEXT MODE: Original comprehensive path with all checks
      console.log('[TEXT MODE] Using standard comprehensive response path');

      // Get conversation history with Gemini's 1M context window (can handle 150+ messages)
      const allMessages = await storage.getMessagesByConversation(conversationId);
      const contextLimit = 150; // Increased from 20 to leverage Gemini's large context window
      const recentMessages = allMessages.slice(-contextLimit);
      const isResumingConversation = allMessages.length > contextLimit;

      // Detect language in user's message for auto-switching (only after a few messages)
      let updatedConversation = conversation;
      let languageSwitchNote = "";
      
      // Only attempt auto-detection after at least 3 user messages
      const userMessageCount = recentMessages.filter(m => m.role === "user").length;
      
      // Count actual alphabetic words (not punctuation or numbers)
      const wordCount = messageData.content.match(/[a-zA-ZÀ-ÿ]+/g)?.length || 0;
      
      // TODO: Re-enable language auto-detection after implementing proper language detection
      // Currently disabled to avoid OpenAI dependency issues
      // if (userMessageCount >= 3 && wordCount >= 5) {
        // const languageDetection = await detectLanguage(openai, messageData.content, conversation.language);
        
        // Apply strict criteria before auto-switching:
        // 1. High confidence (>0.8)
        // 2. Model recommends switching
        // 3. Different from current language and not just English
        // 4. Message has substantial content (not just a greeting)
        /*
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
        */
      // }

      // OPTIMIZATION: Fast heuristic check for language change keywords BEFORE expensive AI call
      const languageChangeKeywords = [
        'switch', 'change', 'learn', 'start', 'instead', 'different',
        'spanish', 'french', 'german', 'italian', 'portuguese', 
        'japanese', 'mandarin', 'korean', 'english'
      ];
      const textMessageContent = messageData.content.toLowerCase();
      const textMightWantLanguageChange = languageChangeKeywords.some(keyword => 
        textMessageContent.includes(keyword)
      );

      // Detect if user is requesting to change their target learning language
      // ONLY run expensive AI detection if heuristic suggests possible change
      let targetLanguageChangeRequest: any = { wantsToChange: false, newTargetLanguage: null };
      if (textMightWantLanguageChange) {
        console.log('[TEXT OPTIMIZATION] Possible language change detected, running AI detection...');
        targetLanguageChangeRequest = await detectTargetLanguageChangeRequest(
          openai,
          messageData.content,
          updatedConversation.language
        );
      } else {
        console.log('[TEXT OPTIMIZATION] No language change keywords detected, skipping AI check');
      }

      // Only update if actually requesting a change to a different language
      if (targetLanguageChangeRequest.wantsToChange && 
          targetLanguageChangeRequest.newTargetLanguage &&
          targetLanguageChangeRequest.confidence !== "low" &&
          targetLanguageChangeRequest.newTargetLanguage !== updatedConversation.language) {
        
        console.log('[TARGET-LANG-CHANGE] Changing target language from', updatedConversation.language, 'to', targetLanguageChangeRequest.newTargetLanguage);
        
        updatedConversation = await storage.updateConversation(conversationId, userId, {
          language: targetLanguageChangeRequest.newTargetLanguage,
        }) || updatedConversation;
        
        languageSwitchNote += `¡Perfecto! I've switched to ${targetLanguageChangeRequest.newTargetLanguage}. Let's start learning! `;
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

      // Determine which model to use based on subscription tier
      const user = req.user;
      
      // Get user's personality and expressiveness preferences
      const textTutorPersonality = (user?.tutorPersonality as 'warm' | 'calm' | 'energetic' | 'professional') || 'warm';
      const textTutorExpressiveness = user?.tutorExpressiveness || 3;
      
      // Create adaptive system prompt based on language, difficulty, and conversation progress
      // Use userMessageCount (already calculated above) instead of total message count
      // This ensures phases align with actual conversation turns
      const systemPrompt = createSystemPrompt(
        updatedConversation.language,
        updatedConversation.difficulty,
        userMessageCount,
        false, // not voice mode
        updatedConversation.topic,
        previousConversations, // Always pass array (even if empty) for consistency
        updatedConversation.nativeLanguage,
        dueVocabulary.length > 0 ? dueVocabulary.map(v => ({
          word: v.word,
          translation: v.translation,
          example: v.example,
          pronunciation: v.pronunciation
        })) : undefined,
        sessionVocabulary.length > 0 ? sessionVocabulary : undefined,
        updatedConversation.actflLevel, // ACTFL proficiency level
        isResumingConversation, // Week 1 Feature: Resume conversation awareness
        allMessages.length, // Total message count for resume context
        textTutorPersonality, // Tutor personality style
        textTutorExpressiveness // Expressiveness level (1-5)
      );
      const model = getModelForTier(user.subscriptionTier, user);
      
      console.log(`[CHAT] Using model ${model} for tier: ${user.subscriptionTier || 'free'}, voiceMode: ${isVoiceMode}`);

      // VOICE MODE: Fast text-only response, then background enrichment
      if (isVoiceMode) {
        console.log('[VOICE MODE] Using fast text-only response path');
        
        // Quick text-only completion (Gemini, much faster)
        const responseContent = await callGemini(
          model,
          [
            { role: "system", content: systemPrompt },
            ...recentMessages.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ]
        ).catch(() => "I'm sorry, I couldn't generate a response.");
        
        // System prompt asks for JSON, so extract just the message field
        let aiResponse = responseContent;
        try {
          const parsed = JSON.parse(responseContent);
          if (parsed.message) {
            aiResponse = parsed.message;
          }
        } catch {
          // If not JSON, use as-is (fallback for plain text responses)
        }
        
        // Save message immediately with enrichmentStatus="pending"
        const aiMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: aiResponse,
          enrichmentStatus: "pending", // Mark for background enrichment
        });

        // Return response immediately for fast TTS
        res.json({ userMessage, aiMessage });

        // Queue background enrichment (non-blocking)
        setImmediate(async () => {
          try {
            console.log('[BACKGROUND ENRICHMENT] Starting for message:', aiMessage.id);
            
            // Mark as processing
            await storage.updateMessage(aiMessage.id, { enrichmentStatus: "processing" });

            // Generate enriched version with structured output (Gemini)
            const enrichmentSchemaV2 = {
              type: "object",
              properties: {
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
                    required: ["word", "translation", "example", "pronunciation"]
                  }
                },
                media: {
                  type: "array",
                  description: "Images to display with this message (0-2 images max)",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["stock", "ai_generated"] },
                      query: { type: "string", nullable: true },
                      prompt: { type: "string", nullable: true },
                      alt: { type: "string" }
                    },
                    required: ["type", "alt"]
                  }
                }
              },
              required: ["vocabulary", "media"]
            };
            
            let enrichmentData: { vocabulary?: any[]; media?: any[] } = {};
            
            try {
              enrichmentData = await callGeminiWithSchema(
                model,
                [
                  { role: "system", content: systemPrompt },
                  ...recentMessages.map((msg) => ({
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                  })),
                ],
                enrichmentSchemaV2
              );
            } catch (parseError) {
              console.error('[BACKGROUND ENRICHMENT] Failed to generate enrichment data:', parseError);
            }

            // Process media (same logic as text mode)
            let mediaJson: string | null = null;
            const mediaItems = Array.isArray(enrichmentData.media) ? enrichmentData.media : [];
            
            if (mediaItems.length > 0) {
              const processedMedia = [];
              
              for (const item of mediaItems.slice(0, 2)) {
                try {
                  if (item.type === "stock" && item.query) {
                    const cachedImage = await storage.getCachedStockImage(item.query);
                    
                    if (cachedImage) {
                      await storage.incrementImageUsage(cachedImage.id);
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
                    }
                  }
                } catch (error) {
                  console.error('[BACKGROUND ENRICHMENT] Error processing media:', error);
                }
              }
              
              if (processedMedia.length > 0) {
                mediaJson = JSON.stringify(processedMedia);
              }
            }

            // Save vocabulary to database with source conversation link
            if (Array.isArray(enrichmentData.vocabulary) && enrichmentData.vocabulary.length > 0) {
              for (const vocab of enrichmentData.vocabulary) {
                try {
                  await storage.createVocabularyWord({
                    userId,
                    language: updatedConversation.language,
                    word: vocab.word,
                    translation: vocab.translation,
                    example: vocab.example,
                    pronunciation: vocab.pronunciation,
                    difficulty: updatedConversation.difficulty,
                    sourceConversationId: conversationId,
                  });
                } catch (vocabError) {
                  console.error('[BACKGROUND ENRICHMENT] Failed to save vocabulary:', vocabError);
                }
              }
            }

            // TODO: Generate TTS with word timings (requires Google Cloud beta API)
            // For now, enrichment focuses on vocabulary and media
            // Word timing support to be added in future iteration

            // Update message with enriched data
            await storage.updateMessage(aiMessage.id, {
              mediaJson: mediaJson || undefined,
              enrichmentStatus: null, // null = complete (enriched)
            });

            console.log('[BACKGROUND ENRICHMENT] Completed for message:', aiMessage.id);
          } catch (enrichError) {
            console.error('[BACKGROUND ENRICHMENT] Error:', enrichError);
            await storage.updateMessage(aiMessage.id, { enrichmentStatus: "failed" });
          }
        });

        // Exit early - response already sent
        return;
      }

      // TEXT MODE: Full structured response with vocabulary and images (existing behavior)
      console.log('[TEXT MODE] Using full structured response path (Gemini)');
      
      // Define JSON schema for structured output (Gemini format)
      const tutorResponseSchema = {
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
              required: ["word", "translation", "example", "pronunciation"]
            }
          },
          media: {
            type: "array",
            description: "Images to display with this message (0-2 images max)",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["stock", "ai_generated"] },
                query: { type: "string", nullable: true },
                prompt: { type: "string", nullable: true },
                alt: { type: "string" }
              },
              required: ["type", "alt"]
            }
          }
        },
        required: ["message", "vocabulary", "media"]
      };
      
      // Generate AI response with Gemini
      let parsedResponse: { message?: string; target?: string; native?: string; vocabulary?: any[]; media?: any[] } = {};
      let aiResponse = "I'm sorry, I couldn't generate a response.";

      try {
        parsedResponse = await callGeminiWithSchema(
          model,
          [
            { role: "system", content: systemPrompt },
            ...recentMessages.map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          ],
          tutorResponseSchema
        );
        
        // Handle both structured (target+native) and standard (message) formats
        if (parsedResponse.target !== undefined && parsedResponse.native !== undefined) {
          // Voice mode structured format (shouldn't happen in text mode, but handle gracefully)
          const target = parsedResponse.target || '';
          const native = parsedResponse.native || '';
          aiResponse = target && native ? `${target} (${native})` : (target || native);
          console.log('[TEXT MODE] Got structured format (unexpected), concatenated');
        } else if (parsedResponse.message) {
          aiResponse = parsedResponse.message;
        }
        
        console.log('[TEXT MODE] Parsed response:', {
          hasMessage: !!parsedResponse.message,
          hasStructured: !!(parsedResponse.target !== undefined || parsedResponse.native !== undefined),
          vocabularyCount: parsedResponse.vocabulary?.length || 0,
          mediaCount: parsedResponse.media?.length || 0
        });
      } catch (parseError) {
        // Fallback if generation fails
        console.error("[TEXT MODE] Failed to generate AI response:", parseError);
        aiResponse = "I'm sorry, I couldn't generate a response.";
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
                // Cache miss - generate with Gemini Flash-Image
                console.log('[CACHE MISS] Generating new AI image for prompt:', item.prompt.substring(0, 50) + '...');
                const enhancedPrompt = `${item.prompt}. Educational illustration style, clear and engaging, suitable for language learning.`;
                
                const imageUrl = await generateImageWithGemini(enhancedPrompt);
                
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
      let switchedConversation: any = null; // Initialize as null to prevent stale data reuse
      
      if (switchMatch) {
        const targetConversationId = switchMatch[1];
        console.log('[CONVERSATION SWITCH] Detected switch directive to:', targetConversationId);
        
        // Safety check: Prevent switching to the current conversation
        // This prevents infinite loops if the AI mistakenly emits a switch directive to itself
        if (targetConversationId === conversationId) {
          console.warn('[CONVERSATION SWITCH] Cannot switch to current conversation, ignoring directive');
          aiResponse = aiResponse.replace(switchDirectivePattern, '').trim();
          switchedConversation = null; // Ensure no stale data
        } else {
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
          
          // Generate context summary for the target conversation to help the student remember
          let contextSummary: string | null = null;
          try {
            const targetMessages = await storage.getMessagesByConversation(targetConversationId);
            if (targetMessages.length > 0) {
              contextSummary = await generateConversationContextSummary(
                targetMessages.map(m => ({ role: m.role, content: m.content })),
                targetConversation.title,
                targetConversation.language
              );
              console.log('[CONVERSATION SWITCH] Generated context summary:', contextSummary);
            }
          } catch (error) {
            console.error('[CONVERSATION SWITCH] Failed to generate context summary:', error);
            // Continue without summary - not critical
          }
          
            // Set the switched conversation for the response
            switchedConversation = {
              id: targetConversation.id,
              switchedFrom: conversationId,
              title: targetConversation.title,
              messageCount: targetConversation.messageCount,
              contextSummary: contextSummary
            };
          } else {
            console.warn('[CONVERSATION SWITCH] Invalid switch target - conversation not found or not accessible');
            // Strip the directive even if invalid, so it doesn't show to the user
            aiResponse = aiResponse.replace(switchDirectivePattern, '').trim();
            switchedConversation = null; // Ensure no stale data leaks through
          }
        }
      }

      // Save AI message with media
      const aiMessage = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
        mediaJson: mediaJson || undefined,
      });

      // Generate conversation title automatically after 5 messages (if no title exists)
      // This helps users find and resume conversations later
      // IMPORTANT: Fire-and-forget to avoid blocking the chat response
      // Note: This happens BEFORE res.json(), so title generation starts immediately,
      // but the HTTP response returns without waiting for completion.
      const refreshedConversation = await storage.getConversation(conversationId, userId);
      if (refreshedConversation && 
          !refreshedConversation.title && 
          refreshedConversation.messageCount === 5 && 
          !refreshedConversation.isOnboarding) {
        
        console.log('[TITLE GEN] Conversation reached 5 messages without a title, generating automatically (async)...');
        
        // Fire-and-forget: Don't await this, let it run in background
        // Background task completes independently after HTTP response is sent
        setImmediate(() => {
          (async () => {
            try {
              // Re-read conversation to check title hasn't been set by another request
              const latestConversation = await storage.getConversation(conversationId, userId);
              if (!latestConversation || latestConversation.title) {
                console.log('[TITLE GEN] Title already set or conversation not found, skipping');
                return;
              }
              
              // Get all messages for context
              const allMessages = await storage.getMessagesByConversation(conversationId);
              const generatedTitle = await generateConversationTitle(
                allMessages.map(m => ({ role: m.role, content: m.content })),
                latestConversation.language
              );
              
              if (generatedTitle) {
                console.log('[TITLE GEN] Auto-generated title:', generatedTitle);
                await storage.updateConversation(conversationId, userId, {
                  title: generatedTitle
                });
                console.log('[TITLE GEN] ✓ Title successfully saved');
              } else {
                console.log('[TITLE GEN] No title generated (low confidence or error)');
              }
            } catch (error) {
              console.error('[TITLE GEN] Background task failed (non-critical):', error);
              // Errors are logged but don't impact chat functionality
            }
          })().catch((error) => {
            // Double-safety: catch any unhandled promise rejections
            console.error('[TITLE GEN] Unhandled async error:', error);
          });
        });
      }

      // Save vocabulary items from conversation with source link
      const vocabulary = Array.isArray(parsedResponse.vocabulary) ? parsedResponse.vocabulary : [];
      console.log('[TEXT MODE] Processing vocabulary - count:', vocabulary.length);
      
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
            sourceConversationId: conversationId,
          });
          console.log('[TEXT MODE] ✓ Saved vocabulary:', vocab.word);
        } else {
          console.warn('[TEXT MODE] ⚠️ Skipping invalid vocabulary:', vocab);
        }
      }
      
      console.log('[TEXT MODE] Final message data:', {
        hasMediaJson: !!mediaJson,
        vocabularyProcessed: vocabulary.length
      });

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

  // ===== NEW REST-Based Voice API (Whisper + GPT + TTS) =====
  
  // Pre-warm Deepgram connection to avoid cold-start latency
  // Called when user enters voice chat mode
  app.post("/api/voice/warm", isAuthenticated, async (req: any, res) => {
    try {
      const warmStart = Date.now();
      
      // Create minimal silent WAV (44 bytes header + minimal samples)
      // This is the smallest valid audio that Deepgram will accept
      const silentWav = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x00, 0x00, 0x00, // File size (36 + 0 data)
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6D, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Subchunk size (16)
        0x01, 0x00,             // Audio format (1 = PCM)
        0x01, 0x00,             // Channels (1 = mono)
        0x80, 0x3E, 0x00, 0x00, // Sample rate (16000)
        0x00, 0x7D, 0x00, 0x00, // Byte rate (32000)
        0x02, 0x00,             // Block align (2)
        0x10, 0x00,             // Bits per sample (16)
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x00, 0x00, 0x00, // Data size (0)
      ]);
      
      // Make a quick Deepgram API call to warm the connection
      await deepgram.listen.prerecorded.transcribeFile(silentWav, {
        model: "nova-2",
        language: "en",
      });
      
      const warmTime = Date.now() - warmStart;
      console.log(`[DEEPGRAM] ✓ Connection warmed in ${warmTime}ms`);
      
      res.json({ warmed: true, latency: warmTime });
    } catch (error: any) {
      // Don't fail - warming is optional optimization
      console.log(`[DEEPGRAM] Warm-up skipped: ${error.message?.substring(0, 50)}`);
      res.json({ warmed: false, error: "warm-up skipped" });
    }
  });
  
  // Pre-warm TTS connection - now just a no-op since greeting synthesis
  // happens immediately and serves as the warm-up
  // Keeping endpoint for backward compatibility but not doing actual synthesis
  app.post("/api/voice/warm-tts", isAuthenticated, async (req: any, res) => {
    // No longer synthesizing here - the greeting TTS serves as warm-up
    // This avoids unnecessary API calls and potential voice mismatch issues
    console.log(`[TTS] Warm-up skipped (greeting serves as warm-up)`);
    res.json({ warmed: true, latency: 0 });
  });
  
  // Transcribe audio using Whisper API
  app.post("/api/voice/transcribe", voiceLimiter, isAuthenticated, upload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const userId = req.user.claims.sub;
      
      // CRITICAL: Check voice usage limits BEFORE transcription (don't increment yet)
      const usageCheck = await storage.checkVoiceUsage(userId);
      if (!usageCheck.allowed) {
        return res.status(403).json({
          error: "Monthly voice message limit reached. Upgrade to continue using voice chat.",
          limit: usageCheck.limit,
          remaining: usageCheck.remaining,
        });
      }
      
      console.log(`[DEEPGRAM] Transcribing audio for user ${userId}, size: ${req.file.size} bytes`);

      // Use Deepgram Nova-3 for better accuracy on non-native pronunciation
      // Auto-detect language (like Whisper) - supports all languages
      console.log(`[DEEPGRAM] Using Nova-3 with auto-detect mode (requested: ${req.body.language})`);

      // Call Deepgram Nova-3 API (54% better WER than Whisper)
      // PERFORMANCE CRITICAL: Disabled heavy post-processing options to reduce latency
      // - diarize: false (was causing 10+ second delays)
      // - utterances: false (multi-pass alignment not needed)
      // Word-level timestamps are included by default without these options
      const transcribeStart = Date.now();
      const { result } = await deepgram.listen.prerecorded.transcribeFile(
        req.file.buffer,
        {
          model: "nova-2", // Use nova-2 for faster processing (nova-3 has more post-processing)
          language: "multi", // Auto-detect (supports English, Spanish, French, etc.)
          smart_format: true, // Better formatting
          punctuate: true, // Add punctuation
          // DISABLED for speed: diarize, utterances cause 10+ second latency
        }
      );
      const transcribeTime = Date.now() - transcribeStart;
      console.log(`[DEEPGRAM] Transcription completed in ${transcribeTime}ms`);

      if (!result) {
        throw new Error("Deepgram returned null result");
      }

      const alternative = result.results.channels[0].alternatives[0];
      const text = alternative.transcript || "";
      
      // Extract word-level data for pronunciation analysis
      const words = alternative.words || [];
      const wordTimings = words.map((w: any) => ({
        word: w.word || "",
        start: w.start || 0,
        end: w.end || 0,
        confidence: w.confidence || 0
      }));

      console.log(`[DEEPGRAM] ✓ Transcription: "${text}" (${words.length} words, avg confidence: ${
        words.length > 0 ? (words.reduce((sum: number, w: any) => sum + (w.confidence || 0), 0) / words.length * 100).toFixed(1) : 0
      }%)`);
      
      // Get user's difficulty level for unit validation (optional query param)
      const userLanguage = req.body.language || 'spanish';
      const difficulty = req.body.difficulty || 'beginner';
      
      // Validate one-unit rule for beginners (flexible with phrase units)
      const unitValidation = validateOneUnitRule(text, userLanguage, difficulty);
      const conceptualUnits = countConceptualUnits(text, userLanguage);
      
      const transcription = {
        text,
        words: wordTimings,
        wordCount: words.length,
        conceptualUnits,
        avgConfidence: words.length > 0 
          ? words.reduce((sum: number, w: any) => sum + (w.confidence || 0), 0) / words.length
          : 0,
        unitValidation: {
          isValid: unitValidation.isValid,
          message: unitValidation.message,
          matchedPhrase: unitValidation.matchedPhrase,
        }
      };
      
      // Only increment usage AFTER successful transcription
      // Uses conditional UPDATE to prevent race conditions
      try {
        await storage.incrementVoiceUsage(userId);
      } catch (usageError: any) {
        // Race condition: quota was exhausted between check and increment
        if (usageError.message?.includes('limit exceeded')) {
          // Re-fetch usage stats to provide accurate limit/remaining info
          const stats = await storage.getUserUsageStats(userId);
          return res.status(403).json({
            error: "Monthly voice message limit reached. Upgrade to continue using voice chat.",
            limit: stats.monthlyMessageLimit,
            remaining: stats.remaining,
          });
        }
        throw usageError; // Re-throw if it's not a quota error
      }
      
      res.json(transcription);
    } catch (error: any) {
      console.error("[WHISPER] Transcription failed:", error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });

  // Synthesize speech using TTS API
  // Now uses Google Cloud WaveNet for authentic native pronunciation (with OpenAI fallback)
  // Returns both audio and word-level timing data for synchronized subtitles
  app.post("/api/voice/synthesize", voiceLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const { text, voice, language, targetLanguage, returnTimings, emotion, preview } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const userId = req.user.claims.sub;
      
      // Get user's tutor gender preference for voice selection
      const user = await storage.getUser(userId);
      const tutorGender = user?.tutorGender || 'female';
      const userRole = user?.role || 'student';
      
      // Import emotion utilities
      const { getDefaultEmotion, getAllowedEmotions } = await import('./services/tts-service');
      
      // Check if this is an admin preview request (admin/developer only)
      const isAdminPreview = preview && (userRole === 'admin' || userRole === 'developer');
      
      // Use preview overrides for admin audition, otherwise use user preferences
      let tutorPersonality: 'warm' | 'calm' | 'energetic' | 'professional';
      let tutorExpressiveness: number;
      let effectiveEmotion: string;
      
      if (isAdminPreview) {
        // Admin preview mode: use provided preview settings
        tutorPersonality = preview.personality || 'warm';
        tutorExpressiveness = Math.max(1, Math.min(5, preview.expressiveness ?? 3));
        
        // Get allowed emotions for preview settings
        const allowedEmotions = getAllowedEmotions(tutorPersonality, tutorExpressiveness);
        const defaultEmotion = getDefaultEmotion(tutorPersonality);
        
        // Use preview emotion if provided and allowed
        if (preview.emotion && allowedEmotions.includes(preview.emotion)) {
          effectiveEmotion = preview.emotion;
        } else {
          effectiveEmotion = defaultEmotion;
        }
        
        console.log(`[TTS] Admin preview mode: personality=${tutorPersonality}, expressiveness=${tutorExpressiveness}, emotion=${effectiveEmotion}`);
      } else {
        // Normal mode: use user preferences
        tutorPersonality = (user?.tutorPersonality as 'warm' | 'calm' | 'energetic' | 'professional') || 'warm';
        tutorExpressiveness = Math.max(1, Math.min(5, user?.tutorExpressiveness ?? 3));
        
        // Enforce allowed emotions based on personality and expressiveness level
        const allowedEmotions = getAllowedEmotions(tutorPersonality, tutorExpressiveness);
        const defaultEmotion = getDefaultEmotion(tutorPersonality);
        
        // Use AI emotion if provided and allowed, otherwise fall back to default
        if (emotion && allowedEmotions.includes(emotion)) {
          effectiveEmotion = emotion;
        } else if (emotion) {
          console.log(`[TTS] AI emotion '${emotion}' not allowed at expressiveness ${tutorExpressiveness}, using default '${defaultEmotion}'`);
          effectiveEmotion = defaultEmotion;
        } else {
          effectiveEmotion = defaultEmotion;
        }
      }
      
      // Try to get admin-configured voice from database for this language and gender
      let voiceId: string | undefined;
      let configuredSpeakingRate = 0.9; // Default natural speed
      const effectiveLanguage = language || targetLanguage || user?.targetLanguage || 'spanish';
      
      try {
        const tutorVoices = await storage.getAllTutorVoices();
        const matchingVoice = tutorVoices.find(
          v => v.language.toLowerCase() === effectiveLanguage.toLowerCase() && 
               v.gender === tutorGender &&
               v.isActive
        );
        if (matchingVoice?.voiceId) {
          voiceId = matchingVoice.voiceId;
          configuredSpeakingRate = matchingVoice.speakingRate || 0.9;
          console.log(`[TTS] Using admin-configured ${tutorGender} voice for ${effectiveLanguage}: ${matchingVoice.voiceName} (speed: ${configuredSpeakingRate})`);
        } else {
          console.log(`[TTS] No matching voice found for ${effectiveLanguage}/${tutorGender}, using default`);
        }
      } catch (err: any) {
        // If database error, fall back to default
        console.error(`[TTS] Error fetching tutor voices:`, err.message);
        console.log(`[TTS] Using default voice for ${effectiveLanguage}`);
      }
      
      // Strip markdown formatting before TTS (removes **, *, parentheses, etc.)
      const cleanText = stripMarkdownForSpeech(text);
      console.log(`[TTS] Synthesizing speech for user ${userId}, original: ${text.length} chars, cleaned: ${cleanText.length} chars, language: ${effectiveLanguage}, gender: ${tutorGender}`);

      // Use TTS service abstraction (Cartesia Sonic-3 primary, Google fallback)
      // Use admin-configured speaking rate, or default to 0.9 (natural conversational speed)
      const ttsService = getTTSService();
      const result = await ttsService.synthesize({
        text: cleanText,
        language: effectiveLanguage,
        voice,
        voiceId, // Pass admin-configured voice ID if available
        targetLanguage, // Pass target language for SSML phoneme tag processing
        returnTimings, // Request word-level timing data for subtitle sync
        speakingRate: configuredSpeakingRate, // Use admin-configured speed
        emotion: effectiveEmotion, // Dynamic emotion from AI or personality default
      });
      
      console.log(`[TTS] Using emotion: ${effectiveEmotion} (from: ${emotion ? 'AI response' : 'personality default'})`);


      console.log(`[TTS] ✓ Generated ${result.audioBuffer.length} bytes using ${ttsService.getProvider()} provider`);

      // If client requested word timings, return JSON with audio + timings
      if (returnTimings && result.wordTimings) {
        return res.json({
          audio: result.audioBuffer.toString('base64'),
          wordTimings: result.wordTimings,
          contentType: result.contentType,
        });
      }

      // Default: Send audio only (backward compatible)
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Length', result.audioBuffer.length.toString());
      res.send(result.audioBuffer);
    } catch (error: any) {
      console.error("[TTS] Synthesis failed:", error);
      res.status(500).json({ error: error.message || "Failed to synthesize speech" });
    }
  });

  // Slow repeat: Get simplified version of last teaching and speak it slowly
  // Used when student needs more help understanding a phrase
  app.post("/api/voice/slow-repeat", voiceLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.body;
      const userId = req.user.claims.sub;
      
      if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
      }

      // Get the conversation to check ownership and get language
      const conversation = await storage.getConversation(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Get the last assistant message
      const messages = await storage.getMessagesByConversation(conversationId);
      const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
      
      if (!lastAssistantMessage?.content) {
        return res.status(400).json({ error: "No assistant message to repeat" });
      }

      console.log(`[SLOW REPEAT] Original message: ${lastAssistantMessage.content.substring(0, 100)}...`);

      // Ask AI to simplify the last teaching
      const targetLanguage = conversation.language || 'spanish';
      const nativeLanguage = conversation.nativeLanguage || 'english';
      
      // Extract JUST the target language phrase - no explanations, no pronunciation guides
      // The slow speed will help the student hear it clearly
      const simplifyPrompt = `Extract ONLY the ${targetLanguage} word or phrase from this message. Return JUST the ${targetLanguage} words - nothing else. No English, no labels, no pronunciation guide, no explanation.

Message: "${lastAssistantMessage.content}"

Examples of correct output:
- "Buenas tardes"
- "Hola"  
- "Buenos días"

Return ONLY the ${targetLanguage} phrase:`;

      // Generate simplified response using Gemini
      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: simplifyPrompt,
      });
      
      const simplifiedText = response.text?.trim() || lastAssistantMessage.content;
      
      console.log(`[SLOW REPEAT] Simplified to: ${simplifiedText}`);

      // Get user's tutor gender preference for voice selection
      const user = await storage.getUser(userId);
      const tutorGender = user?.tutorGender || 'female';
      
      // Try to get admin-configured voice from database
      let voiceId: string | undefined;
      try {
        const tutorVoices = await storage.getAllTutorVoices();
        const matchingVoice = tutorVoices.find(
          v => v.language.toLowerCase() === targetLanguage.toLowerCase() && 
               v.gender === tutorGender &&
               v.isActive
        );
        if (matchingVoice?.voiceId) {
          voiceId = matchingVoice.voiceId;
          console.log(`[SLOW REPEAT] Using ${tutorGender} voice: ${matchingVoice.voiceName}`);
        }
      } catch (err: any) {
        console.log(`[SLOW REPEAT] Using default voice for ${targetLanguage}`);
      }

      // Strip markdown and synthesize at MUCH slower speed for clear pronunciation
      const cleanText = stripMarkdownForSpeech(simplifiedText);
      const ttsService = getTTSService();
      const slowSpeed = 0.5; // Actually slow! Normal is 0.7
      const result = await ttsService.synthesize({
        text: cleanText,
        language: targetLanguage,
        voiceId, // Pass admin-configured voice ID
        targetLanguage: targetLanguage,
        speakingRate: slowSpeed, // Much slower for clear pronunciation
      });

      console.log(`[SLOW REPEAT] ✓ Generated ${result.audioBuffer.length} bytes at ${slowSpeed}x speed`);

      // Return JSON with audio and the simplified text
      res.json({
        audio: result.audioBuffer.toString('base64'),
        contentType: result.contentType,
        simplifiedText,
      });
    } catch (error: any) {
      console.error("[SLOW REPEAT] Failed:", error);
      res.status(500).json({ error: error.message || "Failed to generate slow repeat" });
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

  // ===== Organization System APIs (Phases 1, 2, 3) =====

  // Phase 1: Toggle conversation star
  app.patch("/api/conversations/:id/star", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.toggleConversationStar(req.params.id, userId);
      if (!updated) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 1: Get filtered vocabulary
  app.get("/api/vocabulary/filtered", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language, timeFilter, topicId, sourceConversationId } = req.query;
      
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }
      
      const vocabulary = await storage.getFilteredVocabulary(userId, language as string, {
        timeFilter: timeFilter as 'today' | 'week' | 'month' | 'older' | undefined,
        topicId: topicId as string | undefined,
        sourceConversationId: sourceConversationId as string | undefined
      });
      
      res.json(vocabulary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 2: Get topics for a conversation
  app.get("/api/conversations/:id/topics", isAuthenticated, async (req: any, res) => {
    try {
      const topics = await storage.getConversationTopics(req.params.id);
      res.json(topics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 2: Add topic to conversation
  app.post("/api/conversations/:id/topics", isAuthenticated, async (req: any, res) => {
    try {
      const { topicId, confidence } = req.body;
      if (!topicId) {
        return res.status(400).json({ error: "topicId is required" });
      }
      const created = await storage.addConversationTopic(req.params.id, topicId, confidence);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 2: Remove topic from conversation
  app.delete("/api/conversations/:conversationId/topics/:topicId", isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeConversationTopic(req.params.conversationId, req.params.topicId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Review Hub: Unified learning dashboard data
  app.get("/api/review-hub", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language, context } = req.query;
      
      if (!language) {
        return res.status(400).json({ error: "language query parameter is required" });
      }
      
      // context can be: "all", "all-learning", "self-directed", or a classId
      // "all-learning" means combine self-directed AND all classes (no filtering)
      const isAllLearning = context === "all-learning" || context === "all";
      const classId = context && !isAllLearning && context !== "self-directed" 
        ? context as string 
        : undefined;
      const selfDirectedOnly = context === "self-directed";
      
      // Handle "all" language by returning aggregate data
      const languageValue = language === "all" ? undefined : language as string;
      
      const data = await storage.getReviewHubData(userId, languageValue, classId, selfDirectedOnly);
      res.json(data);
    } catch (error: any) {
      console.error("[Review Hub] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 3: User Lessons CRUD
  app.get("/api/lessons", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language } = req.query;
      const lessons = await storage.getUserLessons(userId, language as string | undefined);
      res.json(lessons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/lessons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lesson = await storage.getUserLesson(req.params.id, userId);
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      res.json(lesson);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/lessons", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lesson = await storage.createUserLesson({ ...req.body, userId });
      res.status(201).json(lesson);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/lessons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateUserLesson(req.params.id, userId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/lessons/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteUserLesson(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 3: Lesson items
  app.get("/api/lessons/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      const items = await storage.getLessonItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/lessons/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      const item = await storage.addLessonItem({ ...req.body, lessonId: req.params.id });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/lessons/:lessonId/items/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeLessonItem(req.params.itemId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 3: Auto-generate weekly lesson
  app.post("/api/lessons/generate-weekly", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language, weekStart } = req.body;
      
      if (!language || !weekStart) {
        return res.status(400).json({ error: "language and weekStart are required" });
      }
      
      const lesson = await storage.generateWeeklyLesson(userId, language, new Date(weekStart));
      if (!lesson) {
        return res.status(404).json({ message: "No content found for this week" });
      }
      res.status(201).json(lesson);
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

  // Grammar Competencies (ACTFL-aligned grammar topics)
  app.get("/api/grammar/competencies", async (req, res) => {
    try {
      const { language } = req.query;
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }
      const competencies = await storage.getGrammarCompetencies(language as string);
      res.json(competencies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Grammar Exercises by Competency
  app.get("/api/grammar/exercises", async (req, res) => {
    try {
      const { language, competencyId } = req.query;
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }
      const exercises = await storage.getGrammarExercisesByCompetency(
        language as string,
        competencyId as string | undefined
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

  // ACTFL Progress (FACT criteria tracking)
  app.get("/api/actfl-progress/:language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language } = req.params;
      
      // Handle "all" language - return null (no aggregate ACTFL progress makes sense)
      if (language === "all") {
        return res.json(null);
      }
      
      const progress = await storage.getOrCreateActflProgress(language, userId);
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

  // Multimedia - Generate AI image with Gemini Flash-Image
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

      // Generate image with Gemini Flash-Image
      const imageUrl = await generateImageWithGemini(enhancedPrompt);
      
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

  // ACTFL Can-Do Statements API
  // Get Can-Do statements for a specific language and proficiency level
  // Accepts external format (Title Case: "Novice Low") and returns external format
  // Query params: language (required), level (optional), category (optional: interpersonal, interpretive, presentational)
  app.get("/api/actfl/can-do-statements", isAuthenticated, async (req: any, res) => {
    try {
      const { language, level, category } = req.query;
      
      if (!language) {
        return res.status(400).json({ error: "Language parameter is required" });
      }

      const normalizedLanguage = language.toLowerCase().trim();
      
      // If category filter is provided, validate it
      if (category && !['interpersonal', 'interpretive', 'presentational'].includes(category)) {
        return res.status(400).json({ 
          error: "Invalid category. Must be one of: interpersonal, interpretive, presentational" 
        });
      }
      
      // Convert external format to internal format if provided
      const internalLevel = level ? toInternalActflLevel(level as string) : undefined;
      const categoryFilter = category && typeof category === 'string' ? category : undefined;
      
      // Fetch from database with optional filters
      const statements = await storage.getCanDoStatements(
        normalizedLanguage,
        internalLevel || undefined,
        categoryFilter
      );

      // Convert internal format back to external format for API response
      const externalStatements = statements.map(stmt => ({
        ...stmt,
        actflLevel: toExternalActflLevel(stmt.actflLevel) || stmt.actflLevel
      }));

      res.json({
        language: normalizedLanguage,
        level: level || 'all',
        category: category || 'all',
        statements: externalStatements,
        count: externalStatements.length
      });
    } catch (error: any) {
      console.error('Error fetching Can-Do statements:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get available ACTFL levels for a language (returns external Title Case format)
  app.get("/api/actfl/levels/:language", isAuthenticated, async (req: any, res) => {
    try {
      const { language } = req.params;
      const internalLevels = getAvailableActflLevels(language.toLowerCase().trim());
      
      // Convert internal format to external format for API response
      const externalLevels = internalLevels.map(level => toExternalActflLevel(level) || level);
      
      res.json({
        language: language.toLowerCase().trim(),
        levels: externalLevels
      });
    } catch (error: any) {
      console.error('Error fetching ACTFL levels:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all supported languages for Can-Do statements
  app.get("/api/actfl/languages", isAuthenticated, async (req: any, res) => {
    try {
      const languages = getSupportedLanguages();
      res.json({
        languages,
        count: languages.length
      });
    } catch (error: any) {
      console.error('Error fetching supported languages:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Can-Do statement statistics (coverage across languages and levels)
  app.get("/api/actfl/stats", isAuthenticated, async (req: any, res) => {
    try {
      const stats = getCanDoStatementStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching Can-Do statement stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's Can-Do progress
  app.get("/api/actfl/progress", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const progress = await storage.getUserCanDoProgress(userId);
      res.json(progress);
    } catch (error: any) {
      console.error('Error fetching Can-Do progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle Can-Do progress (check/uncheck a statement)
  app.post("/api/actfl/progress/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { statementId } = req.body;
      
      if (!statementId) {
        return res.status(400).json({ error: "Statement ID is required" });
      }

      const result = await storage.toggleCanDoProgress(userId, statementId);
      res.json({
        success: true,
        achieved: result !== null,
        progress: result
      });
    } catch (error: any) {
      console.error('Error toggling Can-Do progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== INSTITUTIONAL FEATURES ==========

  // ===== Teacher Classes =====
  
  // Create a new class (teachers only)
  app.post("/api/teacher/classes", mutationLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const user = await storage.getUser(teacherId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Only teachers can create classes" });
      }

      const { name, description, language, curriculumPathId } = req.body;
      
      if (!name || !language) {
        return res.status(400).json({ error: "Name and language are required" });
      }

      // Generate 6-digit join code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const teacherClass = await storage.createTeacherClass({
        teacherId,
        name,
        description,
        language,
        curriculumPathId,
        joinCode,
      });

      res.json(teacherClass);
    } catch (error: any) {
      console.error('Error creating teacher class:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all classes for a teacher (teachers only)
  app.get("/api/teacher/classes", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const user = await storage.getUser(teacherId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Only teachers can access this endpoint" });
      }
      
      const classes = await storage.getTeacherClasses(teacherId);
      res.json(classes);
    } catch (error: any) {
      console.error('Error fetching teacher classes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific class
  app.get("/api/teacher/classes/:classId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { classId } = req.params;
      const teacherClass = await storage.getTeacherClass(classId);
      
      if (!teacherClass) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Verify user is either the teacher who owns this class OR a student enrolled in it
      const isTeacher = teacherClass.teacherId === userId;
      const isEnrolled = await storage.isStudentEnrolled(classId, userId);
      
      if (!isTeacher && !isEnrolled) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Students should not see join code (prevent external sharing)
      if (!isTeacher) {
        const { joinCode, ...classWithoutJoinCode } = teacherClass;
        return res.json(classWithoutJoinCode);
      }

      res.json(teacherClass);
    } catch (error: any) {
      console.error('Error fetching teacher class:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a class
  app.patch("/api/teacher/classes/:classId", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId } = req.params;
      const teacherClass = await storage.getTeacherClass(classId);
      
      if (!teacherClass || teacherClass.teacherId !== teacherId) {
        return res.status(404).json({ error: "Class not found" });
      }

      const updated = await storage.updateTeacherClass(classId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating teacher class:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a class
  app.delete("/api/teacher/classes/:classId", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId } = req.params;
      const teacherClass = await storage.getTeacherClass(classId);
      
      if (!teacherClass || teacherClass.teacherId !== teacherId) {
        return res.status(404).json({ error: "Class not found" });
      }

      await storage.deleteTeacherClass(classId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting teacher class:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Class Enrollments =====
  
  // Join a class with join code (students)
  app.post("/api/student/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { joinCode } = req.body;
      
      if (!joinCode) {
        return res.status(400).json({ error: "Join code is required" });
      }

      const teacherClass = await storage.getClassByJoinCode(joinCode);
      
      if (!teacherClass) {
        return res.status(404).json({ error: "Invalid join code" });
      }

      if (!teacherClass.isActive) {
        return res.status(400).json({ error: "This class is no longer active" });
      }

      // Check if already enrolled
      const isEnrolled = await storage.isStudentEnrolled(teacherClass.id, studentId);
      if (isEnrolled) {
        return res.status(400).json({ error: "Already enrolled in this class" });
      }

      const enrollment = await storage.enrollStudent(teacherClass.id, studentId);
      
      // Auto-allocate tutoring hours based on class package configuration
      let hoursAllocated = 0;
      try {
        const allocationDetails = await usageService.getClassAllocationDetails(teacherClass.id);
        
        if (allocationDetails.canAllocate && allocationDetails.hoursPerStudent > 0) {
          await usageService.allocateClassHours(
            studentId, 
            teacherClass.id, 
            allocationDetails.hoursPerStudent,
            allocationDetails.packageId || undefined,
            allocationDetails.expiresAt || undefined
          );
          hoursAllocated = allocationDetails.hoursPerStudent;
          console.log(`[Enrollment] Allocated ${hoursAllocated} hours to student ${studentId} for class ${teacherClass.id} (package: ${allocationDetails.packageId || 'none'})`);
        } else if (!allocationDetails.canAllocate) {
          console.log(`[Enrollment] Cannot allocate hours - package exhausted or expired for class ${teacherClass.id}`);
        }
      } catch (allocationError) {
        console.error('[Enrollment] Error allocating hours:', allocationError);
        // Don't fail enrollment if hour allocation fails - they can still access the class
      }
      
      res.json({ enrollment, class: teacherClass, hoursAllocated });
    } catch (error: any) {
      console.error('Error enrolling student:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get class roster (teacher view)
  app.get("/api/teacher/classes/:classId/students", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId } = req.params;
      const teacherClass = await storage.getTeacherClass(classId);
      
      if (!teacherClass || teacherClass.teacherId !== teacherId) {
        return res.status(404).json({ error: "Class not found" });
      }

      const enrollments = await storage.getClassEnrollments(classId);
      res.json(enrollments);
    } catch (error: any) {
      console.error('Error fetching class roster:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get student's enrolled classes
  app.get("/api/student/classes", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const enrollments = await storage.getStudentEnrollments(studentId);
      res.json(enrollments);
    } catch (error: any) {
      console.error('Error fetching student classes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Browse class catalogue - returns ONLY public classes marked with isPublicCatalogue=true
  // SECURITY: Only returns public metadata (id, name, description, language) - NO join codes
  // SECURITY: Only classes explicitly marked as public are visible - prevents institutional class leakage
  app.get("/api/classes/catalogue", isAuthenticated, async (req: any, res) => {
    try {
      const { search, language } = req.query;
      const studentId = req.user.claims.sub;
      
      // Get all active classes
      const allClasses = await storage.getAllActiveClasses();
      
      // Get student's current enrollments to flag already-enrolled classes
      const enrollments = await storage.getStudentEnrollments(studentId);
      const enrolledClassIds = new Set(enrollments.map(e => e.classId));
      
      // SECURITY: Only show classes explicitly marked as public catalogue
      let filteredClasses = allClasses.filter(cls => {
        // CRITICAL: Must be explicitly marked as public catalogue
        if (!cls.isPublicCatalogue) return false;
        // Must be active
        if (!cls.isActive) return false;
        return true;
      });
      
      // Apply search filter if provided
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredClasses = filteredClasses.filter(cls => 
          cls.name.toLowerCase().includes(searchLower) ||
          (cls.description && cls.description.toLowerCase().includes(searchLower)) ||
          cls.language.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply language filter if provided
      if (language && typeof language === 'string' && language !== 'all') {
        filteredClasses = filteredClasses.filter(cls => 
          cls.language.toLowerCase() === language.toLowerCase()
        );
      }
      
      // SECURITY: Return only public metadata - strip sensitive fields like joinCode
      // Include isEnrolled flag to show which classes user is already in
      const sanitizedClasses = filteredClasses.map(cls => ({
        id: cls.id,
        name: cls.name,
        description: cls.description,
        language: cls.language,
        isActive: cls.isActive,
        isEnrolled: enrolledClassIds.has(cls.id),
      }));
      
      // Sort: unenrolled classes first, then enrolled classes
      sanitizedClasses.sort((a, b) => {
        if (a.isEnrolled !== b.isEnrolled) {
          return a.isEnrolled ? 1 : -1; // Unenrolled first
        }
        // Then by language and name
        const langCompare = a.language.localeCompare(b.language);
        if (langCompare !== 0) return langCompare;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      
      res.json(sanitizedClasses);
    } catch (error: any) {
      console.error('Error fetching class catalogue:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Self-enroll in a catalogue class by ID (for public classes only)
  // SECURITY: Only allows enrollment in classes marked with isPublicCatalogue=true
  app.post("/api/classes/catalogue/:classId/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { classId } = req.params;
      
      // Get the class
      const cls = await storage.getTeacherClass(classId);
      if (!cls || !cls.isActive) {
        return res.status(404).json({ error: "Class not found" });
      }
      
      // SECURITY: Only allow self-enrollment in public catalogue classes
      if (!cls.isPublicCatalogue) {
        return res.status(403).json({ error: "This class requires a join code from your teacher" });
      }
      
      // Check if already enrolled
      const existingEnrollments = await storage.getStudentEnrollments(studentId);
      if (existingEnrollments.some(e => e.classId === classId)) {
        return res.status(400).json({ error: "You are already enrolled in this class" });
      }
      
      // Create enrollment with default allocation
      const enrollment = await storage.createClassEnrollment({
        classId,
        studentId,
        isActive: true,
        allocatedSeconds: 432000, // 120 hours default
        usedSeconds: 0,
        paceStatus: 'on_track',
      });
      
      res.json({ 
        success: true, 
        enrollment,
        class: {
          id: cls.id,
          name: cls.name,
          language: cls.language,
          description: cls.description,
        }
      });
    } catch (error: any) {
      console.error('Error enrolling in catalogue class:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove student from class
  app.delete("/api/teacher/classes/:classId/students/:studentId", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId, studentId } = req.params;
      const teacherClass = await storage.getTeacherClass(classId);
      
      if (!teacherClass || teacherClass.teacherId !== teacherId) {
        return res.status(404).json({ error: "Class not found" });
      }

      await storage.unenrollStudent(classId, studentId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing student from class:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Class Usage Reporting =====
  
  // Get class usage report (teachers only)
  app.get("/api/teacher/classes/:classId/usage", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId } = req.params;
      const user = await storage.getUser(teacherId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Teacher access required" });
      }
      
      // Verify teacher owns this class (or is admin)
      const teacherClass = await storage.getTeacherClass(classId);
      if (!teacherClass) {
        return res.status(404).json({ error: "Class not found" });
      }
      
      if (user?.role !== 'admin' && teacherClass.teacherId !== teacherId) {
        return res.status(403).json({ error: "Not authorized for this class" });
      }
      
      const report = await usageService.getClassUsageReport(classId);
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching class usage report:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Reset class usage (admin only - for testing purposes)
  app.post("/api/admin/classes/:classId/reset-usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { classId } = req.params;
      const { resetAllStudents, studentId, hoursToAllocate } = req.body;
      
      const user = await storage.getUser(userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const result = await usageService.resetClassUsage(classId, {
        resetAllStudents,
        studentId,
        hoursToAllocate: hoursToAllocate || 120, // Default 120 hours
      });
      
      res.json({
        success: true,
        ...result,
        message: `Reset ${result.studentsReset} student(s) with ${result.hoursAllocated} hours each`,
      });
    } catch (error: any) {
      console.error('Error resetting class usage:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Curriculum Paths =====
  
  // Get all curriculum paths
  app.get("/api/curriculum/paths", isAuthenticated, async (req: any, res) => {
    try {
      const { language } = req.query;
      const paths = await storage.getCurriculumPaths(language as string | undefined);
      res.json(paths);
    } catch (error: any) {
      console.error('Error fetching curriculum paths:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific curriculum path
  app.get("/api/curriculum/paths/:pathId", isAuthenticated, async (req: any, res) => {
    try {
      const { pathId } = req.params;
      const path = await storage.getCurriculumPath(pathId);
      
      if (!path) {
        return res.status(404).json({ error: "Curriculum path not found" });
      }

      res.json(path);
    } catch (error: any) {
      console.error('Error fetching curriculum path:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create curriculum path (teachers/admins only)
  app.post("/api/curriculum/paths", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Only teachers can create curriculum paths" });
      }

      const path = await storage.createCurriculumPath({
        ...req.body,
        createdBy: userId,
      });

      res.json(path);
    } catch (error: any) {
      console.error('Error creating curriculum path:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get units for a curriculum path
  app.get("/api/curriculum/paths/:pathId/units", isAuthenticated, async (req: any, res) => {
    try {
      const { pathId } = req.params;
      const units = await storage.getCurriculumUnits(pathId);
      res.json(units);
    } catch (error: any) {
      console.error('Error fetching curriculum units:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create curriculum unit
  app.post("/api/curriculum/units", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Only teachers can create curriculum units" });
      }

      const unit = await storage.createCurriculumUnit(req.body);
      res.json(unit);
    } catch (error: any) {
      console.error('Error creating curriculum unit:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get lessons for a unit
  app.get("/api/curriculum/units/:unitId/lessons", isAuthenticated, async (req: any, res) => {
    try {
      const { unitId } = req.params;
      const lessons = await storage.getCurriculumLessons(unitId);
      res.json(lessons);
    } catch (error: any) {
      console.error('Error fetching curriculum lessons:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create curriculum lesson
  app.post("/api/curriculum/lessons", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Only teachers can create curriculum lessons" });
      }

      const lesson = await storage.createCurriculumLesson(req.body);
      res.json(lesson);
    } catch (error: any) {
      console.error('Error creating curriculum lesson:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Syllabus Progress & Competency =====

  // Check lesson competency for a student
  app.get("/api/competency/check/:classId/:lessonId", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { classId, lessonId } = req.params;
      
      // Import dynamically to avoid circular dependencies
      const { checkLessonCompetency } = await import('./services/competency-verifier');
      const result = await checkLessonCompetency(studentId, classId, lessonId);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error checking competency:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check upcoming lessons for early completion
  app.get("/api/competency/upcoming/:classId", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { classId } = req.params;
      
      const { checkUpcomingLessonsForEarlyCompletion } = await import('./services/competency-verifier');
      const results = await checkUpcomingLessonsForEarlyCompletion(studentId, classId);
      
      res.json(results);
    } catch (error: any) {
      console.error('Error checking upcoming lessons:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark lesson as organically completed
  app.post("/api/competency/complete-early", mutationLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { classId, lessonId, tutorVerified } = req.body;
      
      const { checkLessonCompetency, markLessonAsOrganicallyCompleted } = await import('./services/competency-verifier');
      const competencyResult = await checkLessonCompetency(studentId, classId, lessonId);
      
      if (competencyResult.recommendation !== 'complete_early') {
        return res.status(400).json({ 
          error: "Lesson does not meet early completion requirements",
          competency: competencyResult
        });
      }
      
      const success = await markLessonAsOrganicallyCompleted(
        studentId, 
        classId, 
        lessonId, 
        competencyResult,
        tutorVerified || false
      );
      
      res.json({ 
        success, 
        competency: competencyResult,
        message: success ? "Lesson marked as completed early!" : "Failed to mark lesson complete"
      });
    } catch (error: any) {
      console.error('Error marking lesson complete:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get syllabus progress for a student in a class
  app.get("/api/syllabus-progress/:classId", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { classId } = req.params;
      
      const progress = await storage.getSyllabusProgress(studentId, classId);
      res.json(progress);
    } catch (error: any) {
      console.error('Error fetching syllabus progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get early completions for a class (teachers only)
  app.get("/api/teacher/classes/:classId/early-completions", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId } = req.params;
      const teacherClass = await storage.getTeacherClass(classId);
      
      if (!teacherClass || teacherClass.teacherId !== teacherId) {
        return res.status(404).json({ error: "Class not found" });
      }

      const earlyCompletions = await storage.getEarlyCompletions(classId);
      res.json(earlyCompletions);
    } catch (error: any) {
      console.error('Error fetching early completions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Assignments =====
  
  // Create assignment (teachers only)
  app.post("/api/assignments", mutationLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const user = await storage.getUser(teacherId);
      
      if (!hasTeacherAccess(user?.role)) {
        return res.status(403).json({ error: "Only teachers can create assignments" });
      }

      // Parse and validate dueDate if provided
      let dueDate: Date | undefined = undefined;
      if (req.body.dueDate) {
        const parsedDate = new Date(req.body.dueDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid due date format" });
        }
        dueDate = parsedDate;
      }

      const assignmentData = {
        ...req.body,
        teacherId,
        dueDate,
      };

      const assignment = await storage.createAssignment(assignmentData);

      res.json(assignment);
    } catch (error: any) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get assignments for a class
  app.get("/api/classes/:classId/assignments", isAuthenticated, async (req: any, res) => {
    try {
      const { classId } = req.params;
      const assignments = await storage.getClassAssignments(classId);
      res.json(assignments);
    } catch (error: any) {
      console.error('Error fetching class assignments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all assignments for a teacher
  app.get("/api/teacher/assignments", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const assignments = await storage.getTeacherAssignments(teacherId);
      res.json(assignments);
    } catch (error: any) {
      console.error('Error fetching teacher assignments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific assignment
  app.get("/api/assignments/:assignmentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { assignmentId } = req.params;
      const assignment = await storage.getAssignment(assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Verify user is either the teacher who created it OR a student enrolled in the class
      const isTeacher = assignment.teacherId === userId;
      const isEnrolled = await storage.isStudentEnrolled(assignment.classId, userId);
      
      if (!isTeacher && !isEnrolled) {
        // Return 404 instead of 403 to prevent ID enumeration
        return res.status(404).json({ error: "Assignment not found" });
      }

      res.json(assignment);
    } catch (error: any) {
      console.error('Error fetching assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update assignment
  app.patch("/api/assignments/:assignmentId", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { assignmentId } = req.params;
      const assignment = await storage.getAssignment(assignmentId);
      
      if (!assignment || assignment.teacherId !== teacherId) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const updated = await storage.updateAssignment(assignmentId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete assignment
  app.delete("/api/assignments/:assignmentId", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { assignmentId } = req.params;
      const assignment = await storage.getAssignment(assignmentId);
      
      if (!assignment || assignment.teacherId !== teacherId) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      await storage.deleteAssignment(assignmentId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Assignment Submissions =====
  
  // Get student's submissions
  app.get("/api/student/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const submissions = await storage.getStudentSubmissions(studentId);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error fetching student submissions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get submissions for an assignment (teacher view)
  app.get("/api/assignments/:assignmentId/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { assignmentId } = req.params;
      
      // Verify user is the teacher who created this assignment
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      if (assignment.teacherId !== teacherId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const submissions = await storage.getAssignmentSubmissions(assignmentId);
      res.json(submissions);
    } catch (error: any) {
      console.error('Error fetching assignment submissions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create or update submission
  app.post("/api/assignments/:assignmentId/submit", mutationLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const studentId = req.user.claims.sub;
      const { assignmentId } = req.params;
      
      // Verify assignment exists and student is enrolled in the class
      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      const isEnrolled = await storage.isStudentEnrolled(assignment.classId, studentId);
      if (!isEnrolled) {
        return res.status(403).json({ error: "You must be enrolled in the class to submit this assignment" });
      }
      
      // Whitelist allowed student-controlled fields only
      const { content, attachments } = req.body;
      const submissionData = {
        content,
        attachments,
        submittedAt: new Date(),
        status: 'submitted' as const,
      };
      
      // Check if submission already exists
      const existing = await storage.getAssignmentSubmission(assignmentId, studentId);
      
      if (existing) {
        const updated = await storage.updateAssignmentSubmission(existing.id, submissionData);
        res.json(updated);
      } else {
        const submission = await storage.createAssignmentSubmission({
          assignmentId,
          studentId,
          ...submissionData,
        });
        res.json(submission);
      }
    } catch (error: any) {
      console.error('Error submitting assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Grade submission (teacher only)
  app.patch("/api/submissions/:submissionId/grade", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { submissionId } = req.params;
      const { teacherScore, teacherFeedback } = req.body;
      
      // Get submission to verify ownership via assignment
      const submission = await storage.getSubmissionById(submissionId);
      
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      
      // Verify the teacher owns the assignment
      const assignment = await storage.getAssignment(submission.assignmentId);
      if (!assignment || assignment.teacherId !== teacherId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updated = await storage.updateAssignmentSubmission(submissionId, {
        teacherScore,
        teacherFeedback,
        gradedAt: new Date(),
        status: 'graded',
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error grading submission:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Reporting =====
  
  // Import reporting service at top of file (handled separately)
  const { generateStudentProgressReport, generateClassSummaryReport, generateParentReport, exportReportToCSV } = await import("./reporting-service");

  // Generate student progress report (students can view their own, teachers can view any student in their class)
  app.get("/api/reports/student/:studentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { studentId } = req.params;
      const { format = "json" } = req.query; // json or csv
      
      // Students can only view their own reports
      if (studentId !== userId) {
        const user = await storage.getUser(userId);
        if (!hasTeacherAccess(user?.role)) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        // Verify teacher has access to this student (enrolled in one of their classes)
        const teacherClasses = await storage.getTeacherClasses(userId);
        let hasAccess = false;
        
        for (const cls of teacherClasses) {
          const isEnrolled = await storage.isStudentEnrolled(cls.id, studentId);
          if (isEnrolled) {
            hasAccess = true;
            break;
          }
        }
        
        if (!hasAccess) {
          return res.status(403).json({ error: "You do not have access to this student's report" });
        }
      }
      
      const report = await generateStudentProgressReport(studentId);
      
      if (format === "csv") {
        const csv = exportReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="student-progress-${studentId}.csv"`);
        return res.send(csv);
      }
      
      res.json(report);
    } catch (error: any) {
      console.error('Error generating student progress report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate class summary report (teachers only)
  app.get("/api/reports/class/:classId", isAuthenticated, async (req: any, res) => {
    try {
      const teacherId = req.user.claims.sub;
      const { classId } = req.params;
      
      const report = await generateClassSummaryReport(classId, teacherId);
      res.json(report);
    } catch (error: any) {
      console.error('Error generating class summary report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate parent/guardian report (students only - for their own progress)
  app.get("/api/reports/parent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const report = await generateParentReport(userId);
      res.json(report);
    } catch (error: any) {
      console.error('Error generating parent report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ADMIN-ONLY ENDPOINTS ==========
  
  // ===== User Management =====
  
  // Get all users (admin only)
  app.get("/api/admin/users", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { role, limit, offset } = req.query;
      const result = await storage.getAllUsers({
        role,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update user role (admin only)
  app.patch("/api/admin/users/:userId/role", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { role } = req.body;
      
      if (!role || !['student', 'teacher', 'developer', 'admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      const updated = await storage.updateUserRole(userId, role);
      
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'update_user_role',
        targetType: 'user',
        targetId: userId,
        metadata: { newRole: role },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating user role:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset user learning data (admin/developer only)
  app.post("/api/admin/users/:userId/reset-learning-data", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { resetVocabulary, resetConversations, resetProgress, resetLessons } = req.body;
      
      // Verify user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const result = await storage.resetUserLearningData(userId, {
        resetVocabulary: resetVocabulary !== false,
        resetConversations: resetConversations !== false,
        resetProgress: resetProgress !== false,
        resetLessons: resetLessons !== false,
      });
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'reset_learning_data',
        targetType: 'user',
        targetId: userId,
        metadata: result,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json({ 
        success: true,
        message: `Reset complete: ${result.vocabularyDeleted} vocabulary words, ${result.conversationsDeleted} conversations, ${result.lessonsDeleted} lessons deleted`,
        ...result
      });
    } catch (error: any) {
      console.error('Error resetting user learning data:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Class Management (Platform-wide) =====
  
  // Get all classes (admin/developer only)
  app.get("/api/admin/classes", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { limit, offset } = req.query;
      const result = await storage.getAllClasses({
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching classes:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get class details (admin/developer only)
  app.get("/api/admin/classes/:classId", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { classId } = req.params;
      const classDetails = await storage.getClassWithDetails(classId);
      
      if (!classDetails) {
        return res.status(404).json({ error: "Class not found" });
      }
      
      res.json(classDetails);
    } catch (error: any) {
      console.error('Error fetching class details:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Class Hour Packages (Institutional) =====
  
  // Get all hour packages (admin/developer only)
  app.get("/api/admin/hour-packages", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { purchaserId } = req.query;
      const packages = await storage.getClassHourPackages(purchaserId as string | undefined);
      res.json(packages);
    } catch (error: any) {
      console.error('Error fetching hour packages:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create a new hour package (admin/developer only)
  app.post("/api/admin/hour-packages", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      
      // Validate with Zod schema
      const parseResult = insertClassHourPackageSchema.safeParse({
        ...req.body,
        purchaserId: req.body.purchaserId || adminId,
        status: req.body.status || 'active',
        usedHours: req.body.usedHours || 0,
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const validated = parseResult.data;
      const pkg = await storage.createClassHourPackage(validated);
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'create_hour_package',
        targetType: 'hour_package',
        targetId: pkg.id,
        metadata: { name: validated.name, hoursPerStudent: validated.hoursPerStudent, totalPurchasedHours: validated.totalPurchasedHours },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.status(201).json(pkg);
    } catch (error: any) {
      console.error('Error creating hour package:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get a specific hour package
  app.get("/api/admin/hour-packages/:packageId", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { packageId } = req.params;
      const pkg = await storage.getClassHourPackage(packageId);
      
      if (!pkg) {
        return res.status(404).json({ error: "Hour package not found" });
      }
      
      res.json(pkg);
    } catch (error: any) {
      console.error('Error fetching hour package:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update an hour package
  app.patch("/api/admin/hour-packages/:packageId", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const { packageId } = req.params;
      
      const updated = await storage.updateClassHourPackage(packageId, req.body);
      
      if (!updated) {
        return res.status(404).json({ error: "Hour package not found" });
      }
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'update_hour_package',
        targetType: 'hour_package',
        targetId: packageId,
        metadata: req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating hour package:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Assign package to a class (link hourPackageId to teacherClasses)
  app.post("/api/admin/hour-packages/:packageId/assign-class", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      const { packageId } = req.params;
      const { classId } = req.body;
      
      if (!classId) {
        return res.status(400).json({ error: "classId is required" });
      }
      
      // Verify package exists
      const pkg = await storage.getClassHourPackage(packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Hour package not found" });
      }
      
      // Verify class exists
      const teacherClass = await storage.getTeacherClass(classId);
      if (!teacherClass) {
        return res.status(404).json({ error: "Class not found" });
      }
      
      // Update the class to link the package
      const updated = await storage.updateTeacherClass(classId, { hourPackageId: packageId });
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'assign_package_to_class',
        targetType: 'class',
        targetId: classId,
        metadata: { packageId, className: teacherClass.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json({ success: true, class: updated });
    } catch (error: any) {
      console.error('Error assigning package to class:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Assignment Management (Platform-wide) =====
  
  // Get all assignments (admin/developer only)
  app.get("/api/admin/assignments", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { limit, offset } = req.query;
      const result = await storage.getAllAssignments({
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all submissions (admin/developer only)
  app.get("/api/admin/submissions", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { limit, offset } = req.query;
      const result = await storage.getAllSubmissions({
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Platform Metrics =====
  
  // Get platform metrics (admin/developer only)
  app.get("/api/admin/metrics", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const metrics = await storage.getPlatformMetrics();
      res.json(metrics);
    } catch (error: any) {
      console.error('Error fetching platform metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get growth metrics (admin/developer only)
  app.get("/api/admin/metrics/growth", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { days = 30 } = req.query;
      const metrics = await storage.getGrowthMetrics(parseInt(days as string));
      res.json(metrics);
    } catch (error: any) {
      console.error('Error fetching growth metrics:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get top teachers (admin/developer only)
  app.get("/api/admin/top-teachers", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { limit = 10 } = req.query;
      const teachers = await storage.getTopTeachers(parseInt(limit as string));
      res.json(teachers);
    } catch (error: any) {
      console.error('Error fetching top teachers:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get top classes (admin/developer only)
  app.get("/api/admin/top-classes", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { limit = 10 } = req.query;
      const classes = await storage.getTopClasses(parseInt(limit as string));
      res.json(classes);
    } catch (error: any) {
      console.error('Error fetching top classes:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Audit Logs =====
  
  // Get admin audit logs (admin only)
  app.get("/api/admin/audit-logs", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { limit, offset, actorId } = req.query;
      const result = await storage.getAdminAuditLogs({
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        actorId: actorId as string | undefined,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== Impersonation =====
  
  // Start impersonation (admin only)
  app.post("/api/admin/impersonate", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { targetUserId, durationMinutes = 60 } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "Target user ID is required" });
      }
      
      // Prevent impersonating other admins
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }
      
      if (targetUser.role === 'admin') {
        return res.status(403).json({ error: "Cannot impersonate other admins" });
      }
      
      const updated = await storage.startImpersonation(adminId, targetUserId, durationMinutes);
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'start_impersonation',
        targetType: 'user',
        targetId: targetUserId,
        metadata: { durationMinutes },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json({ success: true, user: updated });
    } catch (error: any) {
      console.error('Error starting impersonation:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // End impersonation (admin only)
  app.post("/api/admin/end-impersonation", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { targetUserId } = req.body;
      
      if (!targetUserId) {
        return res.status(400).json({ error: "Target user ID is required" });
      }
      
      const updated = await storage.endImpersonation(targetUserId);
      
      // Log the action
      await storage.logAdminAction({
        actorId: adminId,
        action: 'end_impersonation',
        targetType: 'user',
        targetId: targetUserId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json({ success: true, user: updated });
    } catch (error: any) {
      console.error('Error ending impersonation:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get active impersonations (admin only)
  app.get("/api/admin/impersonations/active", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const activeImpersonations = await storage.getActiveImpersonations();
      res.json(activeImpersonations);
    } catch (error: any) {
      console.error('Error fetching active impersonations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Tutor Voice Management (Admin Console) =====
  
  // Get all configured voices (admin/developer only)
  app.get("/api/admin/tutor-voices", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const voices = await storage.getAllTutorVoices();
      res.json(voices);
    } catch (error: any) {
      console.error('Error fetching tutor voices:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create or update a voice configuration (developer/super admin only)
  // Only super admins can modify voice settings including personality, expressiveness, and emotion
  app.post("/api/admin/tutor-voices", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { language, gender, provider, voiceId, voiceName, languageCode, speakingRate, personality, expressiveness, emotion, isActive } = req.body;
      
      if (!language || !gender || !provider || !voiceId || !voiceName || !languageCode) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Validate speakingRate if provided (0.7 to 1.3 range)
      const validatedSpeakingRate = speakingRate !== undefined 
        ? Math.max(0.7, Math.min(1.3, parseFloat(speakingRate))) 
        : 0.9; // Default to natural speed
      
      // Validate personality (warm, calm, energetic, professional)
      const validPersonalities = ['warm', 'calm', 'energetic', 'professional'];
      const validatedPersonality = validPersonalities.includes(personality) ? personality : 'warm';
      
      // Validate expressiveness (1-5)
      const validatedExpressiveness = expressiveness !== undefined
        ? Math.max(1, Math.min(5, parseInt(expressiveness)))
        : 3;
      
      // Validate emotion (use provided or default to friendly)
      const validatedEmotion = emotion || 'friendly';
      
      const voice = await storage.upsertTutorVoice({
        language,
        gender,
        provider,
        voiceId,
        voiceName,
        languageCode,
        speakingRate: validatedSpeakingRate,
        personality: validatedPersonality,
        expressiveness: validatedExpressiveness,
        emotion: validatedEmotion,
        isActive: isActive !== false, // default to true
      });
      
      // Log the action
      await storage.logAdminAction({
        actorId: req.user.claims.sub,
        action: 'upsert_tutor_voice',
        targetType: 'tutor_voice',
        targetId: voice.id,
        metadata: { language, gender, voiceId, voiceName, speakingRate: validatedSpeakingRate, personality: validatedPersonality, expressiveness: validatedExpressiveness, emotion: validatedEmotion },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      res.json(voice);
    } catch (error: any) {
      console.error('Error upserting tutor voice:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete a voice configuration (admin only)
  app.delete("/api/admin/tutor-voices/:id", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTutorVoice(id);
      
      if (success) {
        await storage.logAdminAction({
          actorId: req.user.claims.sub,
          action: 'delete_tutor_voice',
          targetType: 'tutor_voice',
          targetId: id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
      
      res.json({ success });
    } catch (error: any) {
      console.error('Error deleting tutor voice:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Seed default voices (admin only - one-time setup)
  app.post("/api/admin/tutor-voices/seed", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      await storage.seedDefaultTutorVoices();
      
      await storage.logAdminAction({
        actorId: req.user.claims.sub,
        action: 'seed_tutor_voices',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      const voices = await storage.getAllTutorVoices();
      res.json({ success: true, voiceCount: voices.length, voices });
    } catch (error: any) {
      console.error('Error seeding tutor voices:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get voice for current user's language and preferred gender (for TTS)
  app.get("/api/tutor-voice", isAuthenticated, loadAuthenticatedUser(storage), async (req: any, res) => {
    try {
      const user = req.user;
      const language = user.targetLanguage || 'spanish';
      const gender = user.tutorGender || 'female';
      
      const voice = await storage.getTutorVoice(language, gender);
      
      if (!voice) {
        // Fallback to female if preferred gender not available
        const fallbackVoice = await storage.getTutorVoice(language, 'female');
        if (!fallbackVoice) {
          return res.status(404).json({ error: "No voice configured for this language" });
        }
        return res.json(fallbackVoice);
      }
      
      res.json(voice);
    } catch (error: any) {
      console.error('Error fetching tutor voice:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get both male and female voice names for a given language (for settings UI)
  app.get("/api/tutor-voices/:language", isAuthenticated, async (req: any, res) => {
    try {
      const language = req.params.language.toLowerCase();
      
      const femaleVoice = await storage.getTutorVoice(language, 'female');
      const maleVoice = await storage.getTutorVoice(language, 'male');
      
      res.json({
        language,
        female: femaleVoice ? { name: femaleVoice.voiceName, voiceId: femaleVoice.voiceId } : null,
        male: maleVoice ? { name: maleVoice.voiceName, voiceId: maleVoice.voiceId } : null,
      });
    } catch (error: any) {
      console.error('Error fetching tutor voices:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Fetch available Cartesia voices from their API (admin/developer only)
  // Route accepts optional path params: /api/admin/cartesia-voices/:language?/:gender?
  app.get("/api/admin/cartesia-voices/:language?/:gender?", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const apiKey = process.env.CARTESIA_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Cartesia API key not configured" });
      }

      // Path or query params for filtering
      const language = req.params.language || req.query.language;
      const gender = req.params.gender || req.query.gender;
      
      // Fetch voices from Cartesia API with pagination
      const allVoices: any[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      
      // Map gender for Cartesia API filtering
      const genderMap: Record<string, string> = {
        'male': 'masculine',
        'female': 'feminine',
      };
      const cartesiaGender = gender ? (genderMap[gender.toLowerCase()] || gender) : undefined;
      
      while (hasMore) {
        const url = new URL('https://api.cartesia.ai/voices');
        url.searchParams.set('limit', '100');
        if (cursor) {
          url.searchParams.set('starting_after', cursor);
        }
        // Use Cartesia's built-in gender filtering for efficiency
        if (cartesiaGender) {
          url.searchParams.set('gender', cartesiaGender);
        }
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Cartesia-Version': '2024-06-10',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Cartesia API error:', errorText);
          return res.status(response.status).json({ error: `Cartesia API error: ${response.statusText}` });
        }
        
        const data = await response.json();
        
        // Handle different response structures:
        // - API may return { data: [...], has_more: boolean } (paginated)
        // - Or API may return [...] directly (array)
        let voices: any[];
        let hasMoreFlag = false;
        
        if (Array.isArray(data)) {
          // Direct array response
          voices = data;
          hasMoreFlag = false; // No pagination info available
          console.log(`[Cartesia API] Direct array response with ${voices.length} voices`);
        } else if (data.data && Array.isArray(data.data)) {
          // Paginated response with data property
          voices = data.data;
          hasMoreFlag = data.has_more === true;
          console.log(`[Cartesia API] Paginated response with ${voices.length} voices, has_more: ${hasMoreFlag}`);
        } else if (data.items && Array.isArray(data.items)) {
          // Alternative paginated response with items property
          voices = data.items;
          hasMoreFlag = data.has_more === true;
          console.log(`[Cartesia API] Paginated response (items) with ${voices.length} voices, has_more: ${hasMoreFlag}`);
        } else {
          console.error('[Cartesia Voices] Unexpected response structure:', JSON.stringify(data).substring(0, 500));
          break;
        }
        
        allVoices.push(...voices);
        hasMore = hasMoreFlag;
        if (hasMore && voices.length > 0) {
          cursor = voices[voices.length - 1].id;
        }
      }
      
      console.log(`[Cartesia Voices] Total fetched: ${allVoices.length}, filtering by language: ${language}, gender: ${gender}`);
      
      // Log first few voices to understand structure
      if (allVoices.length > 0) {
        console.log(`[Cartesia Voices] Sample voice structure:`, JSON.stringify(allVoices[0], null, 2));
        // Log unique language values for debugging
        const uniqueLanguages = [...new Set(allVoices.map((v: any) => v.language).filter(Boolean))];
        console.log(`[Cartesia Voices] Unique languages found:`, uniqueLanguages.slice(0, 20));
      }
      
      // Filter by is_public first
      let filteredVoices = allVoices.filter((v: any) => v.is_public);
      console.log(`[Cartesia Voices] Public voices: ${filteredVoices.length}`);
      
      if (language) {
        // Map our language names to Cartesia language codes
        const langCodeMap: Record<string, string> = {
          'english': 'en',
          'spanish': 'es',
          'french': 'fr',
          'german': 'de',
          'italian': 'it',
          'portuguese': 'pt',
          'portuguese (brazilian)': 'pt-br',
          'japanese': 'ja',
          'mandarin chinese': 'zh',
          'korean': 'ko',
        };
        const langCode = langCodeMap[language.toLowerCase()] || language.toLowerCase();
        
        // Cartesia Sonic-3 is multilingual - each voice can speak any of 42+ languages
        // The `language` field indicates the voice's native/primary training language
        // For best accent authenticity, we filter by native language
        // But we also support showing ALL voices as a fallback
        
        const nativeVoices = filteredVoices.filter((v: any) => {
          // Check language field
          if (v.language && v.language.toLowerCase().startsWith(langCode)) {
            return true;
          }
          // Check languages array if present
          if (v.languages && Array.isArray(v.languages)) {
            return v.languages.some((l: string) => l.toLowerCase().startsWith(langCode));
          }
          return false;
        });
        
        console.log(`[Cartesia Voices] Native voices for ${langCode}: ${nativeVoices.length}`);
        
        // If no native voices found, return ALL public voices (since they're all multilingual)
        // Admin can choose any voice - it will work for the target language
        if (nativeVoices.length === 0) {
          console.log(`[Cartesia Voices] No native ${langCode} voices - returning all ${filteredVoices.length} multilingual voices`);
        } else {
          filteredVoices = nativeVoices;
        }
        
        console.log(`[Cartesia Voices] After language filter (${langCode}): ${filteredVoices.length}`);
      }
      
      // Apply gender filter (Cartesia API gender param doesn't reliably filter, so do it server-side)
      if (gender) {
        const targetGender = gender.toLowerCase() === 'male' ? 'masculine' : 
                             gender.toLowerCase() === 'female' ? 'feminine' : gender.toLowerCase();
        const beforeGenderFilter = filteredVoices.length;
        filteredVoices = filteredVoices.filter((v: any) => {
          const voiceGender = v.gender?.toLowerCase();
          return voiceGender === targetGender;
        });
        console.log(`[Cartesia Voices] After gender filter (${targetGender}): ${filteredVoices.length} (was ${beforeGenderFilter})`);
      }
      
      console.log(`[Cartesia Voices] Final count after all filters: ${filteredVoices.length}`);
      
      // Sort by name for easier browsing
      filteredVoices.sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      // Transform to our format
      const voices = filteredVoices.map((v: any) => ({
        id: v.id,
        name: v.name,
        description: v.description || '',
        language: v.language,
        gender: v.gender === 'masculine' ? 'male' : v.gender === 'feminine' ? 'female' : v.gender,
        isPublic: v.is_public,
      }));
      
      res.json({ voices, total: voices.length });
    } catch (error: any) {
      console.error('Error fetching Cartesia voices:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get TTS emotion metadata for admin voice console (admin/developer only)
  // Returns personality presets, expressiveness levels, and allowed emotions
  app.get("/api/admin/tts-meta", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { PERSONALITY_PRESETS, EXPRESSIVENESS_LEVELS, getAllowedEmotions, getDefaultEmotion } = await import('./services/tts-service');
      
      // Build allowed emotions map for each personality at each expressiveness level
      const emotionsMap: Record<string, Record<number, string[]>> = {};
      const personalities = ['warm', 'calm', 'energetic', 'professional'] as const;
      
      for (const personality of personalities) {
        emotionsMap[personality] = {};
        for (let level = 1; level <= 5; level++) {
          emotionsMap[personality][level] = getAllowedEmotions(personality, level);
        }
      }
      
      res.json({
        personalities: PERSONALITY_PRESETS,
        expressivenessLevels: EXPRESSIVENESS_LEVELS,
        emotionsMap,
        getDefaultEmotion: Object.fromEntries(
          personalities.map(p => [p, getDefaultEmotion(p)])
        ),
      });
    } catch (error: any) {
      console.error('Error fetching TTS metadata:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Preview TTS for admin voice testing (admin/developer only)
  // This endpoint fully simulates production TTS with phoneme processing and emotion control
  app.post("/api/admin/tutor-voices/preview", isAuthenticated, loadAuthenticatedUser(storage), requireRole('admin'), async (req: any, res) => {
    try {
      const { voiceId, text, language, speakingRate, emotion } = req.body;
      
      if (!voiceId || !text) {
        return res.status(400).json({ error: "voiceId and text are required" });
      }
      
      // Use TTS service with configurable speaking rate
      // Validate speakingRate (0.7 to 1.3 range), default to 0.9
      const validatedRate = speakingRate !== undefined
        ? Math.max(0.7, Math.min(1.3, parseFloat(speakingRate)))
        : 0.9;
      
      const { getTTSService } = await import('./services/tts-service');
      const ttsService = getTTSService();
      const result = await ttsService.synthesize({
        text,
        voiceId,
        language: language || 'en',
        targetLanguage: language || 'en', // Enable phoneme processing for accurate pronunciation
        emotion: emotion || 'friendly',
        speakingRate: validatedRate,
      });
      
      res.set({
        'Content-Type': result.contentType,
        'Content-Length': result.audioBuffer.length,
      });
      res.send(result.audioBuffer);
    } catch (error: any) {
      console.error('Error previewing voice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Set up unified WebSocket handler for all paths
  setupUnifiedWebSocketHandler(httpServer);
  
  return httpServer;
}
