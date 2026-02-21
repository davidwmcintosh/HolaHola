/**
 * Vocabulary Image Resolver Service
 * 
 * Resolves images for vocabulary words on the whiteboard.
 * Uses a tiered approach:
 * 1. Check cache for existing vocabulary image
 * 2. Try stock image from Unsplash (fast, free)
 * 3. Fall back to AI-generated image (if stock fails)
 * 
 * Philosophy: Visual vocabulary creates direct meaning-to-concept connections
 * without translation, supporting immersive learning.
 */

import { storage } from '../storage';
import type { MediaFile } from '@shared/schema';
import crypto from 'crypto';

interface VocabImageRequest {
  word: string;
  language: string;
  description?: string;
  conversationId?: string;
  userId?: string;
}

interface VocabImageResult {
  imageUrl: string;
  source: 'cache' | 'stock' | 'ai' | 'placeholder';
  word: string;
  description: string;
}

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const LANGUAGE_STOP_WORDS: Record<string, Set<string>> = {
  spanish: new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'con', 'por', 'para', 'es', 'está', 'son', 'muy', 'más', 'y', 'o', 'que', 'se', 'me', 'te', 'le', 'nos', 'su', 'mi', 'tu', 'al', 'a', 'no', 'sí', 'como', 'pero', 'ya', 'hay', 'aquí', 'ahí', 'allí', 'esto', 'eso', 'este', 'ese', 'esta', 'esa', 'estos', 'esos', 'estas', 'esas', 'lo', 'yo', 'tú', 'él', 'ella', 'nosotros', 'ellos', 'ellas', 'usted', 'ustedes', 'quiero', 'quisiera', 'puedo', 'tiene', 'tengo', 'favor', 'entonces', 'también']),
  french: new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'en', 'et', 'est', 'sont', 'très', 'plus', 'ou', 'que', 'se', 'me', 'te', 'ce', 'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'au', 'aux', 'à', 'ne', 'pas', 'oui', 'non', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'avec', 'pour', 'par', 'sur', 'dans', 'qui', 'bien', 'aussi']),
  german: new Set(['der', 'die', 'das', 'ein', 'eine', 'und', 'ist', 'sind', 'sehr', 'mehr', 'oder', 'dass', 'sich', 'mein', 'dein', 'sein', 'ihr', 'mit', 'für', 'von', 'zu', 'auf', 'in', 'an', 'nicht', 'ja', 'nein', 'ich', 'du', 'er', 'sie', 'wir', 'auch', 'aber', 'noch', 'den', 'dem', 'des']),
  italian: new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'di', 'del', 'in', 'con', 'per', 'è', 'sono', 'molto', 'più', 'e', 'o', 'che', 'si', 'mi', 'ti', 'ci', 'suo', 'mio', 'tuo', 'al', 'a', 'non', 'sì', 'come', 'ma', 'io', 'tu', 'lui', 'lei', 'noi', 'loro', 'anche', 'da']),
  portuguese: new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'em', 'com', 'por', 'para', 'é', 'são', 'muito', 'mais', 'e', 'ou', 'que', 'se', 'me', 'te', 'seu', 'meu', 'teu', 'ao', 'não', 'sim', 'como', 'mas', 'eu', 'tu', 'ele', 'ela', 'nós', 'eles', 'elas', 'também', 'já', 'no', 'na']),
  english: new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'for', 'at', 'by', 'to', 'in', 'on', 'of', 'up', 'out', 'off', 'with', 'from', 'into', 'over', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'very', 'then', 'than', 'also', 'just', 'more', 'some', 'any', 'all', 'each', 'every', 'both']),
};

function extractVisualConcept(word: string, language: string): string {
  let text = word
    .replace(/[¿¡?!.,;:'"()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.split(' ').length <= 2) {
    return text;
  }

  const stopWords = LANGUAGE_STOP_WORDS[language] || LANGUAGE_STOP_WORDS.english;
  const words = text.toLowerCase().split(' ');
  const contentWords = words
    .map(w => w.replace(/^[dl]['']/, ''))
    .map(w => w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    .filter(w => !stopWords.has(w) && w.length > 1);

  if (contentWords.length === 0) {
    return text.split(' ').slice(0, 3).join(' ');
  }

  return contentWords.slice(0, 3).join(' ');
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function generateCacheKey(word: string, language: string): string {
  const normalized = normalizeWord(word);
  return `vocab_${language}_${normalized}`;
}

function generatePromptHash(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
}

async function fetchStockImage(query: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('[VocabImage] No Unsplash API key configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
      {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          'Accept-Version': 'v1'
        }
      }
    );

    if (!response.ok) {
      console.log(`[VocabImage] Unsplash returned ${response.status} for "${query}"`);
      return null;
    }

    const data = await response.json();
    return data.urls?.regular || data.urls?.small || null;
  } catch (error: any) {
    console.error('[VocabImage] Unsplash fetch error:', error.message);
    return null;
  }
}

async function generateAIImage(word: string, description: string, language: string): Promise<string | null> {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const visualConcept = extractVisualConcept(word, language);
    const prompt = `Create a clean, professional photograph-style image representing the concept "${visualConcept}" for a language learning flashcard. Show the object, action, or scene clearly with good lighting and a simple, uncluttered background. The image should immediately convey the meaning of the word "${word}" without any text, letters, numbers, or watermarks in the image. Realistic style, warm natural colors.`;
    
    const response = await gemini.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['image', 'text'],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
          const base64Data = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;
          return `data:${mimeType};base64,${base64Data}`;
        }
      }
    }
    
    console.log('[VocabImage] AI generation returned no image');
    return null;
  } catch (error: any) {
    console.error('[VocabImage] AI generation error:', error.message);
    return null;
  }
}

function getPlaceholderUrl(word: string): string {
  const encoded = encodeURIComponent(word);
  return `https://via.placeholder.com/400x300/6366f1/ffffff?text=${encoded}`;
}

export async function resolveVocabularyImage(request: VocabImageRequest): Promise<VocabImageResult> {
  const { word, language, description = word, conversationId, userId } = request;
  const cacheKey = generateCacheKey(word, language);
  
  console.log(`[VocabImage] Resolving image for "${word}" (${language})`);
  
  const cached = await storage.getCachedStockImage(cacheKey);
  if (cached?.url) {
    console.log(`[VocabImage] Cache hit for "${word}"`);
    await storage.incrementImageUsage(cached.id);
    return {
      imageUrl: cached.url,
      source: 'cache',
      word,
      description,
    };
  }

  const visualConcept = extractVisualConcept(word, language);
  const stockQuery = visualConcept !== word.toLowerCase() 
    ? visualConcept 
    : `${word} ${description}`.substring(0, 80);
  console.log(`[VocabImage] Search query: "${stockQuery}" (extracted from "${word}")`);
  
  const stockUrl = await fetchStockImage(stockQuery);
  if (stockUrl) {
    console.log(`[VocabImage] Stock image found for "${word}"`);
    
    try {
      await storage.cacheImage({
        url: stockUrl,
        filename: `vocab_${cacheKey}.jpg`,
        mimeType: 'image/jpeg',
        mediaType: 'image',
        imageSource: 'stock',
        searchQuery: stockQuery,
        uploadedBy: userId,
        targetWord: word,
        language,
      });
    } catch (err: any) {
      console.log('[VocabImage] Cache save skipped:', err.message);
    }
    
    return {
      imageUrl: stockUrl,
      source: 'stock',
      word,
      description,
    };
  }

  const aiUrl = await generateAIImage(word, description, language);
  if (aiUrl) {
    console.log(`[VocabImage] AI image generated for "${word}"`);
    
    const promptHash = generatePromptHash(`${word}_${language}_${description}`);
    try {
      await storage.cacheImage({
        url: aiUrl,
        filename: `vocab_ai_${cacheKey}.png`,
        mimeType: 'image/png',
        mediaType: 'image',
        imageSource: 'ai_generated',
        promptHash,
        uploadedBy: userId,
        targetWord: word,
        language,
      });
    } catch (err: any) {
      console.log('[VocabImage] AI cache save skipped:', err.message);
    }
    
    return {
      imageUrl: aiUrl,
      source: 'ai',
      word,
      description,
    };
  }

  console.log(`[VocabImage] Using placeholder for "${word}"`);
  return {
    imageUrl: getPlaceholderUrl(word),
    source: 'placeholder',
    word,
    description,
  };
}

export async function resolveMultipleImages(
  requests: VocabImageRequest[]
): Promise<VocabImageResult[]> {
  return Promise.all(requests.map(resolveVocabularyImage));
}

export async function prefetchVocabularyImage(
  word: string,
  language: string,
  description?: string
): Promise<void> {
  const cacheKey = generateCacheKey(word, language);
  const cached = await storage.getCachedStockImage(cacheKey);
  
  if (!cached) {
    resolveVocabularyImage({ word, language, description }).catch(err => {
      console.error(`[VocabImage] Prefetch failed for "${word}":`, err.message);
    });
  }
}

export interface RefetchImageRequest {
  word: string;
  language: string;
  preferredSource: 'stock' | 'ai';
  customQuery?: string;
  userId?: string;
}

export interface RefetchImageResult {
  imageUrl: string;
  source: 'stock' | 'ai' | 'placeholder';
  searchQuery: string;
  word: string;
}

export async function refetchImage(request: RefetchImageRequest): Promise<RefetchImageResult> {
  const { word, language, preferredSource, customQuery, userId } = request;
  const searchQuery = customQuery || extractVisualConcept(word, language);
  const cacheKey = generateCacheKey(word, language);
  
  console.log(`[VocabImage] Refetch "${word}" via ${preferredSource}, query: "${searchQuery}"`);
  
  if (preferredSource === 'stock') {
    const stockUrl = await fetchStockImage(searchQuery);
    if (stockUrl) {
      try {
        await storage.cacheImage({
          url: stockUrl,
          filename: `vocab_${cacheKey}.jpg`,
          mimeType: 'image/jpeg',
          mediaType: 'image',
          imageSource: 'stock',
          searchQuery,
          uploadedBy: userId,
          targetWord: word,
          language,
        });
      } catch (err: any) {
        console.log('[VocabImage] Cache save skipped:', err.message);
      }
      return { imageUrl: stockUrl, source: 'stock', searchQuery, word };
    }
    console.log(`[VocabImage] Stock failed for "${searchQuery}", falling back to AI`);
  }
  
  const aiUrl = await generateAIImage(word, searchQuery, language);
  if (aiUrl) {
    const promptHash = generatePromptHash(`${word}_${language}_${searchQuery}_refetch_${Date.now()}`);
    try {
      await storage.cacheImage({
        url: aiUrl,
        filename: `vocab_ai_${cacheKey}.png`,
        mimeType: 'image/png',
        mediaType: 'image',
        imageSource: 'ai_generated',
        promptHash,
        searchQuery,
        uploadedBy: userId,
        targetWord: word,
        language,
      });
    } catch (err: any) {
      console.log('[VocabImage] AI cache save skipped:', err.message);
    }
    return { imageUrl: aiUrl, source: 'ai', searchQuery, word };
  }
  
  return { imageUrl: getPlaceholderUrl(word), source: 'placeholder', searchQuery, word };
}

export { extractVisualConcept };
