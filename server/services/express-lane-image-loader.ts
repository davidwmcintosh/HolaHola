import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { getSharedDb } from '../db';
import { collaborationMessages, founderSessions } from '@shared/schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';

const MAX_IMAGE_SIZE_BYTES = 800 * 1024;
const MAX_IMAGE_DIMENSION = 1024;

interface ImageAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface ExpressLaneImage {
  messageId: string;
  messageContent: string;
  imageName: string;
  imageUrl: string;
  imageType: string;
  base64Data: string;
  createdAt: Date;
}

/**
 * Search Express Lane messages for images matching a query
 * Returns image metadata and content for Gemini multimodal input
 */
export async function findExpressLaneImages(
  founderId: number,
  query: string,
  limit: number = 3
): Promise<ExpressLaneImage[]> {
  try {
    // Get founder's sessions
    const founderSessionIds = await getSharedDb()
      .select({ id: founderSessions.id })
      .from(founderSessions)
      .where(eq(founderSessions.founderId, String(founderId)))
      .orderBy(desc(founderSessions.updatedAt))
      .limit(10);
    
    if (founderSessionIds.length === 0) {
      console.log(`[ExpressLaneImage] No sessions found for founder ${founderId}`);
      return [];
    }
    
    const sessionIdList = founderSessionIds.map(s => s.id);
    
    // Get messages with image attachments
    const messagesWithImages = await getSharedDb()
      .select()
      .from(collaborationMessages)
      .where(
        and(
          inArray(collaborationMessages.sessionId, sessionIdList),
          sql`${collaborationMessages.metadata}->>'attachments' IS NOT NULL`
        )
      )
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(50);
    
    const queryLower = query.toLowerCase();
    const matchedImages: ExpressLaneImage[] = [];
    
    for (const msg of messagesWithImages) {
      const metadata = msg.metadata as { attachments?: ImageAttachment[] } | null;
      if (!metadata?.attachments) continue;
      
      for (const attachment of metadata.attachments) {
        if (!attachment.type?.startsWith('image/')) continue;
        
        // Match by image name, message content, or query terms
        const imageName = attachment.name.toLowerCase();
        const messageContent = (msg.content || '').toLowerCase();
        
        const matches = 
          imageName.includes(queryLower) ||
          messageContent.includes(queryLower) ||
          queryLower.includes(imageName.replace(/\.[^.]+$/, '')) || // filename without extension
          // Common query patterns
          (queryLower.includes('house') && (imageName.includes('house') || messageContent.includes('house'))) ||
          (queryLower.includes('family') && (imageName.includes('family') || messageContent.includes('family'))) ||
          (queryLower.includes('daniela') && imageName.includes('daniela')) ||
          (queryLower.includes('canyon') && (imageName.includes('canyon') || messageContent.includes('canyon'))) ||
          (queryLower.includes('grand') && (imageName.includes('grand') || messageContent.includes('grand'))) ||
          (queryLower.includes('portrait') && imageName.includes('daniela')) ||
          (queryLower.includes('photo') || queryLower.includes('picture') || queryLower.includes('image'));
        
        if (matches) {
          // Load and encode the image (with resize if needed)
          const loaded = await loadImageAsBase64(attachment.url, attachment.type);
          if (loaded) {
            matchedImages.push({
              messageId: msg.id,
              messageContent: msg.content || '',
              imageName: attachment.name,
              imageUrl: attachment.url,
              imageType: loaded.mimeType,
              base64Data: loaded.base64,
              createdAt: msg.createdAt || new Date(),
            });
            
            if (matchedImages.length >= limit) break;
          }
        }
      }
      
      if (matchedImages.length >= limit) break;
    }
    
    console.log(`[ExpressLaneImage] Found ${matchedImages.length} images matching "${query}"`);
    return matchedImages;
    
  } catch (error) {
    console.error('[ExpressLaneImage] Error searching images:', error);
    return [];
  }
}

interface LoadedImage {
  base64: string;
  mimeType: string;
  wasResized: boolean;
}

/**
 * Load an image file, resize if too large, and convert to base64
 * Images are resized to max 1024x1024 and compressed to ~800KB for Gemini
 */
async function loadImageAsBase64(imageUrl: string, originalMimeType: string): Promise<LoadedImage | null> {
  try {
    const relativePath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    const absolutePath = path.join(process.cwd(), relativePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`[ExpressLaneImage] File not found: ${absolutePath}`);
      return null;
    }
    
    const originalBuffer = fs.readFileSync(absolutePath);
    const originalSizeKB = Math.round(originalBuffer.length / 1024);
    
    // If image is small enough, return as-is
    if (originalBuffer.length <= MAX_IMAGE_SIZE_BYTES) {
      console.log(`[ExpressLaneImage] Loaded image: ${imageUrl} (${originalSizeKB}KB - no resize needed)`);
      return {
        base64: originalBuffer.toString('base64'),
        mimeType: originalMimeType,
        wasResized: false,
      };
    }
    
    // Resize large images using sharp
    console.log(`[ExpressLaneImage] Resizing large image: ${imageUrl} (${originalSizeKB}KB → targeting ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024)}KB)`);
    
    const resizedBuffer = await sharp(originalBuffer)
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
    
    const resizedSizeKB = Math.round(resizedBuffer.length / 1024);
    console.log(`[ExpressLaneImage] Resized: ${originalSizeKB}KB → ${resizedSizeKB}KB`);
    
    return {
      base64: resizedBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      wasResized: true,
    };
    
  } catch (error) {
    console.error(`[ExpressLaneImage] Error loading image ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Get all available Express Lane images for a founder (for listing)
 */
export async function listExpressLaneImages(founderId: number): Promise<Array<{
  name: string;
  messageContext: string;
  createdAt: Date;
}>> {
  try {
    const founderSessionIds = await getSharedDb()
      .select({ id: founderSessions.id })
      .from(founderSessions)
      .where(eq(founderSessions.founderId, String(founderId)))
      .orderBy(desc(founderSessions.updatedAt))
      .limit(10);
    
    if (founderSessionIds.length === 0) return [];
    
    const sessionIdList = founderSessionIds.map(s => s.id);
    
    const messagesWithImages = await getSharedDb()
      .select()
      .from(collaborationMessages)
      .where(
        and(
          inArray(collaborationMessages.sessionId, sessionIdList),
          sql`${collaborationMessages.metadata}->>'attachments' IS NOT NULL`
        )
      )
      .orderBy(desc(collaborationMessages.createdAt));
    
    const imageList: Array<{ name: string; messageContext: string; createdAt: Date }> = [];
    
    for (const msg of messagesWithImages) {
      const metadata = msg.metadata as { attachments?: ImageAttachment[] } | null;
      if (!metadata?.attachments) continue;
      
      for (const attachment of metadata.attachments) {
        if (attachment.type?.startsWith('image/')) {
          imageList.push({
            name: attachment.name,
            messageContext: msg.content || '(no context)',
            createdAt: msg.createdAt || new Date(),
          });
        }
      }
    }
    
    return imageList;
  } catch (error) {
    console.error('[ExpressLaneImage] Error listing images:', error);
    return [];
  }
}
