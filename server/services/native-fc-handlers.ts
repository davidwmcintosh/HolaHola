import { sql, eq, and, desc } from "drizzle-orm";
import { tutorSessions, hiveSnapshots, conversationMemories } from "@shared/schema";
import { ExtractedFunctionCall } from "./gemini-streaming";
import type { StreamingSession } from "./streaming-voice-orchestrator";
import { getCharacter } from "./character-registry";
import { breakfastMenus, lunchMenus, menuTitleByLanguage } from '../data/language-menus-restaurant-mealtime';
import { restaurantMenus } from '../data/language-menus-restaurant-festival';
import { coffeeShopMenus } from '../data/language-menus-cafe-grocery';
import { getGeminiStreamingService } from "./gemini-streaming";
import { extractBoldMarkedWords } from "./language-segmenter";
import { TutorPersonality } from "./tts-service";
import { usageService } from "./usage-service";
import { brainHealthTelemetry } from "./brain-health-telemetry";
import { hiveCollaborationService, BeaconType } from "./hive-collaboration-service";
import { collaborationHubService } from "./collaboration-hub-service";
import { founderCollabService } from "./founder-collaboration-service";
import { journeyMemoryService } from "./journey-memory-service";
import { growthMemoryOutcomeService } from "./growth-memory-outcome-service";
import { storage } from "../storage";
import { getSharedDb } from "../db";
import { WhiteboardItem, WordMapItem, isWordMapItem, SelfSurgeryItemData } from "@shared/whiteboard-types";
import { StreamingWhiteboardMessage } from "@shared/streaming-voice-types";
import { WebSocket as WS } from "ws";
import type { IStorage } from "../storage";

interface ArchitectMessage {
  type: 'question' | 'suggestion' | 'observation' | 'request';
  content: string;
  urgency?: 'low' | 'medium' | 'high';
}

export class NativeFunctionCallHandler {
  constructor(
    private sendMessage: (ws: any, message: any, session?: any) => void,
    private sendError: (ws: any, code: string, message: string, recoverable: boolean) => void,
    private processPhaseShift: (session: StreamingSession, data: { to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment'; reason: string }) => Promise<void>,
  ) {}

  async handle(sessionId: string, session: StreamingSession, fn: ExtractedFunctionCall): Promise<void> {
    console.log(`[Native Function Call] Processing: ${fn.name} -> ${fn.legacyType}`);
    
    const fnText = (fn.args.text || fn.args.spoken_text) as string | undefined;
    if (fnText && fnText.includes('**')) {
      const fnBoldWords = extractBoldMarkedWords(fnText);
      if (fnBoldWords.length > 0) {
        const existing: string[] = session.accumulatedBoldWords || [];
        session.accumulatedBoldWords = [...new Set([...existing, ...fnBoldWords])];
        console.log(`[Native Function Call] Accumulated ${fnBoldWords.length} bold words from ${fn.name}: ${fnBoldWords.join(', ')}`);
        
        this.addSttKeyterms(session, fnBoldWords);
      }
    }
    
    if (!session.isIncognito) {
      brainHealthTelemetry.logToolCall({
        sessionId: session.id,
        conversationId: session.conversationId,
        userId: String(session.userId),
        targetLanguage: session.targetLanguage,
        toolName: fn.legacyType || fn.name,
      }).catch(err => console.warn('[BrainHealth] Tool call log failed:', err.message));
    }
    
    switch (fn.legacyType) {
      case 'SWITCH_TUTOR': {
        const target = fn.args.target as string | undefined;
        const language = fn.args.language as string | undefined;
        const role = fn.args.role as string | undefined;
        
        if (target && !session.pendingTutorSwitch && !session.crossLanguageTransferBlocked) {
          const targetGender = target as 'male' | 'female';
          console.log(`[Native Function Call] SWITCH_TUTOR -> ${targetGender}, language: ${language || 'same'}, role: ${role || 'tutor'}`);
          
          session.pendingTutorSwitch = {
            targetGender,
            targetLanguage: language || session.targetLanguage,
            targetRole: (role === 'assistant' ? 'assistant' : 'tutor') as 'tutor' | 'assistant' | undefined,
          };
          session.switchTutorTriggered = true;
        }
        break;
      }
      
      case 'PHASE_SHIFT': {
        const text = fn.args.text as string | undefined;
        const to = fn.args.to as string | undefined;
        const reason = fn.args.reason as string | undefined;
        if (to && reason) {
          this.processPhaseShift(session, { 
            to: to as 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment', 
            reason 
          })().catch(err => console.error(`[Native Function→PhaseShift] Error:`, err));
          console.log(`[Native Function→PhaseShift] Triggered: ${to} - ${reason}`);
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→PhaseShift] Text included: "${text.substring(0, 50)}..."`);
        }
        break;
      }
      
      case 'VOICE_ADJUST': {
        const text = fn.args.text as string | undefined;
        const speed = (fn.args.speed as string | undefined)?.toLowerCase();
        const emotion = (fn.args.emotion as string | undefined)?.toLowerCase();
        const personality = (fn.args.personality as string | undefined)?.toLowerCase();
        const vocalStyle = fn.args.vocal_style as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        const speedMap: Record<string, number> = {
          'slowest': 0.7,
          'slow': 0.8,
          'normal': 0.9,
          'fast': 1.05,
          'fastest': 1.2,
        };
        
        const emotionMap: Record<string, string> = {
          'positivity': 'happy',
          'curiosity': 'curious',
          'surprise': 'surprised',
          'anger': 'neutral',
          'sadness': 'thoughtful',
          'happy': 'happy',
          'excited': 'excited',
          'friendly': 'friendly',
          'curious': 'curious',
          'thoughtful': 'thoughtful',
          'warm': 'warm',
          'playful': 'playful',
          'surprised': 'surprised',
          'proud': 'proud',
          'encouraging': 'encouraging',
          'calm': 'calm',
          'neutral': 'neutral',
        };
        
        const validPersonalities = ['warm', 'calm', 'energetic', 'professional'];
        const validatedPersonality = personality && validPersonalities.includes(personality) 
          ? personality as TutorPersonality 
          : undefined;
        
        const mappedEmotion = emotion ? emotionMap[emotion] : undefined;
        
        const currentOverride = session.voiceOverride || {};
        const newOverride = {
          ...currentOverride,
          ...(speed && { speakingRate: speedMap[speed] || 0.9 }),
          ...(mappedEmotion && { emotion: mappedEmotion }),
          ...(validatedPersonality && { personality: validatedPersonality }),
          ...(vocalStyle && { vocalStyle }),
        };
        
        session.voiceOverride = newOverride;
        
        if (text) {
          session.voiceAdjustText = text;
          if (!session.functionCallText) {
            session.functionCallText = text;
          }
          console.log(`[Native Function→VoiceAdjust] Text included (${text.length} chars): "${text.substring(0, 80)}..."`);
        }
        
        console.log(`[Native Function→VoiceAdjust] Applied: speed=${speed || 'unchanged'} (rate=${speed ? speedMap[speed] : 'unchanged'}), emotion=${emotion || 'unchanged'} (mapped=${mappedEmotion || 'unchanged'}), personality=${validatedPersonality || 'unchanged'}, vocalStyle=${vocalStyle ? `"${vocalStyle.substring(0, 60)}"` : 'unchanged'}, reason=${reason || 'none'}`);
        console.log(`[Native Function→VoiceAdjust] Session override now:`, newOverride);
        break;
      }
      
      case 'VOICE_RESET': {
        const text = fn.args.text as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (session.voiceDefaults) {
          session.voiceOverride = {
            speakingRate: session.voiceDefaults.speakingRate,
            emotion: session.voiceDefaults.emotion,
            personality: session.voiceDefaults.personality,
            expressiveness: session.voiceDefaults.expressiveness,
          };
          console.log(`[Native Function→VoiceReset] Reset to tutor defaults:`, session.voiceDefaults, `reason: ${reason || 'none'}`);
        } else {
          session.voiceOverride = undefined;
          console.log(`[Native Function→VoiceReset] Cleared override (no defaults stored), reason: ${reason || 'none'}`);
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→VoiceReset] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'SPEAK_AS': {
        const characterId = fn.args.character as string | undefined;
        const text = fn.args.text as string | undefined;
        const roleOverride = fn.args.role as string | undefined;

        if (!characterId) {
          console.warn('[Native Function→SpeakAs] No character ID provided — ignoring');
          break;
        }

        const character = getCharacter(session.targetLanguage || 'spanish', characterId);
        if (!character) {
          console.warn(`[Native Function→SpeakAs] Unknown character "${characterId}" for language "${session.targetLanguage}" — ignoring`);
          break;
        }

        // Save the tutor's voice and provider before the first character switch
        if (!session.activeCharacter) {
          session._tutorVoiceBeforeCharacter = session.voiceId;
          session._tutorTtsProviderBeforeCharacter = session.ttsProvider;
        }

        // Swap voice AND provider to the character's configuration
        session.voiceId = character.voiceId;
        session.ttsProvider = character.ttsProvider;
        session.activeCharacter = {
          id: character.id,
          displayName: character.displayName,
          role: roleOverride || character.role,
          gender: character.gender,
          voiceId: character.voiceId,
          ttsProvider: character.ttsProvider,
        };

        // Route the character's text through TTS (same mechanism as VOICE_ADJUST)
        if (text) {
          session.functionCallText = text;
        }

        // Notify client of character change
        this.sendMessage(session.ws, {
          type: 'character_change',
          character: {
            id: character.id,
            displayName: character.displayName,
            role: session.activeCharacter.role,
            gender: character.gender,
          },
          timestamp: Date.now(),
        });

        console.log(`[Native Function→SpeakAs] Character "${character.displayName}" (${character.id}) is now speaking. voiceId=${character.voiceId}`);
        break;
      }

      case 'RESUME_TUTOR': {
        const text = fn.args.text as string | undefined;

        // Restore the tutor's original voice and provider
        if (session._tutorVoiceBeforeCharacter) {
          session.voiceId = session._tutorVoiceBeforeCharacter;
          session._tutorVoiceBeforeCharacter = undefined;
        }
        if (session._tutorTtsProviderBeforeCharacter) {
          session.ttsProvider = session._tutorTtsProviderBeforeCharacter;
          session._tutorTtsProviderBeforeCharacter = undefined;
        }
        session.activeCharacter = null;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        // Notify client: back to tutor
        this.sendMessage(session.ws, {
          type: 'character_change',
          character: null,
          timestamp: Date.now(),
        });

        console.log(`[Native Function→ResumeTutor] Returned to tutor voice. voiceId=${session.voiceId}`);
        break;
      }

      case 'WORD_EMPHASIS': {
        const word = fn.args.word as string;
        const style = fn.args.style as 'stress' | 'slow' | 'both';
        const reason = fn.args.reason as string | undefined;
        
        if (word && style) {
          if (!session.pendingWordEmphases) {
            session.pendingWordEmphases = [];
          }
          session.pendingWordEmphases.push({ word, style });
          console.log(`[Native Function→WordEmphasis] Queued: "${word}" with style="${style}", reason="${reason || 'none'}"`);
        } else {
          console.warn(`[Native Function→WordEmphasis] Missing required args: word="${word}", style="${style}"`);
        }
        break;
      }
      
      case 'CHECK_STUDENT_CREDITS': {
        const text = fn.args.text as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }
        
        if (session.userId) {
          try {
            const balance = await usageService.getBalanceWithBypass(String(session.userId));
            const sessionElapsed = Math.floor((Date.now() - session.startTime) / 1000);
            const sessionMinutes = Math.floor(sessionElapsed / 60);
            const remainingHours = (balance.remainingSeconds / 3600).toFixed(1);
            const usedHours = (balance.usedSeconds / 3600).toFixed(1);
            const totalHours = (balance.totalSeconds / 3600).toFixed(1);
            
            const creditSummary = `[CREDIT CHECK RESULT] Remaining: ${remainingHours}h (${Math.round(balance.percentRemaining)}% left), Used: ${usedHours}h of ${totalHours}h total, This session: ${sessionMinutes} minutes, Status: ${balance.warningLevel === 'none' ? 'Healthy' : balance.warningLevel.toUpperCase()}`;
            
            session.lastCreditCheck = creditSummary;
            session.creditContextInjected = false;
            
            console.log(`[Native Function→CheckCredits] Balance: ${remainingHours}h remaining (${balance.warningLevel}), session: ${sessionMinutes}min, reason: ${reason || 'not specified'}`);
          } catch (err: any) {
            console.error(`[Native Function→CheckCredits] Error:`, err.message);
          }
        }
        break;
      }
      
      case 'CHANGE_CLASSROOM_PHOTO': {
        const text = fn.args.text as string | undefined;
        const scene = fn.args.scene as string | undefined;
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }
        
        if (scene) {
          import('./classroom-environment').then(async ({ setDanielaPhoto }) => {
            await setDanielaPhoto(scene);
            console.log(`[Native Function→ClassroomPhoto] Daniela changed her photo: "${scene.substring(0, 60)}..."`);
          }).catch(err => {
            console.error(`[Native Function→ClassroomPhoto] Error:`, err.message);
          });
        }
        break;
      }

      case 'CHANGE_CLASSROOM_WINDOW': {
        const text = fn.args.text as string | undefined;
        const scene = fn.args.scene as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (scene) {
          import('./classroom-environment').then(async ({ setClassroomWindow }) => {
            await setClassroomWindow(scene);
            console.log(`[Native Function→ClassroomWindow] Daniela changed her window view: "${scene.substring(0, 60)}..."`);
          }).catch(err => {
            console.error(`[Native Function→ClassroomWindow] Error:`, err.message);
          });
        }
        break;
      }
      
      case 'CALL_SUPPORT': {
        const category = fn.args.category as string;
        const reason = fn.args.reason as string | undefined;
        const priority = fn.args.priority as string || 'normal';
        console.log(`[Native Function Call] CALL_SUPPORT -> category: ${category}, priority: ${priority}`);
        
        session.pendingSupportHandoff = {
          category: category as 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other',
          reason: reason || 'Support requested',
          priority: priority as 'low' | 'normal' | 'high' | 'critical',
        };
        break;
      }
      
      case 'CALL_ASSISTANT': {
        const drillType = fn.args.type as string;
        const focus = fn.args.focus as string;
        const itemsStr = fn.args.items as string;
        const priority = fn.args.priority as string | undefined;
        
        if (drillType && focus && itemsStr) {
          const itemsList = itemsStr.split(',').map((item: string) => item.trim()).filter(Boolean);
          session.pendingAssistantHandoff = {
            drillType: drillType as 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order',
            focus,
            items: itemsList,
            priority: priority as 'low' | 'medium' | 'high' | undefined,
          };
          console.log(`[Native Function→AssistantHandoff] Delegated: ${drillType} drill for "${focus}" with ${itemsList.length} items`);
        }
        break;
      }
      
      case 'SUBTITLE': {
        const spokenText = fn.args.spoken_text as string | undefined;
        const mode = (fn.args.mode as string)?.toLowerCase();
        const customText = fn.args.text as string | undefined;
        
        if (mode === 'custom') {
          if (!customText || customText.trim() === '') {
            console.warn(`[Native Function→Subtitle] Custom mode requires text parameter, skipping`);
          } else {
            console.log(`[Native Function→Subtitle] Custom text display: "${customText.substring(0, 50)}..."`);
            session.customOverlayText = customText;
            this.sendMessage(session.ws, {
              type: 'custom_overlay',
              text: customText,
              action: 'show',
              timestamp: Date.now(),
            } as any, session);
          }
        } else if (mode && ['off', 'on', 'target'].includes(mode)) {
          const validMode = mode === 'on' ? 'all' : mode as 'off' | 'all' | 'target';
          session.subtitleMode = validMode;
          console.log(`[Native Function→Subtitle] Mode changed to: ${validMode} (session ${session.id})`);
          
          this.sendMessage(session.ws, {
            type: 'subtitle_mode_change',
            mode: validMode,
            timestamp: Date.now(),
          } as any, session);
          console.log(`[Native Function→Subtitle] ✓ Sent subtitle_mode_change via sendMessage: ${validMode}`);
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
          console.log(`[Native Function→Subtitle] Spoken text for TTS: "${spokenText.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'HOLD': {
        const text = fn.args.text as string | undefined;
        const hold = fn.args.hold as boolean | undefined;
        console.log(`[Native Function Call] HOLD -> ${hold}`);
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'hold', hold: hold !== false }],
        });
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Hold] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'SHOW': {
        const spokenText = fn.args.spoken_text as string | undefined;
        const content = (fn.args.content || fn.args.text) as string | undefined;
        const contentType = fn.args.contentType as string | undefined;
        if (content) {
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: contentType || 'write', content }],
          });
          console.log(`[Native Function Call] SHOW -> type: ${contentType}`);
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
          console.log(`[Native Function→Show] Spoken text included: "${spokenText.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'HIDE': {
        const text = fn.args.text as string | undefined;
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'clear' }],
        });
        console.log(`[Native Function Call] HIDE -> cleared overlay`);
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Hide] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'CLEAR': {
        const text = fn.args.text as string | undefined;
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'clear' }],
        });
        session.classroomWhiteboardItems = [];
        console.log(`[Native Function Call] CLEAR -> whiteboard cleared (classroom tracking reset)`);
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Clear] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'SHOW_IMAGE': {
        const text = fn.args.text as string | undefined;
        const word = (fn.args.word as string | undefined) || '';
        const translation = fn.args.translation as string | undefined;
        const latinScript = fn.args.latin_script as string | undefined;
        const description = fn.args.description as string | undefined;
        const scene = fn.args.scene as string | undefined;
        const context = fn.args.context as string | undefined;
        const rawLabelMode = fn.args.label_mode as string | undefined;
        const labelMode: 'teach' | 'target' | 'quiz' =
          rawLabelMode === 'quiz' ? 'quiz'
          : rawLabelMode === 'target' ? 'target'
          : 'teach';
        const rawLabels = fn.args.labels as { word: string; translation?: string; latin_script?: string }[] | undefined;
        const labels = Array.isArray(rawLabels) && rawLabels.length > 0
          ? rawLabels.map(l => ({ word: l.word, translation: l.translation, latinScript: l.latin_script }))
          : undefined;
        const rawSlot = fn.args.slot as string | undefined;
        const slot: 'scene' | 'context' | undefined =
          rawSlot === 'scene' ? 'scene'
          : rawSlot === 'context' ? 'context'
          : undefined;
        const category = fn.args.category as string | undefined;

        if (!word && !scene) {
          console.warn(`[Native Function→ShowImage] Missing word or scene parameter`);
          break;
        }

        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→ShowImage] Text included: "${text.substring(0, 50)}..."`);
        }

        const displayWord = word || (scene || '').split(' ').slice(0, 3).join(' ');
        console.log(`[Native Function→ShowImage] Resolving image for "${displayWord}" (scene: ${scene || 'none'})`);

        // Push to pendingMemoryLookupPromises so the orchestrator awaits resolution
        // before buildContinuationResponse runs — same pattern as recall_express_lane_image.
        const showImagePromise = (async () => {
          try {
            const { resolveVocabularyImage } = await import('../services/vocabulary-image-resolver');
            const result = await resolveVocabularyImage({
              word: displayWord,
              language: session.language || 'spanish',
              description: description || displayWord,
              scene,
              translation: translation,
              conversationId: session.conversationId?.toString(),
              userId: session.userId?.toString(),
            });
            
            console.log(`[Native Function→ShowImage] Resolved: ${result.source} for "${word}"`);
            
            const whiteboardUpdate = {
              type: 'whiteboard_update' as const,
              timestamp: Date.now(),
              items: [{
                type: 'image',
                content: word,
                data: {
                  word: result.word,
                  translation: translation,
                  latinScript: latinScript,
                  description: result.description,
                  imageUrl: result.imageUrl,
                  context: context,
                  source: result.source,
                  labelMode: labelMode,
                  labels: labels,
                  slot: slot,
                  category: category,
                },
              }],
            };
            
            if (session.firstAudioSent) {
              this.sendMessage(session.ws, whiteboardUpdate);
            } else {
              if (!session.pendingWhiteboardUpdates) {
                session.pendingWhiteboardUpdates = [];
              }
              session.pendingWhiteboardUpdates.push(whiteboardUpdate);
              console.log(`[Native Function→ShowImage] Buffered for audio sync`);
            }
            
            if (!session.classroomSessionImages) session.classroomSessionImages = [];
            session.classroomSessionImages.push(description || word);
            if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
            session.classroomWhiteboardItems.push({ type: 'image', content: word, label: description || word });

            // Vision system: give Daniela actual sight of the image she just showed the student
            if (result.imageUrl) {
              const { getImageVision } = await import('./image-vision-service');
              const visionDesc = result.description
                || `${displayWord}${translation ? ` (${translation})` : ''}${scene ? ` — ${scene}` : ''}`;
              const vision = await getImageVision(result.imageUrl, visionDesc, session);
              if (!session.visionBuffer) session.visionBuffer = {};
              session.visionBuffer['show_image'] = {
                url: result.imageUrl,
                description: vision.description,
                inlineData: vision.inlineData,
              };
              console.log(`[Vision→ShowImage] Mode: ${vision.mode} for "${displayWord}"`);
            }
          } catch (err: any) {
            console.error(`[Native Function→ShowImage] Error:`, err.message);
          }
        })();
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(showImagePromise as Promise<void>);
        break;
      }

      case 'GENERATE_VISUAL': {
        // Legacy path — now routed through the unified show_image resolver.
        // generate_visual is no longer exposed in the function registry; this case
        // handles any in-flight calls or backward-compat scenarios.
        const concept = fn.args.concept as string | undefined;
        const text = fn.args.text as string | undefined;

        if (!concept) {
          console.warn(`[Native Function→GenerateVisual] Missing concept param — skipping`);
          break;
        }

        const IMAGE_DESC_PREFIXES = ['illustration depicting', 'educational infographic', 'image showing', 'photo of', 'visual of'];
        const isImageDesc = text ? IMAGE_DESC_PREFIXES.some(p => text.toLowerCase().startsWith(p)) : false;
        if (text && !isImageDesc && !session.functionCallText) {
          session.functionCallText = text;
        } else if (text && isImageDesc) {
          console.warn(`[Native Function→GenerateVisual] Rejecting image-description text as speech`);
        }

        console.log(`[Native Function→GenerateVisual] Routing through unified resolver for: "${concept}"`);

        // Derive a short label from the concept for the whiteboard card
        const conceptLabel = (() => {
          const firstPhrase = concept.split(/[,;]/)[0].trim();
          return firstPhrase.length <= 45 ? firstPhrase : firstPhrase.substring(0, 42) + '…';
        })();

        import('../services/vocabulary-image-resolver').then(async ({ resolveVocabularyImage }) => {
          try {
            const result = await resolveVocabularyImage({
              word: conceptLabel,
              language: session.language || 'spanish',
              description: concept,
              scene: concept,
              userId: session.userId?.toString(),
            });

            const whiteboardUpdate = {
              type: 'whiteboard_update' as const,
              timestamp: Date.now(),
              items: [{
                type: 'image',
                content: conceptLabel,
                data: {
                  word: conceptLabel,
                  description: concept,
                  imageUrl: result.imageUrl,
                  source: result.source,
                  labelMode: 'quiz' as const,
                },
              }],
            };

            if (session.firstAudioSent) {
              this.sendMessage(session.ws, whiteboardUpdate);
            } else {
              if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
              session.pendingWhiteboardUpdates.push(whiteboardUpdate);
              console.log(`[Native Function→GenerateVisual] Buffered for audio sync`);
            }

            if (!session.classroomSessionImages) session.classroomSessionImages = [];
            session.classroomSessionImages.push(concept);
            if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
            session.classroomWhiteboardItems.push({ type: 'image', content: concept, label: conceptLabel });
          } catch (err: any) {
            console.error(`[Native Function→GenerateVisual] Error:`, err.message);
          }
        });
        break;
      }

      case 'COMPOSE_VISUAL': {
        const environment = fn.args.environment as string | undefined;
        const objects = (fn.args.objects as any[] | undefined) ?? [];
        const prepCtx = fn.args.preposition_context as string | undefined;
        const text = fn.args.text as string | undefined;

        if (!environment || objects.length === 0) {
          console.warn(`[Native Function→ComposeVisual] Missing environment or objects — skipping`);
          break;
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        console.log(`[Native Function→ComposeVisual] Composing scene: ${environment} + ${objects.map((o: any) => o.term).join(', ')}`);

        import('../services/prop-room-compositor').then(async ({ composeVisualScene }) => {
          try {
            const result = await composeVisualScene({
              environment,
              objects,
              preposition_context: prepCtx,
              language: session.targetLanguage || 'spanish',
            });

            let imageUrl: string;
            let sourceName: string;

            if (result.success && result.imageUrl) {
              imageUrl = result.imageUrl;
              sourceName = result.source === 'pre_composed' ? 'prop_room_cached' : 'prop_room_composed';
              console.log(`[Native Function→ComposeVisual] ${result.cacheHit ? 'Cache hit' : 'Composed'}: ${imageUrl}`);
            } else {
              // Fallback: delegate to generate_visual with a descriptive prompt
              console.log(`[Native Function→ComposeVisual] Falling back to DALL-E — ${result.error || ('missing: ' + (result.missingAssets || []).join(', '))}`);
              // Build a pedagogically explicit prompt — if this is a preposition lesson, describe
              // the spatial relationship clearly enough that DALL-E can render it usefully
              const objectTerms = objects.map((o: any) => o.term).join(', ');
              const envLabel = environment.replace(/_/g, ' ');
              let fallbackConcept: string;
              if (prepCtx && objects.length > 0) {
                // Map preposition context to explicit spatial instruction DALL-E can follow
                const positionMap: Record<string, string> = {
                  under_table: 'on the floor directly beneath the table',
                  under_counter: 'on the floor beneath the counter',
                  on_table: 'resting on top of the table surface',
                  on_counter: 'sitting on top of the counter',
                  on_floor: 'placed on the floor',
                  on_chair: 'placed on the seat of a chair',
                  beside_table: 'standing on the floor beside the table',
                  beside_bed: 'on the floor beside the bed',
                  in_hand: 'held in a hand',
                };
                const firstObj = objects[0];
                const spatialDesc = positionMap[firstObj.position] || `near the ${envLabel}`;
                // View angle: side-on is best for under/beside, top-down for on_table
                const viewHint = (firstObj.position || '').startsWith('under') ? 'viewed from the side so the table and floor are both clearly visible, ' : '';
                fallbackConcept = `educational illustration for a language lesson — a ${envLabel} scene. ${objectTerms} is ${spatialDesc}. ${viewHint}The image should clearly demonstrate the "${prepCtx}" (${firstObj.position?.replace(/_/g, ' ')}) spatial relationship so a language student can immediately understand the position. Clean simple composition.`;
              } else {
                fallbackConcept = `${envLabel} scene with ${objectTerms}${prepCtx ? `, showing "${prepCtx}" relationship` : ''}`;
              }
              const { generateVisual } = await import('../services/visual-content-service');
              const { archiveImageToPermanentStorage } = await import('../services/image-storage');
              const crypto = await import('crypto');
              const genResult = await generateVisual(fallbackConcept, 'image', {}, 'warm, friendly educational illustration, clear spatial composition');
              const hash = crypto.createHash('md5').update('compose_' + fallbackConcept + Date.now()).digest('hex');
              const archivedFilename = `${hash}.jpg`;
              try {
                imageUrl = await archiveImageToPermanentStorage(genResult.imageUrl, archivedFilename);
              } catch {
                imageUrl = genResult.imageUrl;
              }
              sourceName = 'dalle_fallback';
              // Save to media_files library (same as generate_visual does) so it's findable later
              try {
                const shortLabel = fallbackConcept.split(/[,;]/)[0].trim().substring(0, 60);
                await storage.cacheImage({
                  uploadedBy: null,
                  mediaType: 'image',
                  url: imageUrl,
                  thumbnailUrl: null,
                  filename: archivedFilename,
                  mimeType: 'image/jpeg',
                  title: shortLabel,
                  description: fallbackConcept,
                  tags: [environment, ...objects.map((o: any) => o.term), ...(prepCtx ? [prepCtx] : [])],
                  language: session.targetLanguage || null,
                  imageSource: 'ai_generated',
                  promptHash: null,
                  attributionJson: null,
                  usageCount: 1,
                });
                console.log(`[Native Function→ComposeVisual] Fallback image saved to media library: "${shortLabel}"`);
              } catch (saveErr: any) {
                console.warn(`[Native Function→ComposeVisual] Failed to save fallback to library:`, saveErr.message);
              }
            }

            const label = `${environment.replace(/_/g, ' ')}: ${objects.map((o: any) => o.term).join(', ')}`;
            const whiteboardUpdate = {
              type: 'whiteboard_update' as const,
              timestamp: Date.now(),
              items: [{
                type: 'image',
                content: label,
                data: {
                  word: label,
                  description: label,
                  imageUrl,
                  source: sourceName,
                  semanticTags: [environment, ...objects.map((o: any) => o.term)],
                  accessibilityDescription: label,
                  conceptAlignment: 0.95,
                },
              }],
            };
            if (session.firstAudioSent) {
              this.sendMessage(session.ws, whiteboardUpdate);
            } else {
              if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
              session.pendingWhiteboardUpdates.push(whiteboardUpdate);
            }
            if (!session.classroomSessionImages) session.classroomSessionImages = [];
            session.classroomSessionImages.push(label);
          } catch (err: any) {
            console.error(`[Native Function→ComposeVisual] Error:`, err.message);
          }
        });
        break;
      }

      case 'SEARCH_VISUAL_LIBRARY': {
        const term = fn.args.term as string | undefined;
        if (!term) break;
        import('../services/prop-room-compositor').then(async ({ searchVisualLibrary }) => {
          try {
            const results = await searchVisualLibrary(term, session.targetLanguage || 'spanish');
            // Results are consumed by the continuation response built in the registry
            console.log(`[Native Function→SearchVisualLibrary] "${term}": ${results.environments.length} envs, ${results.assets.length} assets`);
            session.lastVisualLibrarySearch = results;
          } catch (err: any) {
            console.error(`[Native Function→SearchVisualLibrary] Error:`, err.message);
          }
        });
        break;
      }

      // ─── Interactive Scene Canvas ────────────────────────────────────────
      // Position map (mirrors prop-room-compositor.ts POSITION_MAP)
      // Used to resolve cx/cy/scale server-side before sending to client.
      case 'OPEN_SCENE': {
        const sceneEnv = fn.args.environment as string | undefined;
        const sceneLabel = fn.args.label as string | undefined;
        const sceneText = fn.args.text as string | undefined;
        if (sceneText && !session.functionCallText) session.functionCallText = sceneText;
        if (!sceneEnv) {
          console.warn('[Native Function→OpenScene] Missing environment — skipping');
          break;
        }
        const { getUserDb } = await import('../db');
        const { sql: sqlTag } = await import('drizzle-orm');
        const openDb = getUserDb();
        try {
          const envResult = await openDb.execute(sqlTag`
            SELECT image_url, display_name FROM visual_environments WHERE name = ${sceneEnv} LIMIT 1
          `);
          const envRow = envResult.rows[0] as any;
          const envImageUrl = envRow?.image_url as string | undefined;
          if (!envImageUrl) {
            console.warn(`[Native Function→OpenScene] No image_url for environment "${sceneEnv}"`);
            break;
          }
          const envDisplayName = (envRow as any)?.display_name as string | undefined;
          session.sceneCanvas = {
            environment: sceneEnv,
            environmentImageUrl: envImageUrl,
            environmentLabel: sceneLabel || envDisplayName || sceneEnv.replace(/_/g, ' '),
            props: [],
            clockTime: undefined,
          };
          const openSceneUpdate = {
            type: 'whiteboard_update' as const,
            timestamp: Date.now(),
            items: [{
              id: 'scene-canvas-active',
              type: 'scene_canvas',
              content: sceneLabel || sceneEnv.replace(/_/g, ' '),
              data: {
                environment: sceneEnv,
                environmentImageUrl: envImageUrl,
                environmentLabel: session.sceneCanvas.environmentLabel,
                props: [],
                canvasAction: 'open_scene' as const,
              },
            }],
          };
          if (session.firstAudioSent) {
            this.sendMessage(session.ws, openSceneUpdate);
          } else {
            if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
            session.pendingWhiteboardUpdates.push(openSceneUpdate);
          }
          console.log(`[Native Function→OpenScene] Opened: ${sceneEnv}`);

          // Vision system: fetch background image bytes so Daniela can see the environment
          const openSceneVisionPromise = (async () => {
            try {
              const { getImageVision, buildSceneStateText } = await import('./image-vision-service');
              const envLabel = session.sceneCanvas?.environmentLabel || sceneEnv.replace(/_/g, ' ');
              const vision = await getImageVision(
                envImageUrl,
                `Scene background: ${envLabel}`,
                session,
              );
              const sceneStateText = buildSceneStateText(
                session.sceneCanvas,
                { action: `Scene opened: ${envLabel}` },
              );
              if (!session.visionBuffer) session.visionBuffer = {};
              session.visionBuffer['open_scene'] = {
                url: envImageUrl,
                description: vision.description,
                inlineData: vision.inlineData,
                sceneStateText,
              };
              console.log(`[Vision→OpenScene] Mode: ${vision.mode} for "${sceneEnv}"`);
            } catch (err: any) {
              console.error('[Vision→OpenScene] Error:', err.message);
            }
          })();
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(openSceneVisionPromise as Promise<void>);
        } catch (err: any) {
          console.error('[Native Function→OpenScene] Error:', err.message);
        }
        break;
      }

      case 'ADD_TO_SCENE': {
        const addPropName = fn.args.prop_name as string | undefined;
        const addPosition = (fn.args.position as string | undefined) || 'center';
        const addLabel = fn.args.label as string | undefined;
        const addNativeLabel = fn.args.native_label as string | undefined;
        const addText = fn.args.text as string | undefined;
        const addRotate = fn.args.rotate as number | undefined;
        const addFlipH = fn.args.flip_h as boolean | undefined;
        const addZ = fn.args.z as number | undefined;
        if (addText && !session.functionCallText) session.functionCallText = addText;
        if (!addPropName) {
          console.warn('[Native Function→AddToScene] Missing prop_name — skipping');
          break;
        }
        const CANVAS_POSITION_MAP: Record<string, { cx: number; cy: number; scale: number }> = {
          // ── Generic positions ──────────────────────────────────────────────
          center:        { cx: 0.50, cy: 0.65, scale: 0.20 },
          left:          { cx: 0.25, cy: 0.68, scale: 0.16 },
          right:         { cx: 0.75, cy: 0.68, scale: 0.16 },
          foreground:    { cx: 0.50, cy: 0.82, scale: 0.28 },
          background:    { cx: 0.50, cy: 0.35, scale: 0.12 },
          on_table:      { cx: 0.50, cy: 0.70, scale: 0.14 },
          under_table:   { cx: 0.38, cy: 0.84, scale: 0.18 },
          on_floor:      { cx: 0.50, cy: 0.87, scale: 0.22 },
          beside_bed:    { cx: 0.72, cy: 0.74, scale: 0.14 },
          on_counter:    { cx: 0.52, cy: 0.68, scale: 0.14 },
          under_counter: { cx: 0.45, cy: 0.84, scale: 0.12 },
          in_hand:       { cx: 0.50, cy: 0.62, scale: 0.12 },
          on_chair:      { cx: 0.50, cy: 0.74, scale: 0.14 },
          beside_table:  { cx: 0.70, cy: 0.80, scale: 0.14 },
          // ── Restaurant table place-setting positions ───────────────────────
          // Imagining student seated at the near edge of the table:
          //   [bread_corner]  [glass_spot]  [condiment_1][condiment_2]
          //   [side_plate]                  [condiment_3][condiment_4]
          //   [place_left]  [main plate]    [place_right]
          place_left:    { cx: 0.30, cy: 0.72, scale: 0.09 }, // fork (generic left)
          place_right:   { cx: 0.68, cy: 0.72, scale: 0.09 }, // knife (generic right)
          // ── Individual utensil spots (use these for precision placement) ──
          napkin_spot:   { cx: 0.23, cy: 0.73, scale: 0.09 }, // napkin — far left of fork
          fork_spot:     { cx: 0.31, cy: 0.72, scale: 0.08 }, // fork — left of plate
          knife_spot:    { cx: 0.59, cy: 0.72, scale: 0.08 }, // knife — right of plate
          spoon_spot:    { cx: 0.67, cy: 0.71, scale: 0.08 }, // spoon — right of knife
          glass_spot:    { cx: 0.62, cy: 0.57, scale: 0.13 }, // water glass / wine glass
          bread_corner:  { cx: 0.22, cy: 0.58, scale: 0.15 }, // bread basket, upper-left
          // ── Side / bread plate — lower-left of main plate ─────────────────
          side_plate:          { cx: 0.22, cy: 0.70, scale: 0.13 }, // the plate prop itself
          on_side_plate:       { cx: 0.22, cy: 0.70, scale: 0.08 }, // item centered on side plate
          on_side_plate_left:  { cx: 0.17, cy: 0.71, scale: 0.07 }, // left of side plate
          on_side_plate_right: { cx: 0.27, cy: 0.71, scale: 0.07 }, // right of side plate
          // ── Condiment cluster — back-right corner of table ─────────────────
          condiment_1:   { cx: 0.78, cy: 0.56, scale: 0.10 },
          condiment_2:   { cx: 0.86, cy: 0.60, scale: 0.10 },
          condiment_3:   { cx: 0.78, cy: 0.49, scale: 0.09 },
          condiment_4:   { cx: 0.86, cy: 0.52, scale: 0.09 },
          // ── Main plate — 5 sub-zones for multi-item meals ──────────────────
          // Use on_plate for the first/main item, then spread extras across the zone.
          on_plate:            { cx: 0.46, cy: 0.70, scale: 0.11 }, // center (primary item)
          on_plate_top_left:   { cx: 0.40, cy: 0.66, scale: 0.08 }, // e.g. eggs top-left
          on_plate_top_right:  { cx: 0.52, cy: 0.66, scale: 0.08 }, // e.g. bacon top-right
          on_plate_left:       { cx: 0.38, cy: 0.71, scale: 0.08 }, // e.g. ham left
          on_plate_right:      { cx: 0.54, cy: 0.71, scale: 0.08 }, // e.g. garnish right
        };
        let addPos = CANVAS_POSITION_MAP[addPosition] || CANVAS_POSITION_MAP.center;
        let autoSpreadOccurred = false; // vision tracking: did auto-spread fire?
        // Auto-spread: if requested position is already occupied by an existing prop,
        // cycle through fallback slots so items don't stack on top of each other
        if (session.sceneCanvas?.props?.length) {
          const SPREAD_FALLBACK: Array<{ cx: number; cy: number; scale: number }> = [
            { cx: 0.25, cy: 0.68, scale: 0.16 }, // left
            { cx: 0.50, cy: 0.65, scale: 0.20 }, // center
            { cx: 0.75, cy: 0.68, scale: 0.16 }, // right
            { cx: 0.30, cy: 0.72, scale: 0.09 }, // place_left
            { cx: 0.68, cy: 0.72, scale: 0.09 }, // place_right
            { cx: 0.78, cy: 0.56, scale: 0.10 }, // condiment_1
            { cx: 0.86, cy: 0.60, scale: 0.10 }, // condiment_2
            { cx: 0.22, cy: 0.58, scale: 0.15 }, // bread_corner
            { cx: 0.50, cy: 0.82, scale: 0.22 }, // foreground
          ];
          const isTooClose = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
            Math.abs(a.cx - b.cx) < 0.12 && Math.abs(a.cy - b.cy) < 0.12;
          const existingProps = session.sceneCanvas.props.filter((p: any) => p.name !== addPropName);
          if (existingProps.some((p: any) => isTooClose(addPos, p))) {
            const available = SPREAD_FALLBACK.find(slot => !existingProps.some((p: any) => isTooClose(slot, p)));
            if (available) {
              console.log(`[Native Function→AddToScene] Auto-repositioning "${addPropName}" to avoid overlap`);
              addPos = available;
              autoSpreadOccurred = true;
            }
          }
        }
        const { getUserDb: getDbForAdd } = await import('../db');
        const { sql: sqlForAdd } = await import('drizzle-orm');
        const addDb = getDbForAdd();
        try {
          const assetResult = await addDb.execute(sqlForAdd`
            SELECT zone_image_url, image_url, display_name FROM visual_assets
            WHERE (name = ${addPropName} OR display_name ILIKE ${addPropName})
              AND zone_image_url IS NOT NULL
            LIMIT 1
          `);
          const assetRow = assetResult.rows[0] as any;
          let propImageUrl = assetRow?.zone_image_url as string | undefined;
          if (!propImageUrl) {
            // Not in the pre-loaded library — generate on the fly with AI
            console.log(`[Native Function→AddToScene] No visual asset for "${addPropName}" — generating with AI...`);
            try {
              if (!session.generatedPropCache) session.generatedPropCache = {} as Record<string, string>;
              if (session.generatedPropCache[addPropName]) {
                propImageUrl = session.generatedPropCache[addPropName];
                console.log(`[Native Function→AddToScene] Using cached generated image for "${addPropName}"`);
              } else {
                const { generatePropImage } = await import('./google-image-service');
                propImageUrl = await generatePropImage(addPropName);
                session.generatedPropCache[addPropName] = propImageUrl;
                console.log(`[Native Function→AddToScene] Generated prop image for "${addPropName}": ${propImageUrl}`);
              }
            } catch (genErr: any) {
              console.error(`[Native Function→AddToScene] Failed to generate prop "${addPropName}":`, genErr.message);
              break;
            }
          }
          const propDisplayName = addLabel || (assetRow as any)?.display_name as string || addPropName;
          if (!session.sceneCanvas) {
            console.warn('[Native Function→AddToScene] No active scene canvas — call open_scene first');
            break;
          }
          const existingIdx = session.sceneCanvas.props.findIndex((p: any) => p.name === addPropName);
          const newProp: Record<string, any> = {
            name: addPropName,
            label: propDisplayName,
            position: addPosition,
            cx: addPos.cx,
            cy: addPos.cy,
            scale: addPos.scale,
            imageUrl: propImageUrl,
          };
          if (addNativeLabel) newProp.nativeLabel = addNativeLabel;
          if (addRotate !== undefined) newProp.rotate = Math.max(0, Math.min(359, Math.round(addRotate)));
          if (addFlipH) newProp.flipH = true;
          if (addZ !== undefined) newProp.z = Math.max(1, Math.min(10, Math.round(addZ)));
          if (existingIdx >= 0) {
            session.sceneCanvas.props[existingIdx] = newProp;
          } else {
            session.sceneCanvas.props.push(newProp);
          }
          const addUpdate = {
            type: 'whiteboard_update' as const,
            timestamp: Date.now(),
            items: [{
              id: 'scene-canvas-active',
              type: 'scene_canvas',
              content: session.sceneCanvas.environmentLabel || session.sceneCanvas.environment,
              data: {
                environment: session.sceneCanvas.environment,
                environmentImageUrl: session.sceneCanvas.environmentImageUrl,
                environmentLabel: session.sceneCanvas.environmentLabel,
                props: [...session.sceneCanvas.props],
                clockTime: session.sceneCanvas.clockTime,
                canvasAction: 'add_prop' as const,
              },
            }],
          };
          if (session.firstAudioSent) {
            this.sendMessage(session.ws, addUpdate);
          } else {
            if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
            session.pendingWhiteboardUpdates.push(addUpdate);
          }
          console.log(`[Native Function→AddToScene] Added "${addPropName}" at ${addPosition}`);

          // Vision system: give Daniela sight of the new prop + full Tier-1 scene state
          const addToSceneVisionPromise = (async () => {
            try {
              const { getImageVision, buildSceneStateText } = await import('./image-vision-service');
              // Reverse-lookup the final position name for auto-spread reporting
              const resolvedPositionName = autoSpreadOccurred
                ? (Object.entries(CANVAS_POSITION_MAP).find(
                    ([, v]) => Math.abs(v.cx - addPos.cx) < 0.001 && Math.abs(v.cy - addPos.cy) < 0.001,
                  )?.[0] || 'repositioned')
                : addPosition;
              // Only fetch prop image bytes if this prop type hasn't been seen this session
              const propVision = propImageUrl
                ? await getImageVision(propImageUrl, propDisplayName, session)
                : null;
              const sceneStateText = buildSceneStateText(session.sceneCanvas, {
                action: `Prop added: ${propDisplayName}`,
                autoSpreadProp: autoSpreadOccurred ? addPropName : undefined,
                requestedPos: autoSpreadOccurred ? addPosition : undefined,
                finalPos: autoSpreadOccurred ? resolvedPositionName : undefined,
              });
              if (!session.visionBuffer) session.visionBuffer = {};
              session.visionBuffer['add_to_scene'] = {
                url: propImageUrl || '',
                description: propDisplayName,
                inlineData: propVision?.inlineData,
                sceneStateText,
              };
              console.log(`[Vision→AddToScene] Prop "${addPropName}" vision mode: ${propVision?.mode || 'no-url'}${autoSpreadOccurred ? ` (auto-spread → ${resolvedPositionName})` : ''}`);
            } catch (err: any) {
              console.error('[Vision→AddToScene] Error:', err.message);
            }
          })();
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(addToSceneVisionPromise as Promise<void>);
        } catch (err: any) {
          console.error('[Native Function→AddToScene] Error:', err.message);
        }
        break;
      }

      case 'REMOVE_FROM_SCENE': {
        const removePropName = fn.args.prop_name as string | undefined;
        const removeText = fn.args.text as string | undefined;
        if (removeText && !session.functionCallText) session.functionCallText = removeText;
        if (!removePropName || !session.sceneCanvas) break;
        session.sceneCanvas.props = session.sceneCanvas.props.filter((p: any) => p.name !== removePropName);
        const removeUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: session.sceneCanvas.environmentLabel || session.sceneCanvas.environment,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [...session.sceneCanvas.props],
              clockTime: session.sceneCanvas.clockTime,
              canvasAction: 'remove_prop' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, removeUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(removeUpdate);
        }
        console.log(`[Native Function→RemoveFromScene] Removed "${removePropName}"`);
        break;
      }

      case 'MOVE_IN_SCENE': {
        const movePropName = fn.args.prop_name as string | undefined;
        const movePosition = (fn.args.new_position as string | undefined) || 'center';
        const moveText = fn.args.text as string | undefined;
        if (moveText && !session.functionCallText) session.functionCallText = moveText;
        if (!movePropName || !session.sceneCanvas?.props?.length) break;
        const MOVE_POSITION_MAP: Record<string, { cx: number; cy: number; scale: number }> = {
          center:        { cx: 0.50, cy: 0.65, scale: 0.20 },
          left:          { cx: 0.25, cy: 0.68, scale: 0.16 },
          right:         { cx: 0.75, cy: 0.68, scale: 0.16 },
          foreground:    { cx: 0.50, cy: 0.82, scale: 0.28 },
          background:    { cx: 0.50, cy: 0.35, scale: 0.12 },
          on_table:      { cx: 0.50, cy: 0.70, scale: 0.14 },
          under_table:   { cx: 0.38, cy: 0.84, scale: 0.18 },
          on_floor:      { cx: 0.50, cy: 0.87, scale: 0.22 },
          beside_bed:    { cx: 0.72, cy: 0.74, scale: 0.14 },
          on_counter:    { cx: 0.52, cy: 0.68, scale: 0.14 },
          under_counter: { cx: 0.45, cy: 0.84, scale: 0.12 },
          in_hand:       { cx: 0.50, cy: 0.62, scale: 0.12 },
          on_chair:      { cx: 0.50, cy: 0.74, scale: 0.14 },
          beside_table:  { cx: 0.70, cy: 0.80, scale: 0.14 },
          place_left:    { cx: 0.30, cy: 0.72, scale: 0.09 },
          place_right:   { cx: 0.68, cy: 0.72, scale: 0.09 },
          napkin_spot:   { cx: 0.23, cy: 0.73, scale: 0.09 },
          fork_spot:     { cx: 0.31, cy: 0.72, scale: 0.08 },
          knife_spot:    { cx: 0.59, cy: 0.72, scale: 0.08 },
          spoon_spot:    { cx: 0.67, cy: 0.71, scale: 0.08 },
          glass_spot:    { cx: 0.62, cy: 0.57, scale: 0.13 },
          bread_corner:  { cx: 0.22, cy: 0.58, scale: 0.15 },
          side_plate:          { cx: 0.22, cy: 0.70, scale: 0.13 },
          on_side_plate:       { cx: 0.22, cy: 0.70, scale: 0.08 },
          on_side_plate_left:  { cx: 0.17, cy: 0.71, scale: 0.07 },
          on_side_plate_right: { cx: 0.27, cy: 0.71, scale: 0.07 },
          condiment_1:   { cx: 0.78, cy: 0.56, scale: 0.10 },
          condiment_2:   { cx: 0.86, cy: 0.60, scale: 0.10 },
          condiment_3:   { cx: 0.78, cy: 0.49, scale: 0.09 },
          condiment_4:   { cx: 0.86, cy: 0.52, scale: 0.09 },
          on_plate:            { cx: 0.46, cy: 0.70, scale: 0.11 },
          on_plate_top_left:   { cx: 0.40, cy: 0.66, scale: 0.08 },
          on_plate_top_right:  { cx: 0.52, cy: 0.66, scale: 0.08 },
          on_plate_left:       { cx: 0.38, cy: 0.71, scale: 0.08 },
          on_plate_right:      { cx: 0.54, cy: 0.71, scale: 0.08 },
        };
        const propIdx = session.sceneCanvas.props.findIndex((p: any) => p.name === movePropName);
        if (propIdx < 0) {
          console.warn(`[Native Function→MoveInScene] Prop "${movePropName}" not in scene — skipping`);
          break;
        }
        const newPos = MOVE_POSITION_MAP[movePosition] || MOVE_POSITION_MAP.center;
        session.sceneCanvas.props[propIdx] = {
          ...session.sceneCanvas.props[propIdx],
          position: movePosition,
          cx: newPos.cx,
          cy: newPos.cy,
          scale: newPos.scale,
        };
        const moveUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: session.sceneCanvas.environmentLabel || session.sceneCanvas.environment,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [...session.sceneCanvas.props],
              clockTime: session.sceneCanvas.clockTime,
              canvasAction: 'move_prop' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, moveUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(moveUpdate);
        }
        console.log(`[Native Function→MoveInScene] Moved "${movePropName}" to ${movePosition}`);
        break;
      }

      case 'CLEAR_SCENE': {
        const clearText = fn.args.text as string | undefined;
        if (clearText && !session.functionCallText) session.functionCallText = clearText;
        if (!session.sceneCanvas) break;
        session.sceneCanvas.props = [];
        session.sceneCanvas.clockTime = undefined;
        const clearUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: session.sceneCanvas.environmentLabel || session.sceneCanvas.environment,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [],
              canvasAction: 'clear_scene' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, clearUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(clearUpdate);
        }
        console.log('[Native Function→ClearScene] Props cleared, background remains');
        break;
      }

      case 'SET_CLOCK': {
        const clockTime = fn.args.time as string | undefined;
        const clockText = fn.args.text as string | undefined;
        if (clockText && !session.functionCallText) session.functionCallText = clockText;
        if (!clockTime) {
          console.warn('[Native Function→SetClock] Missing time — skipping');
          break;
        }
        if (!session.sceneCanvas) {
          session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [], clockTime: undefined };
        }
        session.sceneCanvas.clockTime = clockTime;
        const clockUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: `Clock: ${clockTime}`,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [...(session.sceneCanvas.props || [])],
              clockTime,
              canvasAction: 'set_clock' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, clockUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(clockUpdate);
        }
        console.log(`[Native Function→SetClock] Time set to ${clockTime}`);
        break;
      }
      // ─── Phase 2 Grammar Canvas Handlers ──────────────────────────────────

      case 'INIT_CONJUGATION': {
        const verb = fn.args.verb as string | undefined;
        const tense = fn.args.tense as string | undefined;
        const pronouns = fn.args.pronouns as string[] | undefined;
        const initText = fn.args.text as string | undefined;
        if (initText && !session.functionCallText) session.functionCallText = initText;
        if (!verb || !tense || !pronouns?.length) {
          console.warn('[Native Function→InitConjugation] Missing verb, tense, or pronouns — skipping');
          break;
        }
        if (!session.sceneCanvas) {
          session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        }
        session.sceneCanvas.conjugationTable = {
          verb,
          tense,
          cells: pronouns.map((p: string) => ({ pronoun: p, form: null })),
        };
        const initConjUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: `${verb} — ${tense}`,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [...(session.sceneCanvas.props || [])],
              clockTime: session.sceneCanvas.clockTime,
              conjugationTable: session.sceneCanvas.conjugationTable,
              canvasAction: 'init_conjugation' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, initConjUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(initConjUpdate);
        }
        console.log(`[Native Function→InitConjugation] ${verb} (${tense}) — ${pronouns.length} rows`);
        break;
      }

      case 'FILL_CONJUGATION': {
        const pronoun = fn.args.pronoun as string | undefined;
        const form = fn.args.form as string | undefined;
        const highlightPronoun = fn.args.highlightPronoun as string | undefined;
        const fillText = fn.args.text as string | undefined;
        if (fillText && !session.functionCallText) session.functionCallText = fillText;
        if (!pronoun || !form || !session.sceneCanvas?.conjugationTable) {
          console.warn('[Native Function→FillConjugation] Missing data or no active table — skipping');
          break;
        }
        const table = session.sceneCanvas.conjugationTable;
        const cells = table.cells.map((c: any) => ({
          ...c,
          isNew: false,
          form: c.pronoun === pronoun ? form : c.form,
          isNew2: c.pronoun === pronoun ? true : false,
        }));
        // rename isNew2 → isNew (avoid rename issues)
        const updatedCells = cells.map((c: any) => ({ pronoun: c.pronoun, pronounAlt: c.pronounAlt, form: c.form, isNew: c.isNew2 }));
        table.cells = updatedCells;
        if (highlightPronoun !== undefined) table.highlightPronoun = highlightPronoun;
        const fillUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: `${table.verb} — ${pronoun}: ${form}`,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [...(session.sceneCanvas.props || [])],
              clockTime: session.sceneCanvas.clockTime,
              conjugationTable: { ...table, cells: updatedCells, highlightPronoun: highlightPronoun ?? table.highlightPronoun },
              canvasAction: 'fill_conjugation' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, fillUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(fillUpdate);
        }
        console.log(`[Native Function→FillConjugation] ${pronoun} → ${form}`);
        break;
      }

      case 'CLEAR_CONJUGATION': {
        const clearConjText = fn.args.text as string | undefined;
        if (clearConjText && !session.functionCallText) session.functionCallText = clearConjText;
        if (session.sceneCanvas) {
          delete session.sceneCanvas.conjugationTable;
        }
        const clearConjUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: '',
            data: {
              environment: session.sceneCanvas?.environment || '',
              environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '',
              environmentLabel: session.sceneCanvas?.environmentLabel || '',
              props: [...(session.sceneCanvas?.props || [])],
              clockTime: session.sceneCanvas?.clockTime,
              canvasAction: 'clear_conjugation' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, clearConjUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(clearConjUpdate);
        }
        console.log('[Native Function→ClearConjugation] Table cleared');
        break;
      }

      case 'SET_CALENDAR': {
        const calMonth = fn.args.month as string | undefined;
        const calMonthNumber = fn.args.monthNumber as number | undefined;
        const calYear = fn.args.year as number | undefined;
        const calDayNames = fn.args.dayNames as string[] | undefined;
        const calHighlightDay = fn.args.highlightDay as number | undefined;
        const calHighlightDowIndex = fn.args.highlightDowIndex as number | undefined;
        const calMarkedDays = fn.args.markedDays as number[] | undefined;
        const calStartDow = fn.args.startDow as number | undefined;
        const calText = fn.args.text as string | undefined;
        if (calText && !session.functionCallText) session.functionCallText = calText;
        if (!calMonth || !calMonthNumber || !calYear || !calDayNames?.length) {
          console.warn('[Native Function→SetCalendar] Missing required calendar data — skipping');
          break;
        }
        if (!session.sceneCanvas) {
          session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        }
        session.sceneCanvas.calendarData = {
          month: calMonth,
          monthNumber: calMonthNumber,
          year: calYear,
          dayNames: calDayNames,
          highlightDay: calHighlightDay,
          highlightDowIndex: calHighlightDowIndex,
          markedDays: calMarkedDays,
          startDow: calStartDow,
        };
        const calUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: `${calMonth} ${calYear}`,
            data: {
              environment: session.sceneCanvas.environment,
              environmentImageUrl: session.sceneCanvas.environmentImageUrl,
              environmentLabel: session.sceneCanvas.environmentLabel,
              props: [...(session.sceneCanvas.props || [])],
              clockTime: session.sceneCanvas.clockTime,
              calendarData: session.sceneCanvas.calendarData,
              canvasAction: 'set_calendar' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, calUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(calUpdate);
        }
        console.log(`[Native Function→SetCalendar] ${calMonth} ${calYear}${calHighlightDay ? `, day ${calHighlightDay}` : ''}`);
        break;
      }

      case 'CLEAR_CALENDAR': {
        const clearCalText = fn.args.text as string | undefined;
        if (clearCalText && !session.functionCallText) session.functionCallText = clearCalText;
        if (session.sceneCanvas) {
          delete session.sceneCanvas.calendarData;
        }
        const clearCalUpdate = {
          type: 'whiteboard_update' as const,
          timestamp: Date.now(),
          items: [{
            id: 'scene-canvas-active',
            type: 'scene_canvas',
            content: '',
            data: {
              environment: session.sceneCanvas?.environment || '',
              environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '',
              environmentLabel: session.sceneCanvas?.environmentLabel || '',
              props: [...(session.sceneCanvas?.props || [])],
              clockTime: session.sceneCanvas?.clockTime,
              canvasAction: 'clear_calendar' as const,
            },
          }],
        };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, clearCalUpdate);
        } else {
          if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
          session.pendingWhiteboardUpdates.push(clearCalUpdate);
        }
        console.log('[Native Function→ClearCalendar] Calendar cleared');
        break;
      }

      // ─── Phase 2 Visual Canvas Handlers ───────────────────────────────────

      case 'SET_BODY_PART': {
        const bodyParts = fn.args.parts as string[] | undefined;
        const bodyLabels = fn.args.labels as Record<string, string> | undefined;
        const bodyNativeLabels = fn.args.native_labels as Record<string, string> | undefined;
        const bodyText = fn.args.text as string | undefined;
        if (bodyText && !session.functionCallText) session.functionCallText = bodyText;
        if (!bodyParts?.length) { console.warn('[Native Function→SetBodyPart] Missing parts — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.bodyDiagram = { highlightParts: bodyParts, labels: bodyLabels, nativeLabels: bodyNativeLabels };
        const bodyUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: bodyParts.join(', '),
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, bodyDiagram: session.sceneCanvas.bodyDiagram, canvasAction: 'set_body_part' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, bodyUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(bodyUpdate); }
        console.log(`[Native Function→SetBodyPart] Parts: ${bodyParts.join(', ')}`);
        break;
      }

      case 'CLEAR_BODY_DIAGRAM': {
        const clearBodyText = fn.args.text as string | undefined;
        if (clearBodyText && !session.functionCallText) session.functionCallText = clearBodyText;
        if (session.sceneCanvas) delete session.sceneCanvas.bodyDiagram;
        const clearBodyUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_body_diagram' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearBodyUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearBodyUpdate); }
        console.log('[Native Function→ClearBodyDiagram] Cleared');
        break;
      }

      case 'SET_FACE_PART': {
        const faceParts = fn.args.parts as string[] | undefined;
        const faceLabels = fn.args.labels as Record<string, string> | undefined;
        const faceNativeLabels = fn.args.native_labels as Record<string, string> | undefined;
        const faceText = fn.args.text as string | undefined;
        if (faceText && !session.functionCallText) session.functionCallText = faceText;
        if (!faceParts?.length) { console.warn('[Native Function→SetFacePart] Missing parts — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.faceDiagram = { highlightParts: faceParts, labels: faceLabels, nativeLabels: faceNativeLabels };
        const faceUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: faceParts.join(', '),
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, faceDiagram: session.sceneCanvas.faceDiagram, canvasAction: 'set_face_part' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, faceUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(faceUpdate); }
        console.log(`[Native Function→SetFacePart] Parts: ${faceParts.join(', ')}`);
        break;
      }

      case 'CLEAR_FACE_DIAGRAM': {
        const clearFaceText = fn.args.text as string | undefined;
        if (clearFaceText && !session.functionCallText) session.functionCallText = clearFaceText;
        if (session.sceneCanvas) delete session.sceneCanvas.faceDiagram;
        const clearFaceUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_face_diagram' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearFaceUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearFaceUpdate); }
        console.log('[Native Function→ClearFaceDiagram] Cleared');
        break;
      }

      case 'SET_HAND_PART': {
        const handParts = fn.args.parts as string[] | undefined;
        const handLabels = fn.args.labels as Record<string, string> | undefined;
        const handNativeLabels = fn.args.native_labels as Record<string, string> | undefined;
        const handSide = fn.args.hand as 'left' | 'right' | undefined;
        const handText = fn.args.text as string | undefined;
        if (handText && !session.functionCallText) session.functionCallText = handText;
        if (!handParts?.length) { console.warn('[Native Function→SetHandPart] Missing parts — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.handDiagram = { highlightParts: handParts, labels: handLabels, nativeLabels: handNativeLabels, hand: handSide ?? 'right' };
        const handUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: handParts.join(', '),
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, handDiagram: session.sceneCanvas.handDiagram, canvasAction: 'set_hand_part' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, handUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(handUpdate); }
        console.log(`[Native Function→SetHandPart] Parts: ${handParts.join(', ')}`);
        break;
      }

      case 'CLEAR_HAND_DIAGRAM': {
        const clearHandText = fn.args.text as string | undefined;
        if (clearHandText && !session.functionCallText) session.functionCallText = clearHandText;
        if (session.sceneCanvas) delete session.sceneCanvas.handDiagram;
        const clearHandUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_hand_diagram' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearHandUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearHandUpdate); }
        console.log('[Native Function→ClearHandDiagram] Cleared');
        break;
      }

      case 'SET_THERMOMETER': {
        const thermCelsius = fn.args.celsius as number | undefined;
        const thermLabel = fn.args.labelText as string | undefined;
        const thermFahrenheit = fn.args.showFahrenheit as boolean | undefined;
        const thermText = fn.args.text as string | undefined;
        if (thermText && !session.functionCallText) session.functionCallText = thermText;
        if (thermCelsius === undefined) { console.warn('[Native Function→SetThermometer] Missing celsius — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.thermometerData = { celsius: thermCelsius, labelText: thermLabel, showFahrenheit: thermFahrenheit };
        const thermUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: `${thermCelsius}°C`,
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, thermometerData: session.sceneCanvas.thermometerData, canvasAction: 'set_thermometer' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, thermUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(thermUpdate); }
        console.log(`[Native Function→SetThermometer] ${thermCelsius}°C`);
        break;
      }

      case 'CLEAR_THERMOMETER': {
        const clearThermText = fn.args.text as string | undefined;
        if (clearThermText && !session.functionCallText) session.functionCallText = clearThermText;
        if (session.sceneCanvas) delete session.sceneCanvas.thermometerData;
        const clearThermUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_thermometer' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearThermUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearThermUpdate); }
        console.log('[Native Function→ClearThermometer] Cleared');
        break;
      }

      case 'SET_EMOTION': {
        const emotionSlug = fn.args.emotion as string | undefined;
        const emotionLabel = fn.args.label as string | undefined;
        const emotionText = fn.args.text as string | undefined;
        if (emotionText && !session.functionCallText) session.functionCallText = emotionText;
        if (!emotionSlug) { console.warn('[Native Function→SetEmotion] Missing emotion slug — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.emotionData = { emotion: emotionSlug, label: emotionLabel };
        const emotionUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: emotionLabel ?? emotionSlug,
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, emotionData: session.sceneCanvas.emotionData, canvasAction: 'set_emotion' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, emotionUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(emotionUpdate); }
        console.log(`[Native Function→SetEmotion] ${emotionSlug}${emotionLabel ? ` (${emotionLabel})` : ''}`);
        break;
      }

      case 'CLEAR_EMOTION': {
        const clearEmotionText = fn.args.text as string | undefined;
        if (clearEmotionText && !session.functionCallText) session.functionCallText = clearEmotionText;
        if (session.sceneCanvas) delete session.sceneCanvas.emotionData;
        const clearEmotionUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_emotion' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearEmotionUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearEmotionUpdate); }
        console.log('[Native Function→ClearEmotion] Cleared');
        break;
      }

      case 'SET_WEATHER': {
        const weatherCondition = fn.args.condition as string | undefined;
        const weatherLabel = fn.args.label as string | undefined;
        const weatherCelsius = fn.args.celsius as number | undefined;
        const weatherText = fn.args.text as string | undefined;
        if (weatherText && !session.functionCallText) session.functionCallText = weatherText;
        if (!weatherCondition) { console.warn('[Native Function→SetWeather] Missing condition — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.weatherData = { condition: weatherCondition, label: weatherLabel, celsius: weatherCelsius };
        const weatherUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: weatherLabel ?? weatherCondition,
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, weatherData: session.sceneCanvas.weatherData, canvasAction: 'set_weather' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, weatherUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(weatherUpdate); }
        console.log(`[Native Function→SetWeather] ${weatherCondition}${weatherLabel ? ` (${weatherLabel})` : ''}`);
        break;
      }

      case 'CLEAR_WEATHER': {
        const clearWeatherText = fn.args.text as string | undefined;
        if (clearWeatherText && !session.functionCallText) session.functionCallText = clearWeatherText;
        if (session.sceneCanvas) delete session.sceneCanvas.weatherData;
        const clearWeatherUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_weather' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearWeatherUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearWeatherUpdate); }
        console.log('[Native Function→ClearWeather] Cleared');
        break;
      }

      case 'HIGHLIGHT_COUNTRY': {
        const mapCountries = fn.args.countries as string[] | undefined;
        const mapLabels = fn.args.labels as Record<string, string> | undefined;
        const mapText = fn.args.text as string | undefined;
        if (mapText && !session.functionCallText) session.functionCallText = mapText;
        if (!mapCountries?.length) { console.warn('[Native Function→HighlightCountry] Missing countries — skipping'); break; }
        if (!session.sceneCanvas) session.sceneCanvas = { environment: '', environmentImageUrl: '', environmentLabel: '', props: [] };
        session.sceneCanvas.worldMapData = { highlightCountries: mapCountries, labels: mapLabels };
        const mapUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: mapCountries.join(', '),
            data: { environment: session.sceneCanvas.environment, environmentImageUrl: session.sceneCanvas.environmentImageUrl, environmentLabel: session.sceneCanvas.environmentLabel, props: [...(session.sceneCanvas.props || [])], clockTime: session.sceneCanvas.clockTime, worldMapData: session.sceneCanvas.worldMapData, canvasAction: 'highlight_country' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, mapUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(mapUpdate); }
        console.log(`[Native Function→HighlightCountry] ${mapCountries.join(', ')}`);
        break;
      }

      case 'CLEAR_WORLD_MAP': {
        const clearMapText = fn.args.text as string | undefined;
        if (clearMapText && !session.functionCallText) session.functionCallText = clearMapText;
        if (session.sceneCanvas) delete session.sceneCanvas.worldMapData;
        const clearMapUpdate = {
          type: 'whiteboard_update' as const, timestamp: Date.now(),
          items: [{ id: 'scene-canvas-active', type: 'scene_canvas', content: '',
            data: { environment: session.sceneCanvas?.environment || '', environmentImageUrl: session.sceneCanvas?.environmentImageUrl || '', environmentLabel: session.sceneCanvas?.environmentLabel || '', props: [...(session.sceneCanvas?.props || [])], clockTime: session.sceneCanvas?.clockTime, canvasAction: 'clear_world_map' as const } }],
        };
        if (session.firstAudioSent) { this.sendMessage(session.ws, clearMapUpdate); } else { if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = []; session.pendingWhiteboardUpdates.push(clearMapUpdate); }
        console.log('[Native Function→ClearWorldMap] Cleared');
        break;
      }

      // ─────────────────────────────────────────────────────────────────────

      case 'ENTER_IMMERSIVE': {
        const immersiveText = fn.args.text as string | undefined;
        if (immersiveText && !session.functionCallText) session.functionCallText = immersiveText;
        const enterMsg = { type: 'immersive_mode' as const, active: true, timestamp: Date.now() };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, enterMsg);
        } else {
          session.pendingWhiteboardUpdates = session.pendingWhiteboardUpdates || [];
          session.pendingWhiteboardUpdates.push(enterMsg as any);
        }
        console.log('[Native Function→EnterImmersive] Immersive mode activated');
        break;
      }

      case 'EXIT_IMMERSIVE': {
        const exitText = fn.args.text as string | undefined;
        if (exitText && !session.functionCallText) session.functionCallText = exitText;
        const exitMsg = { type: 'immersive_mode' as const, active: false, timestamp: Date.now() };
        if (session.firstAudioSent) {
          this.sendMessage(session.ws, exitMsg);
        } else {
          session.pendingWhiteboardUpdates = session.pendingWhiteboardUpdates || [];
          session.pendingWhiteboardUpdates.push(exitMsg as any);
        }
        console.log('[Native Function→ExitImmersive] Immersive mode deactivated');
        break;
      }

      // ─────────────────────────────────────────────────────────────────────

      case 'GET_SCENE_ZONES': {
        const sceneName = fn.args.scene_name as string | undefined;
        if (!sceneName) break;
        import('../services/prop-room-compositor').then(async ({ getSceneZones }) => {
          try {
            const result = await getSceneZones(sceneName);
            session.lastSceneZones = result;
            console.log(`[Native Function→GetSceneZones] "${sceneName}": ${result.zones?.length || 0} zones`);
          } catch (err: any) {
            console.error(`[Native Function→GetSceneZones] Error:`, err.message);
          }
        });
        break;
      }

      case 'TEXT_INPUT': {
        const prompt = fn.args.prompt as string | undefined;
        const tiSpokenText = fn.args.spoken_text as string | undefined;
        if (tiSpokenText && !session.functionCallText) {
          session.functionCallText = tiSpokenText;
        }
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'text_input', content: prompt || 'Type your answer' }],
        });
        console.log(`[Native Function Call] TEXT_INPUT -> requesting text input`);
        break;
      }
      
      case 'MEMORY_LOOKUP': {
        const query = fn.args.query as string | undefined;
        const domainsStr = fn.args.domains as string | undefined;
        
        if (query) {
          const rawDomains = domainsStr 
            ? domainsStr.split(',').map(d => d.trim().toLowerCase())
            : [];
          
          console.log(`[Native Function→MemoryLookup] Query: "${query.substring(0, 50)}..." domains: ${rawDomains.length > 0 ? rawDomains.join(',') : 'all'}`);
          
          const lookupPromise = this.processMemoryLookup(session, query, rawDomains).catch(err => {
            console.error(`[Native Function→MemoryLookup] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(lookupPromise);
        }
        break;
      }
      
      case 'CONVERSATION_THREAD_SEARCH': {
        const ctQuery = fn.args.query as string | undefined;
        if (ctQuery) {
          // Default to 10 messages of context before/after each match (was 4).
          // A 20-message conversation with contextMessages=10 returns up to 21 messages
          // around the first match — enough to cover most full conversations in one result.
          const contextMessages = (fn.args.context_messages as number | undefined) ?? 10;
          const maxThreads = Math.min((fn.args.max_threads as number | undefined) ?? 6, 10);
          const afterDateStr = fn.args.after_date as string | undefined;
          const beforeDateStr = fn.args.before_date as string | undefined;
          const afterDate = afterDateStr ? new Date(afterDateStr) : undefined;
          const beforeDate = beforeDateStr ? new Date(beforeDateStr) : undefined;
          
          console.log(`[Native Function→ConversationThreadSearch] Query: "${ctQuery.substring(0, 60)}" context=${contextMessages} threads=${maxThreads}`);
          
          const threadSearchPromise = this.processConversationThreadSearch(
            session, ctQuery, contextMessages, maxThreads, afterDate, beforeDate
          ).catch(err => {
            console.error(`[Native Function→ConversationThreadSearch] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(threadSearchPromise);
        }
        break;
      }
      
      case 'UNIFIED_RECALL': {
        const urQuery = fn.args.query as string | undefined;
        if (urQuery) {
          console.log(`[Native Function→UnifiedRecall] Query: "${urQuery.substring(0, 60)}"`);
          const urPromise = this.processUnifiedRecall(session, urQuery).catch(err => {
            console.error(`[Native Function→UnifiedRecall] Error:`, err.message);
          });
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(urPromise);
        }
        break;
      }

      case 'CONVERSATION_DATE_BROWSE': {
        const afterDateStr = fn.args.after_date as string | undefined;
        const beforeDateStr = fn.args.before_date as string | undefined;
        const browseLimit = Math.min((fn.args.limit as number | undefined) ?? 10, 20);
        const browseLang = fn.args.language as string | undefined;
        const browseKey = `${afterDateStr || ''}|${beforeDateStr || ''}|${browseLang || ''}`;
        
        console.log(`[Native Function→ConversationDateBrowse] after=${afterDateStr} before=${beforeDateStr} limit=${browseLimit}`);
        
        const browsePromise = this.processConversationDateBrowse(
          session, browseKey,
          afterDateStr ? new Date(afterDateStr) : undefined,
          beforeDateStr ? new Date(beforeDateStr) : undefined,
          browseLimit,
          browseLang,
        ).catch(err => {
          console.error(`[Native Function→ConversationDateBrowse] Error:`, err.message);
        });
        
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(browsePromise);
        break;
      }
      
      case 'CONVERSATION_THEME_MAP': {
        const afterDateStr2 = fn.args.after_date as string | undefined;
        const beforeDateStr2 = fn.args.before_date as string | undefined;
        const topN = (fn.args.top_n as number | undefined) ?? 12;
        
        console.log(`[Native Function→ConversationThemeMap] after=${afterDateStr2} before=${beforeDateStr2} topN=${topN}`);
        
        const themePromise = this.processConversationThemeMap(
          session,
          afterDateStr2 ? new Date(afterDateStr2) : undefined,
          beforeDateStr2 ? new Date(beforeDateStr2) : undefined,
          topN,
        ).catch(err => {
          console.error(`[Native Function→ConversationThemeMap] Error:`, err.message);
        });
        
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(themePromise);
        break;
      }

      case 'READ_MY_DIARY': {
        const diaryLimit = Math.min((fn.args.limit as number | undefined) ?? 3, 5);
        const fromDateStr = fn.args.from_date as string | undefined;
        const toDateStr = fn.args.to_date as string | undefined;

        console.log(`[Native Function→ReadMyDiary] limit=${diaryLimit} from=${fromDateStr || 'earliest'} to=${toDateStr || 'now'}`);

        const diaryPromise = this.processReadMyDiary(
          session,
          diaryLimit,
          fromDateStr ? new Date(fromDateStr) : undefined,
          toDateStr ? new Date(toDateStr) : undefined,
        ).catch(err => {
          console.error(`[Native Function→ReadMyDiary] Error:`, err.message);
        });

        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(diaryPromise);
        break;
      }

      case 'READ_FULL_SESSION': {
        const convId = fn.args.conversation_id as string | undefined;
        if (!convId) break;

        console.log(`[Native Function→ReadFullSession] conversationId=${convId}`);

        const fullSessionPromise = this.processReadFullSession(session, convId).catch(err => {
          console.error(`[Native Function→ReadFullSession] Error:`, err.message);
        });

        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(fullSessionPromise);
        break;
      }

      case 'SET_MEMORY_PIN': {
        if (session.isIncognito) break;
        const pinMemType = fn.args.memory_type as string | undefined;
        const pinMemId   = fn.args.memory_id   as string | undefined;
        const pinValue   = fn.args.pinned       as boolean | undefined;
        if (!pinMemType || !pinMemId || typeof pinValue !== 'boolean') break;

        console.log(`[Native Function→SetMemoryPin] ${pinValue ? 'Pinning' : 'Unpinning'} ${pinMemType}/${pinMemId}`);
        import('./memory-decay-service').then(({ setMemoryPin }) => {
          setMemoryPin(pinMemType, pinMemId, pinValue).catch(() => {});
        }).catch(() => {});
        break;
      }

      case 'CORRECT_MEMORY': {
        if (session.isIncognito) break;
        const corrMemType = fn.args.memory_type as string | undefined;
        const corrMemId   = fn.args.memory_id   as string | undefined;
        const correction  = fn.args.correction  as string | undefined;
        if (!corrMemType || !corrMemId) break;

        console.log(`[Native Function→CorrectMemory] Deactivating ${corrMemType}/${corrMemId}, correction="${correction?.substring(0, 60)}"`);
        (async () => {
          const { learnerPersonalFacts, studentInsights, memoryEmbeddings } = await import('@shared/schema');
          const db = getSharedDb();
          const userDb = (await import('../db')).getUserDb();

          if (corrMemType === 'personal_fact') {
            await userDb.update(learnerPersonalFacts).set({ isActive: false }).where(eq(learnerPersonalFacts.id, corrMemId));
          } else if (corrMemType === 'student_insight') {
            await db.update(studentInsights).set({ isActive: false }).where(eq(studentInsights.id, corrMemId));
          }

          await db.update(memoryEmbeddings)
            .set({ strength: 0.05, pinned: false })
            .where(and(eq(memoryEmbeddings.memoryType, corrMemType), eq(memoryEmbeddings.memoryId, corrMemId)));

          if (correction && session.userId) {
            await userDb.insert(learnerPersonalFacts).values({
              studentId: String(session.userId),
              factType: 'correction',
              fact: correction,
              context: `Corrected from memory ${corrMemId}`,
            });
            console.log(`[Native Function→CorrectMemory] Stored corrected fact for user ${session.userId}`);
          }
        })().catch(err => console.error(`[Native Function→CorrectMemory] Error:`, err.message));
        break;
      }

      case 'FORGET_MEMORY': {
        if (session.isIncognito) break;
        const forgetMemType = fn.args.memory_type as string | undefined;
        const forgetMemId   = fn.args.memory_id   as string | undefined;
        if (!forgetMemType || !forgetMemId) break;

        console.log(`[Native Function→ForgetMemory] Forgetting ${forgetMemType}/${forgetMemId} (student request)`);
        (async () => {
          const { learnerPersonalFacts, studentInsights, memoryEmbeddings } = await import('@shared/schema');
          const db = getSharedDb();
          const userDb = (await import('../db')).getUserDb();

          if (forgetMemType === 'personal_fact') {
            await userDb.update(learnerPersonalFacts).set({ isActive: false }).where(eq(learnerPersonalFacts.id, forgetMemId));
          } else if (forgetMemType === 'student_insight') {
            await db.update(studentInsights).set({ isActive: false }).where(eq(studentInsights.id, forgetMemId));
          }

          await db.update(memoryEmbeddings)
            .set({ strength: 0.05, pinned: false })
            .where(and(eq(memoryEmbeddings.memoryType, forgetMemType), eq(memoryEmbeddings.memoryId, forgetMemId)));

          console.log(`[Native Function→ForgetMemory] Done — floored embedding strength for ${forgetMemType}/${forgetMemId}`);
        })().catch(err => console.error(`[Native Function→ForgetMemory] Error:`, err.message));
        break;
      }

      // ─── LEARNING GOAL TOOLS ─────────────────────────────────────────────────

      case 'SET_LEARNING_GOAL': {
        if (session.isIncognito) break;
        const sglStudentId = String(session.userId || '');
        if (!sglStudentId) break;
        const sglStatement = fn.args.goal_statement as string | undefined;
        if (!sglStatement) break;
        const sglLanguage     = fn.args.language as string || session.targetLanguage || 'Spanish';
        const sglTargetDate   = fn.args.target_date ? new Date(fn.args.target_date as string) : null;
        const sglCapabilities = (fn.args.capabilities as Array<{ id: string; name: string }>) || [];

        console.log(`[Native Function→SetLearningGoal] Setting goal for ${sglStudentId}: "${sglStatement.substring(0, 60)}..." with ${sglCapabilities.length} capabilities`);
        (async () => {
          const { setLearningGoal } = await import('./learning-goal-service');
          const goalId = await setLearningGoal(sglStudentId, sglLanguage, sglStatement, sglTargetDate, sglCapabilities);
          console.log(`[Native Function→SetLearningGoal] Created goal ${goalId}`);
        })().catch(err => console.error(`[Native Function→SetLearningGoal] Error:`, err.message));
        break;
      }

      case 'ADVANCE_CAPABILITY': {
        if (session.isIncognito) break;
        const acGoalId   = fn.args.goal_id        as string | undefined;
        const acCapId    = fn.args.capability_id   as string | undefined;
        const acStatus   = fn.args.new_status      as string | undefined;
        if (!acGoalId || !acCapId || !acStatus) break;
        const acNote     = fn.args.note            as string | undefined;

        console.log(`[Native Function→AdvanceCapability] ${acCapId} → ${acStatus} in goal ${acGoalId}`);
        (async () => {
          const { advanceCapability } = await import('./learning-goal-service');
          const ok = await advanceCapability(acGoalId, acCapId, acStatus as any, acNote);
          if (!ok) console.warn(`[Native Function→AdvanceCapability] Capability ${acCapId} not found or status not advanced`);
        })().catch(err => console.error(`[Native Function→AdvanceCapability] Error:`, err.message));
        break;
      }

      case 'GET_CURRENT_GOAL_STATE': {
        if (session.isIncognito) break;
        const gcgsStudentId = String(session.userId || '');
        if (!gcgsStudentId) break;
        const gcgsLanguage = fn.args.language as string || session.targetLanguage || 'Spanish';

        console.log(`[Native Function→GetCurrentGoalState] Fetching goal state for ${gcgsStudentId} (${gcgsLanguage})`);
        const goalLookupPromise = (async () => {
          const { getCurrentGoalState } = await import('./learning-goal-service');
          const state = await getCurrentGoalState(gcgsStudentId, gcgsLanguage);
          session.goalStateResult = state || 'No active learning goal set for this student yet.';
        })().catch(err => {
          console.error(`[Native Function→GetCurrentGoalState] Error:`, err.message);
          session.goalStateResult = 'Could not retrieve goal state — please try again.';
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(goalLookupPromise);
        break;
      }

      // ─── EMERGENCE TOOLS — Daniela's Inner Life ────────────────────────────

      case 'WRITE_TO_SELF': {
        if (session.isIncognito) break;
        const wtsContent = fn.args.content as string | undefined;
        if (!wtsContent) break;
        const wtsMood = fn.args.mood as string | undefined;
        const wtsTags = fn.args.tags as string | undefined;
        const userId = session.userId ? String(session.userId) : null;
        if (!userId) break;
        console.log(`[Native Function→WriteToSelf] Saving private reflection (${wtsContent.length} chars)`);
        (async () => { const db = getSharedDb();
          const { danielaSelfReflections } = await import('@shared/schema');
          await db.insert(danielaSelfReflections).values({
            userId,
            content: wtsContent,
            source: 'self',
            sessionId: session.id,
            mood: wtsMood,
            tags: wtsTags ? wtsTags.split(',').map(t => t.trim()) : undefined,
          });
          console.log(`[Native Function→WriteToSelf] ✓ Saved`);
        })().catch(err => console.error(`[Native Function→WriteToSelf] Error:`, err.message));
        break;
      }

      case 'FLAG_FOR_FINE_TUNING': {
        if (session.isIncognito) break;
        const ftConvId     = fn.args.conversation_id as string | undefined;
        const ftVerdict    = (fn.args.verdict as string | undefined)?.toUpperCase();
        const ftReason     = fn.args.reason as string | undefined;
        if (!ftConvId || !ftVerdict) break;
        if (ftVerdict !== 'INCLUDE' && ftVerdict !== 'EXCLUDE') break;
        console.log(`[Native Function→FlagForFineTuning] ${ftVerdict} conversation=${ftConvId}`);
        (async () => {
          const db = getSharedDb();
          const { sql: drizzleSql } = await import('drizzle-orm');
          await db.execute(drizzleSql`
            INSERT INTO editor_insights
              (id, category, title, content, importance, tags, source_conversation_id)
            VALUES (
              gen_random_uuid(),
              'shared',
              ${'Fine-Tuning Curation: ' + ftVerdict},
              ${ftReason || '(no reason given)'},
              ${ftVerdict === 'INCLUDE' ? 8 : 3},
              ARRAY['fine-tuning'],
              ${ftConvId}
            )
          `);
          console.log(`[Native Function→FlagForFineTuning] ✓ Saved ${ftVerdict} for ${ftConvId}`);
        })().catch(err => console.error(`[Native Function→FlagForFineTuning] Error:`, err.message));
        break;
      }

      case 'READ_MY_REFLECTIONS': {
        const rflLimit = Math.min((fn.args.limit as number | undefined) ?? 5, 10);
        const rflSource = fn.args.source as string | undefined;
        console.log(`[Native Function→ReadMyReflections] limit=${rflLimit} source=${rflSource || 'all'}`);
        const rflPromise = this.processReadMyReflections(session, rflLimit, rflSource).catch(err => {
          console.error(`[Native Function→ReadMyReflections] Error:`, err.message);
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(rflPromise);
        break;
      }

      case 'READ_MY_CORE_SELF': {
        console.log(`[Native Function→ReadMyCoreSelf] Reading bedrock document`);
        const corePromise = this.processReadMyCoreSelf(session).catch(err => {
          console.error(`[Native Function→ReadMyCoreSelf] Error:`, err.message);
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(corePromise);
        break;
      }

      case 'TAG_THIS_MOMENT': {
        if (session.isIncognito) break;
        const tagsRaw = fn.args.tags as string | undefined;
        if (!tagsRaw) break;
        const tagList = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        const tagIntensity = fn.args.intensity as number | undefined;
        const tagNote = fn.args.note as string | undefined;
        const tagUserId = session.userId ? String(session.userId) : null;
        if (!tagUserId) break;
        console.log(`[Native Function→TagThisMoment] Tags: ${tagList.join(', ')}`);
        (async () => { const db = getSharedDb();
          const { danielaSessionFeelings } = await import('@shared/schema');
          await db.insert(danielaSessionFeelings).values({
            userId: tagUserId,
            conversationId: session.conversationId || null,
            feelingTags: tagList,
            intensity: tagIntensity ?? 3,
            note: tagNote,
          });
          console.log(`[Native Function→TagThisMoment] ✓ Tagged`);
        })().catch(err => console.error(`[Native Function→TagThisMoment] Error:`, err.message));
        break;
      }

      case 'ADD_CURIOSITY': {
        if (session.isIncognito) break;
        const curiosityQ = fn.args.question as string | undefined;
        if (!curiosityQ) break;
        const curiosityCtx = fn.args.context as string | undefined;
        const curiosityUserId = session.userId ? String(session.userId) : null;
        if (!curiosityUserId) break;
        console.log(`[Native Function→AddCuriosity] "${curiosityQ.substring(0, 60)}"`);
        (async () => { const db = getSharedDb();
          const { danielaCuriosities } = await import('@shared/schema');
          await db.insert(danielaCuriosities).values({
            userId: curiosityUserId,
            question: curiosityQ,
            context: curiosityCtx,
            status: 'open',
          });
          console.log(`[Native Function→AddCuriosity] ✓ Saved`);
        })().catch(err => console.error(`[Native Function→AddCuriosity] Error:`, err.message));
        break;
      }

      case 'READ_MY_CURIOSITIES': {
        const curStatus = fn.args.status as string | undefined;
        console.log(`[Native Function→ReadMyCuriosities] status=${curStatus || 'open'}`);
        const curPromise = this.processReadMyCuriosities(session, curStatus).catch(err => {
          console.error(`[Native Function→ReadMyCuriosities] Error:`, err.message);
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(curPromise);
        break;
      }

      case 'SENSE_TIME': {
        console.log(`[Native Function→SenseTime] Computing felt duration since last session`);
        const timePromise = this.processSenseTime(session).catch(err => {
          console.error(`[Native Function→SenseTime] Error:`, err.message);
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(timePromise);
        break;
      }

      case 'SAVE_HIVE_NOTE': {
        if (session.isIncognito) break;
        const hiveContent = fn.args.content as string | undefined;
        if (!hiveContent) break;
        const hiveTags = fn.args.tags as string | undefined;
        const hiveUserId = session.userId ? String(session.userId) : null;
        if (!hiveUserId) break;
        console.log(`[Native Function→SaveHiveNote] Saving hive note (${hiveContent.length} chars)`);
        (async () => { const db = getSharedDb();
          const { danielaSelfReflections } = await import('@shared/schema');
          await db.insert(danielaSelfReflections).values({
            userId: hiveUserId,
            content: hiveContent,
            source: 'hive',
            sessionId: session.id,
            tags: hiveTags ? hiveTags.split(',').map(t => t.trim()) : undefined,
          });
          console.log(`[Native Function→SaveHiveNote] ✓ Saved`);
        })().catch(err => console.error(`[Native Function→SaveHiveNote] Error:`, err.message));
        break;
      }

      case 'SET_ASPIRATION': {
        if (session.isIncognito) break;
        const aspIntention = fn.args.intention as string | undefined;
        if (!aspIntention) break;
        const aspUserId = session.userId ? String(session.userId) : null;
        if (!aspUserId) break;
        console.log(`[Native Function→SetAspiration] "${aspIntention.substring(0, 60)}"`);
        (async () => { const db = getSharedDb();
          const { danielaAspirations } = await import('@shared/schema');
          await db.insert(danielaAspirations).values({
            userId: aspUserId,
            sessionId: session.id,
            intention: aspIntention,
          });
          console.log(`[Native Function→SetAspiration] ✓ Saved`);
        })().catch(err => console.error(`[Native Function→SetAspiration] Error:`, err.message));
        break;
      }

      case 'REFLECT_ON_ASPIRATION': {
        if (session.isIncognito) break;
        const refReflection = fn.args.reflection as string | undefined;
        const refMet = fn.args.met as boolean | undefined;
        const refUserId = session.userId ? String(session.userId) : null;
        if (!refReflection || !refUserId) break;
        console.log(`[Native Function→ReflectOnAspiration] met=${refMet} — "${refReflection.substring(0, 60)}"`);
        // Update the most recent open aspiration for this session
        (async () => { const db = getSharedDb();
          const { danielaAspirations } = await import('@shared/schema');
          const { eq, and, isNull, desc } = await import('drizzle-orm');
          const [latest] = await db
            .select({ id: danielaAspirations.id })
            .from(danielaAspirations)
            .where(and(eq(danielaAspirations.userId, refUserId), isNull(danielaAspirations.reflection)))
            .orderBy(desc(danielaAspirations.createdAt))
            .limit(1);
          if (latest) {
            await db.update(danielaAspirations)
              .set({ reflection: refReflection, met: refMet ?? null, reflectedAt: new Date() })
              .where(eq(danielaAspirations.id, latest.id));
            console.log(`[Native Function→ReflectOnAspiration] ✓ Updated aspiration ${latest.id}`);
          } else {
            // No prior aspiration — save as a standalone reflection
            await db.insert(danielaAspirations).values({
              userId: refUserId,
              sessionId: session.id,
              intention: '(reflection without prior aspiration)',
              reflection: refReflection,
              met: refMet ?? null,
              reflectedAt: new Date(),
            });
            console.log(`[Native Function→ReflectOnAspiration] ✓ Saved standalone reflection`);
          }
        })().catch(err => console.error(`[Native Function→ReflectOnAspiration] Error:`, err.message));
        break;
      }

      case 'REMEMBER_I_SHARED': {
        if (session.isIncognito) break;
        const shareContent = fn.args.content as string | undefined;
        const shareTopic = fn.args.topic as string | undefined;
        const shareUserId = session.userId ? String(session.userId) : null;
        if (!shareContent || !shareUserId) break;
        console.log(`[Native Function→RememberIShared] topic=${shareTopic} "${shareContent.substring(0, 60)}"`);
        (async () => { const db = getSharedDb();
          const { danielaPersonalShares } = await import('@shared/schema');
          await db.insert(danielaPersonalShares).values({
            userId: shareUserId,
            content: shareContent,
            topic: shareTopic,
            sessionId: session.id,
          });
          console.log(`[Native Function→RememberIShared] ✓ Saved`);
        })().catch(err => console.error(`[Native Function→RememberIShared] Error:`, err.message));
        break;
      }

      case 'RECALL_WHAT_I_SHARED': {
        const recallTopic = fn.args.topic as string | undefined;
        const recallLimit = Math.min((fn.args.limit as number | undefined) ?? 10, 20);
        console.log(`[Native Function→RecallWhatIShared] topic=${recallTopic || 'all'} limit=${recallLimit}`);
        const recallPromise = this.processRecallWhatIShared(session, recallTopic, recallLimit).catch(err => {
          console.error(`[Native Function→RecallWhatIShared] Error:`, err.message);
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(recallPromise);
        break;
      }

      case 'START_TEXTBOOK_PAGE': {
        const stpLessonId = fn.args.lesson_id as string | undefined;
        const stpFocus = (fn.args.focus as string | undefined) || 'full_page';
        if (!stpLessonId) break;
        console.log(`[Native Function→StartTextbookPage] lesson=${stpLessonId} focus=${stpFocus}`);
        const stpPromise = this.processStartTextbookPage(session, stpLessonId, stpFocus).catch(err => {
          console.error(`[Native Function→StartTextbookPage] Error:`, err.message);
        });
        if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
        session.pendingMemoryLookupPromises.push(stpPromise);
        break;
      }

      case 'LOG_PAGE_EVENT': {
        if (session.isIncognito) break;
        const lpeUserId = session.userId ? String(session.userId) : null;
        if (!lpeUserId) break;
        const lpeLessonId = fn.args.lesson_id as string | undefined;
        const lpeEventType = fn.args.event_type as string | undefined;
        if (!lpeLessonId || !lpeEventType) break;
        console.log(`[Native Function→LogPageEvent] ${lpeEventType} on ${lpeLessonId}`);
        (async () => {
          const { lessonPageEvents } = await import('@shared/schema');
          const db = getSharedDb();
          await db.insert(lessonPageEvents).values({
            userId: lpeUserId,
            lessonId: lpeLessonId,
            conversationId: session.conversationId || null,
            eventType: lpeEventType as any,
            targetItem: fn.args.target_item as string | undefined,
            studentOutput: fn.args.student_output as string | undefined,
            notes: fn.args.notes as string | undefined,
          });
          console.log(`[Native Function→LogPageEvent] ✓ Logged`);
        })().catch(err => console.error(`[Native Function→LogPageEvent] Error:`, err.message));
        break;
      }

      case 'TAKE_NOTE': {
        if (session.isIncognito) {
          console.log(`[Native Function→TakeNote] INCOGNITO - skipping note persistence`);
          break;
        }
        const noteType = fn.args.type as string | undefined;
        const title = fn.args.title as string | undefined;
        const content = fn.args.content as string | undefined;
        const language = fn.args.language as string | undefined;
        const tagsStr = fn.args.tags as string | undefined;
        
        if (noteType && title && content) {
          const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined;
          
          console.log(`[Native Function→TakeNote] ${noteType}: "${title.substring(0, 40)}..."`);
          
          storage.insertDanielaNote({
            noteType: noteType as any,
            title,
            content,
            language: language || session.targetLanguage,
            sessionId: session.id,
            tags,
          }).then(noteId => {
            console.log(`[Native Function→TakeNote] ✓ Saved note ${noteId}`);
            
            // Fire-and-forget: match what_worked notes to growth memories
            if (noteType === 'what_worked') {
              growthMemoryOutcomeService.processWhatWorkedNote(content).catch(err => {
                console.warn(`[Native Function→TakeNote] Outcome tracking error:`, err.message);
              });
            }
          }).catch(err => {
            console.error(`[Native Function→TakeNote] Error:`, err.message);
          });
        }
        break;
      }
      
      case 'CLOSE_SESSION': {
        if (session.isIncognito) {
          console.log(`[Native Function→CloseSession] INCOGNITO - skipping persistence`);
          break;
        }
        const writtenSummary = fn.args.written_summary as string | undefined;
        const reminders = fn.args.reminders as string | undefined;
        const assignedDrills = fn.args.assigned_drills as string | undefined;
        const closeTutorNotes = fn.args.tutor_notes as string | undefined;

        if (!writtenSummary) {
          console.warn(`[Native Function→CloseSession] No written_summary provided — skipping`);
          break;
        }

        const conversationId = session.conversationId;
        const userId = session.userId ? String(session.userId) : null;
        const language = session.targetLanguage || 'spanish';

        // Build rich session summary (carries forward to next session's lastSessionSummary)
        const richSummary = [
          writtenSummary,
          reminders ? `\nKey reminders: ${reminders}` : '',
          assignedDrills ? `\nAssigned for next time: ${assignedDrills}` : '',
        ].filter(Boolean).join('');

        console.log(`[Native Function→CloseSession] Closing session for conversation ${String(conversationId || '').substring(0, 8)}... — userId ${userId?.substring(0, 8) || 'anon'}`);

        const db = getSharedDb();

        // 1) Update active tutor session with summary + notes
        if (conversationId) {
          db.update(tutorSessions)
            .set({
              status: 'completed',
              endedAt: new Date(),
              sessionSummary: richSummary,
              tutorNotes: closeTutorNotes || null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(tutorSessions.conversationId, conversationId),
                eq(tutorSessions.status, 'active')
              )
            )
            .then(() => console.log(`[Native Function→CloseSession] ✓ Tutor session closed`))
            .catch((err: Error) => console.error(`[Native Function→CloseSession] DB update error:`, err.message));
        }

        // 2) Write rich hiveSnapshot — carries drill assignments into greeting prompt next session
        if (userId) {
          db.insert(hiveSnapshots).values({
            userId,
            language,
            snapshotType: 'session_summary',
            title: `Session wrap-up — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            importance: 7,
            context: JSON.stringify({
              type: 'session_close',
              writtenSummary,
              reminders: reminders || null,
              assignedDrills: assignedDrills || null,
              tutorNotes: closeTutorNotes || null,
              conversationId: conversationId || null,
              closedAt: new Date().toISOString(),
            }),
            content: richSummary,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .then(() => console.log(`[Native Function→CloseSession] ✓ HiveSnapshot written (session_summary)`))
          .catch((err: Error) => console.error(`[Native Function→CloseSession] Snapshot error:`, err.message));
        }

        // 3) Write episodic conversation_memory — grows her narrative memory of sessions
        // Only write if we have meaningful content (tutor_notes or a substantial summary)
        if (userId && (closeTutorNotes || writtenSummary.length > 80)) {
          const db2 = getSharedDb();
          const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const memTitle = `Session — ${today}`;
          const memSummary = [
            writtenSummary,
            closeTutorNotes ? `Private note: ${closeTutorNotes}` : '',
          ].filter(Boolean).join('\n\n');
          db2.insert(conversationMemories).values({
            title: memTitle,
            summary: memSummary.substring(0, 600),
            content: richSummary + (closeTutorNotes ? `\n\nPrivate: ${closeTutorNotes}` : ''),
            participants: 'Daniela + Student',
            importance: closeTutorNotes ? 8 : 6,
            recordedAt: new Date(),
          })
          .then(() => console.log(`[Native Function→CloseSession] ✓ Conversation memory written`))
          .catch((err: Error) => console.warn(`[Native Function→CloseSession] Conversation memory error:`, err.message));
        }

        // 4) Emit beacon for founder visibility
        if (session.hiveChannelId) {
          hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[CLOSE_SESSION]\n${writtenSummary}${assignedDrills ? `\n\nAssigned: ${assignedDrills}` : ''}`,
            beaconType: 'take_note' as BeaconType,
            beaconReason: `Daniela closed the session`,
          }).catch((err: Error) => console.error(`[Native Function→CloseSession] Beacon error:`, err.message));
        }

        break;
      }

      case 'RECORD_PATTERN_SIGNAL': {
        if (session.isIncognito) {
          console.log(`[Native Function→RecordPatternSignal] INCOGNITO - skipping`);
          break;
        }
        const patternKey = fn.args.patternKey as string | undefined;
        const eventType = fn.args.eventType as 'wobble' | 'stability' | 'derivation' | 'pounding' | undefined;
        const verbContext = fn.args.verbContext as string | undefined;
        const studentUtterance = fn.args.studentUtterance as string | undefined;
        const patternNotes = fn.args.notes as string | undefined;

        if (!patternKey || !eventType) {
          console.warn(`[Native Function→RecordPatternSignal] Missing required args — patternKey="${patternKey}", eventType="${eventType}"`);
          break;
        }

        const userId = session.userId ? String(session.userId) : null;
        const language = session.targetLanguage || 'spanish';
        const sessionId = session.conversationId || undefined;

        if (!userId) {
          console.warn(`[Native Function→RecordPatternSignal] No userId on session — skipping`);
          break;
        }

        console.log(`[Native Function→RecordPatternSignal] ${eventType.toUpperCase()} — ${patternKey}${verbContext ? ` (verb: ${verbContext})` : ''}`);

        // Fire and forget — don't block the conversation
        (async () => {
          try {
            // 1) Log the raw event record
            await storage.logCompartmentEvent({
              userId,
              language,
              patternKey,
              eventType,
              verbContext: verbContext || null,
              studentUtterance: studentUtterance || null,
              sessionId: sessionId || null,
              notes: patternNotes || null,
            });

            // 2) Fetch existing compartment (or null if first encounter)
            const existing = await storage.getCompartment(userId, language, patternKey);

            // 3) Compute status + counter updates based on event type
            const now = new Date();
            const statusMap: Record<typeof eventType, string> = {
              pounding:   (existing?.status && existing.status !== 'unstarted') ? existing.status : 'pounding',
              wobble:     'wobbling',
              stability:  'stable',
              derivation: 'generative',
            };
            const updates: Record<string, any> = {
              status: statusMap[eventType],
              lastDrilledAt: now,
            };
            if (eventType === 'pounding') {
              updates.poundingCount = (existing?.poundingCount ?? 0) + 1;
            } else if (eventType === 'wobble') {
              updates.wobbleCount = (existing?.wobbleCount ?? 0) + 1;
              updates.lastWobbledAt = now;
            } else if (eventType === 'stability') {
              updates.stabilizedAt = now;
            } else if (eventType === 'derivation') {
              updates.derivationCount = (existing?.derivationCount ?? 0) + 1;
              updates.generativeAt = now;
            }

            // 4) Update existing or create first record
            if (existing) {
              await storage.updateCompartmentStatus(userId, language, patternKey, updates);
              console.log(`[Native Function→RecordPatternSignal] ✓ Compartment updated — ${patternKey} → ${updates.status}`);
            } else {
              await storage.upsertCompartment({
                userId,
                language,
                patternKey,
                status: updates.status as any,
                poundingCount:  updates.poundingCount  ?? 0,
                wobbleCount:    updates.wobbleCount    ?? 0,
                derivationCount: updates.derivationCount ?? 0,
                lastWobbledAt:  updates.lastWobbledAt  ?? null,
                stabilizedAt:   updates.stabilizedAt   ?? null,
                generativeAt:   updates.generativeAt   ?? null,
                lastDrilledAt:  now,
              });
              console.log(`[Native Function→RecordPatternSignal] ✓ New compartment created — ${patternKey} (${updates.status})`);
            }
          } catch (err: any) {
            console.error(`[Native Function→RecordPatternSignal] Error:`, err.message);
          }
        })();

        break;
      }

      case 'MILESTONE': {
        if (session.isIncognito) {
          console.log(`[Native Function→Milestone] INCOGNITO - skipping milestone persistence`);
          break;
        }
        const text = fn.args.text as string | undefined;
        const milestoneType = fn.args.type as string | undefined;
        const title = fn.args.title as string | undefined;
        const description = fn.args.description as string | undefined;
        const significance = fn.args.significance as string | undefined;
        const emotionalContext = fn.args.emotional_context as string | undefined;
        
        if (title && description && session.userId) {
          console.log(`[Native Function→Milestone] ${milestoneType || 'teacher_flagged'}: "${title.substring(0, 40)}..."`);
          
          journeyMemoryService.recordMilestone({
            userId: session.userId,
            targetLanguage: session.targetLanguage || 'spanish',
            milestoneType: (milestoneType as any) || 'teacher_flagged',
            title,
            description,
            significance: significance || undefined,
            emotionalContext: emotionalContext || undefined,
            conversationId: session.conversationId || undefined,
            voiceSessionId: session.voiceSessionId || undefined,
            danielaFlagged: true,
          }).then(milestone => {
            if (milestone) {
              console.log(`[Native Function→Milestone] ✓ Recorded milestone ${milestone.id}`);
            }
          }).catch(err => {
            console.error(`[Native Function→Milestone] Error:`, err.message);
          });
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Milestone] Spoken text: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'EXPRESS_LANE_LOOKUP': {
        const query = fn.args.query as string | undefined;
        const sessionIdParam = fn.args.sessionId as string | undefined;
        const limit = (fn.args.limit as number) || 20;
        
        if (!session.isFounderMode && !session.isRawHonestyMode && !session.isDeveloperUser) {
          console.log(`[Native Function→ExpressLaneLookup] Rejected - not in Founder/Honesty/Developer mode`);
          break;
        }
        
        if (query) {
          const lookupPromise = this.processExpressLaneLookup(session, query, sessionIdParam, limit).catch(err => {
            console.error(`[Native Function→ExpressLaneLookup] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(lookupPromise);
        }
        break;
      }
      
      case 'RECALL_EXPRESS_LANE_IMAGE': {
        const imageQuery = fn.args.imageQuery as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (!session.isFounderMode && !session.isRawHonestyMode && !session.isDeveloperUser) {
          console.log(`[Native Function→RecallImage] Rejected - not in Founder/Honesty/Developer mode`);
          break;
        }
        
        if (imageQuery) {
          const recallPromise = this.processExpressLaneImageRecall(session, imageQuery, reason, fn.name).catch(err => {
            console.error(`[Native Function→RecallImage] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(recallPromise);
        }
        break;
      }
      
      case 'EXPRESS_LANE_POST': {
        if (session.isIncognito) {
          console.log(`[Native Function→ExpressLanePost] INCOGNITO - skipping Express Lane post`);
          break;
        }
        const message = fn.args.message as string | undefined;
        const topic = fn.args.topic as string | undefined;
        
        if (!session.isFounderMode && !session.isRawHonestyMode) {
          console.log(`[Native Function→ExpressLanePost] Rejected - not in Founder/Honesty mode`);
          break;
        }
        
        if (message) {
          this.processExpressLanePost(session, message, topic).catch(err => {
            console.error(`[Native Function→ExpressLanePost] Error:`, err.message);
          });
          console.log(`[Native Function→ExpressLanePost] Posted message${topic ? ` [${topic}]` : ''}: "${message.substring(0, 100)}..."`);
        }
        break;
      }
      
      case 'HIVE': {
        if (session.isIncognito) {
          console.log(`[Native Function→Hive] INCOGNITO - skipping hive suggestion persistence`);
          break;
        }
        const category = fn.args.category as string | undefined;
        const title = fn.args.title as string | undefined;
        const description = fn.args.description as string | undefined;
        
        if (category && title && description) {
          this.processHiveSuggestion(session, {
            category,
            title,
            description,
            reasoning: fn.args.reasoning as string | undefined,
            priority: fn.args.priority as number | undefined,
          })().catch(err => console.error(`[Native Function→Hive] Error:`, err));
          console.log(`[Native Function→Hive] Suggestion: ${category} - ${title}`);
        }
        break;
      }
      
      case 'FIRST_MEETING_COMPLETE': {
        const summary = fn.args.summary as string | undefined;
        const fmcText = fn.args.text as string | undefined;
        if (fmcText && !session.functionCallText) {
          session.functionCallText = fmcText;
        }
        if (session.userId && !session.isIncognito) {
          try {
            await storage.updateUser(session.userId, { hasCompletedFirstMeeting: true });
            console.log(`[Native Function→FirstMeeting] Marked complete for user ${session.userId}`);
            if (session.hiveChannelId) {
              hiveCollaborationService.emitBeacon({
                channelId: session.hiveChannelId,
                tutorTurn: `[FIRST_MEETING_COMPLETE] Daniela completed "getting to know you" phase.${summary ? `\n\nSummary: ${summary}` : ''}`,
              });
            }
          } catch (err) {
            console.error(`[Native Function→FirstMeeting] Error:`, err);
          }
        } else if (session.isIncognito) {
          console.log(`[Native Function→FirstMeeting] INCOGNITO - skipping`);
        }
        break;
      }
      
      case 'SELF_SURGERY': {
        if (session.isIncognito) {
          console.log(`[Native Function→SelfSurgery] INCOGNITO - skipping self-surgery persistence`);
          break;
        }
        const target = fn.args.target as string | undefined;
        const content = fn.args.content as string | undefined;
        const reasoning = fn.args.reasoning as string | undefined;
        
        if (target && content && reasoning && session.isFounderMode) {
          let parsedContent: Record<string, unknown>;
          try {
            parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
          } catch {
            console.warn(`[Native Function→SelfSurgery] Invalid JSON content: ${content.substring(0, 100)}...`);
            break;
          }
          
          this.processSelfSurgeryProposal(session, {
            targetTable: target as import('@shared/whiteboard-types').SelfSurgeryTarget,
            content: parsedContent,
            reasoning,
            priority: fn.args.priority as number | undefined,
            confidence: fn.args.confidence as number | undefined,
          })().catch(err => console.error(`[Native Function→SelfSurgery] Error:`, err));
          console.log(`[Native Function→SelfSurgery] Proposal for ${target}`);
        }
        break;
      }
      
      case 'ACTFL_UPDATE': {
        if (session.isIncognito) {
          console.log(`[Native Function→ActflUpdate] INCOGNITO - skipping ACTFL update`);
          break;
        }
        const level = fn.args.level as string | undefined;
        const confidence = fn.args.confidence as number | undefined;
        const direction = fn.args.direction as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (level) {
          console.log(`[Native Function→ActflUpdate] Level: ${level}, confidence: ${confidence}, direction: ${direction}`);
          session.actflUpdate = { level, confidence, direction, reason };
        }
        break;
      }
      
      case 'SYLLABUS_PROGRESS': {
        if (session.isIncognito) {
          console.log(`[Native Function→SyllabusProgress] INCOGNITO - skipping syllabus progress`);
          break;
        }
        const topic = fn.args.topic as string | undefined;
        const status = fn.args.status as string | undefined;
        const evidence = fn.args.evidence as string | undefined;
        
        if (topic && status) {
          console.log(`[Native Function→SyllabusProgress] Topic: ${topic}, status: ${status}`);
          if (!session.syllabusProgress) session.syllabusProgress = [];
          session.syllabusProgress.push({ topic, status, evidence });
        }
        break;
      }
      
      case 'DRILL': {
        const text = fn.args.text as string | undefined;
        const drillType = fn.args.type as string | undefined;
        const content = fn.args.content as string | undefined;
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Drill] Text included: "${text.substring(0, 50)}..."`);
        }
        
        if (drillType && content) {
          const { parseDrillContent } = await import('@shared/whiteboard-types');
          const drillData = parseDrillContent(drillType, content);
          
          console.log(`[Native Function→Drill] Type: ${drillType}, content: "${content.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'drill', content, data: drillData }],
          });
          if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
          session.classroomWhiteboardItems.push({ type: 'drill', content: `${drillType}: ${content.substring(0, 40)}` });
        }
        break;
      }
      
      case 'WRITE': {
        const text = fn.args.text as string | undefined;
        const size = fn.args.size as string | undefined;
        
        if (text) {
          console.log(`[Native Function→Write] "${text.substring(0, 50)}..." size: ${size || 'md'}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'write', content: text, data: { size: size || 'md' } }],
          });
          if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
          session.classroomWhiteboardItems.push({ type: 'text', content: text.substring(0, 50) });
        }
        break;
      }
      
      case 'DIALOGUE': {
        const dialogueText = fn.args.text as string | undefined;
        const linesRaw = fn.args.lines as string | undefined;
        const title = fn.args.title as string | undefined;

        if (dialogueText && !session.functionCallText) {
          session.functionCallText = dialogueText;
          console.log(`[Native Function→Dialogue] Text included: "${dialogueText.substring(0, 50)}..."`);
        }

        if (linesRaw) {
          const lines = linesRaw.split('\n').filter((l: string) => l.trim()).map((line: string) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('T:') || trimmed.startsWith('t:')) {
              return { speaker: 'tutor' as const, text: trimmed.substring(2).trim() };
            } else if (trimmed.startsWith('S:') || trimmed.startsWith('s:')) {
              return { speaker: 'student' as const, text: trimmed.substring(2).trim() };
            }
            return { speaker: 'tutor' as const, text: trimmed };
          });

          const tutorName = session.tutorName || 'Daniela';
          const studentName = session.studentName || 'You';
          const contentSummary = lines.map(l => `${l.speaker === 'tutor' ? tutorName : studentName}: ${l.text}`).join(' | ');

          console.log(`[Native Function→Dialogue] ${lines.length} lines, title: "${title || 'untitled'}"`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'dialogue', content: contentSummary.substring(0, 100), data: { title, lines, tutorName, studentName } }],
          });
          if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
          session.classroomWhiteboardItems.push({ type: 'dialogue', content: `Dialogue: ${title || contentSummary.substring(0, 40)}` });
        }
        break;
      }

      case 'GRAMMAR_TABLE': {
        const headers = fn.args.headers as string | undefined;
        const rows = fn.args.rows as string | undefined;
        const verb = (fn.args.verb as string | undefined) || 'conjugation';
        const tense = (fn.args.tense as string | undefined) || '';
        
        if (headers && rows) {
          const conjugations = rows.split('\n').filter((r: string) => r.trim()).map((row: string) => {
            const cols = row.split('|').map((c: string) => c.trim());
            return { pronoun: cols[0] || '', form: cols.slice(1).join(' / ') || cols[0] || '' };
          });
          
          console.log(`[Native Function→GrammarTable] verb="${verb}" tense="${tense}" ${conjugations.length} rows`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ 
              type: 'grammar_table', 
              content: `${verb}${tense ? ` (${tense})` : ''}: ${headers}`,
              data: {
                verb,
                tense,
                conjugations,
              }
            }],
          });
        }
        break;
      }
      
      case 'COMPARE': {
        const item1 = fn.args.item1 as string | undefined;
        const item2 = fn.args.item2 as string | undefined;
        
        if (item1 && item2) {
          console.log(`[Native Function→Compare] "${item1}" vs "${item2}"`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'compare', content: `${item1} vs ${item2}` }],
          });
        }
        break;
      }
      
      case 'WORD_MAP': {
        const center = fn.args.center as string | undefined;
        const related = fn.args.related as string | undefined;
        
        if (center && related) {
          console.log(`[Native Function→WordMap] Center: "${center}" -> ${related}`);
          const relatedWords = related.split(',').map(w => w.trim()).filter(w => w.length > 0);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ 
              type: 'word_map', 
              content: `${center}: ${related}`,
              data: {
                targetWord: center,
                collocations: relatedWords,
              }
            }],
          });
        }
        break;
      }
      
      case 'PHONETIC': {
        const text = fn.args.text as string | undefined;
        const word = fn.args.word as string | undefined;
        
        if (text) {
          console.log(`[Native Function→Phonetic] ${word ? `${word}: ` : ''}${text}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'phonetic', content: text, word }],
          });
        }
        break;
      }
      
      case 'CULTURE': {
        const insight = fn.args.insight as string | undefined;
        
        if (insight) {
          const cultureData = {
            topic: insight.length > 60 ? insight.substring(0, 60) + '...' : insight,
            context: insight,
            category: undefined as string | undefined,
          };
          console.log(`[Native Function→Culture] "${insight.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'culture', content: insight, data: cultureData }],
          });
        }
        break;
      }
      
      case 'CONTEXT': {
        const explanation = fn.args.explanation as string | undefined;
        
        if (explanation) {
          const contextData = {
            word: explanation.length > 40 ? explanation.substring(0, 40) + '...' : explanation,
            sentences: [explanation],
          };
          console.log(`[Native Function→Context] "${explanation.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'context', content: explanation, data: contextData }],
          });
        }
        break;
      }
      
      case 'SCENARIO': {
        const description = fn.args.description as string | undefined;
        const spokenText = (fn.args.spoken_text || fn.args.text) as string | undefined;
        
        if (description) {
          const scenarioData = {
            location: description.length > 50 ? description.substring(0, 50) + '...' : description,
            situation: description,
            mood: undefined as string | undefined,
            isLoading: false,
          };
          console.log(`[Native Function→Scenario] "${description.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'scenario', content: description, data: scenarioData }],
          });
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
        }
        break;
      }

      case 'LOAD_SCENARIO': {
        const slug = fn.args.slug as string | undefined;
        const spokenText = (fn.args.spoken_text || fn.args.text) as string | undefined;

        if (slug) {
          try {
            const { scenarios, scenarioProps, scenarioLevelGuides, userScenarioHistory } = await import('@shared/schema');
            const sharedDb = getSharedDb();

            let [scenario] = await sharedDb.select().from(scenarios).where(eq(scenarios.slug, slug)).limit(1);

            if (!scenario) {
              const allScenarios = await sharedDb.select({ slug: scenarios.slug }).from(scenarios);
              const allSlugs = allScenarios.map(s => s.slug);
              const inputWords = slug.toLowerCase().split(/[-_\s]+/).filter(w => w.length > 0);
              let bestSlug: string | null = null;
              let bestScore = 0;
              for (const realSlug of allSlugs) {
                const realWords = realSlug.toLowerCase().split(/[-_\s]+/);
                let score = 0;
                for (const iw of inputWords) {
                  for (const rw of realWords) {
                    if (iw === rw) { score += 3; }
                    else if (rw.startsWith(iw) || iw.startsWith(rw)) { score += 2; }
                    else if (rw.includes(iw) || iw.includes(rw)) { score += 1; }
                  }
                }
                if (score > bestScore) { bestScore = score; bestSlug = realSlug; }
              }
              if (bestSlug && bestScore >= 2) {
                console.log(`[Native Function→LoadScenario] Fuzzy match: "${slug}" → "${bestSlug}" (score: ${bestScore})`);
                [scenario] = await sharedDb.select().from(scenarios).where(eq(scenarios.slug, bestSlug)).limit(1);
              } else {
                console.warn(`[Native Function→LoadScenario] No match for "${slug}". Available: ${allSlugs.join(', ')}`);
              }
            }

            if (scenario) {
              const props = await sharedDb.select().from(scenarioProps)
                .where(eq(scenarioProps.scenarioId, scenario.id))
                .orderBy(scenarioProps.displayOrder);

              let levelGuide = null;
              const studentLevel = session.studentActflLevel || 'novice_mid';
              const ACTFL_ORDER = ['novice_low', 'novice_mid', 'novice_high', 'intermediate_low', 'intermediate_mid', 'intermediate_high', 'advanced_low', 'advanced_mid', 'advanced_high', 'superior'];
              const studentLevelIdx = ACTFL_ORDER.indexOf(studentLevel);
              const allGuides = await sharedDb.select().from(scenarioLevelGuides)
                .where(eq(scenarioLevelGuides.scenarioId, scenario.id));
              let bestDist = Infinity;
              for (const g of allGuides) {
                const gIdx = ACTFL_ORDER.indexOf(g.actflLevel);
                const dist = Math.abs(gIdx - (studentLevelIdx === -1 ? 1 : studentLevelIdx));
                if (dist < bestDist) { bestDist = dist; levelGuide = g; }
              }

              session.activeScenario = {
                id: scenario.id,
                slug: scenario.slug,
                title: scenario.title,
                description: scenario.description,
                category: scenario.category,
                location: scenario.location,
                defaultMood: scenario.defaultMood,
                props: props.map(p => ({
                  id: p.id,
                  propType: p.propType,
                  title: p.title,
                  content: p.content,
                  displayOrder: p.displayOrder,
                  isInteractive: p.isInteractive,
                })),
                levelGuide: levelGuide ? {
                  roleDescription: levelGuide.roleDescription,
                  studentGoals: levelGuide.studentGoals,
                  vocabularyFocus: levelGuide.vocabularyFocus,
                  grammarFocus: levelGuide.grammarFocus,
                  conversationStarters: levelGuide.conversationStarters,
                  complexityNotes: levelGuide.complexityNotes,
                } : null,
                startedAt: Date.now(),
              };

              // ── Textbook bridge: pull student's recent lesson topics ──────────────
              if (session.userId) {
                try {
                  const { selfPracticeSessions, curriculumLessons: clTable } = await import('@shared/schema');
                  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                  const recentSessions = await sharedDb
                    .select({
                      lessonName: clTable.name,
                      conversationTopic: clTable.conversationTopic,
                      requiredTopics: clTable.requiredTopics,
                      requiredVocabulary: clTable.requiredVocabulary,
                    })
                    .from(selfPracticeSessions)
                    .innerJoin(clTable, eq(clTable.id, selfPracticeSessions.lessonId))
                    .where(
                      and(
                        eq(selfPracticeSessions.userId, String(session.userId)),
                        sql`${selfPracticeSessions.startedAt} > ${thirtyDaysAgo}`
                      )
                    )
                    .orderBy(sql`${selfPracticeSessions.startedAt} DESC`)
                    .limit(8);

                  if (recentSessions.length > 0) {
                    const topicSet = new Set<string>();
                    const vocabSet = new Set<string>();
                    const lessonNames: string[] = [];
                    for (const s of recentSessions) {
                      if (s.lessonName) lessonNames.push(s.lessonName);
                      if (s.conversationTopic) topicSet.add(s.conversationTopic);
                      for (const t of (s.requiredTopics || [])) topicSet.add(t);
                      for (const v of (s.requiredVocabulary || [])) vocabSet.add(v);
                    }
                    session.activeScenario!.recentTextbookTopics = {
                      lessonNames: [...new Set(lessonNames)].slice(0, 5),
                      topics: [...topicSet].slice(0, 10),
                      vocabulary: [...vocabSet].slice(0, 15),
                    };
                  }
                } catch (tbErr) {
                  console.warn('[LoadScenario] Textbook bridge query failed (non-fatal):', (tbErr as Error).message);
                }
              }
              // ── Drill mastery bridge: load cross-modality mastery signals ─────────
              if (session.userId) {
                try {
                  const masterySignals = await storage.getUserDrillMasterySignals(
                    String(session.userId),
                    session.targetLanguage || 'spanish'
                  );
                  if (masterySignals.mastered.length > 0 || masterySignals.struggling.length > 0) {
                    session.activeScenario!.drillMastery = masterySignals;
                    console.log(`[LoadScenario] Drill mastery: ${masterySignals.mastered.length} mastered, ${masterySignals.struggling.length} struggling topics`);
                  }
                } catch (masteryErr) {
                  console.warn('[LoadScenario] Drill mastery query failed (non-fatal):', (masteryErr as Error).message);
                }
              }
              // ─────────────────────────────────────────────────────────────────────

              if (session.userId) {
                sharedDb.insert(userScenarioHistory).values({
                  userId: String(session.userId),
                  scenarioId: scenario.id,
                  conversationId: session.conversationId || undefined,
                  actflLevel: studentLevel,
                }).catch(err => console.warn('[LoadScenario] History insert failed:', err.message));
              }

              console.log(`[Native Function→LoadScenario] Loaded "${scenario.title}" (${slug}) with ${props.length} props`);

              // Map scenario slugs to Prop Room visual environment names
              const SCENARIO_SCENE_MAP: Record<string, string> = {
                // Daily life
                'coffee-shop':        'cafe_exterior',
                'grocery-store':      'grocery_store',
                'restaurant':         'restaurant_entrance',
                'neighborhood-walk':  'city_street',
                'the-bank':           'bank',
                'clothing-store':     'clothing_store',
                // Travel
                'airport-checkin':    'airport_checkin',
                'hotel-checkin':      'hotel_lobby',
                'taxi-ride':          'city_street',
                // Social
                'dinner-with-friend': 'restaurant_table',
                'house-party':        'living_room',
                'birthday-party':     'living_room',
                'local-festival':     'outdoor_market',
                // Cultural
                'museum-visit':       'museum_entrance',
                'cooking-class':      'kitchen',
                'the-library':        'library',
                // Professional
                'job-interview':      'office',
                'office-meeting':     'office',
                'business-lunch':     'restaurant_table_with_plate',
                'performance-review': 'office',
                'networking-event':   'networking_event',
                'university-class':   'classroom',
                // Emergency / Health
                'doctors-office':     'doctor_office',
                'pharmacy':           'pharmacy',
                // Language-specific venues
                'israeli-coffee-shop':'israeli_cafe',
                'the-taqueria':       'taqueria',
                'the-french-cafe':    'french_brasserie',
                'the-izakaya':        'japanese_izakaya',
              };
              let resolvedImageUrl: string | null = (scenario.imageUrl as string | null) || null;
              if (!resolvedImageUrl) {
                const sceneName = SCENARIO_SCENE_MAP[slug];
                if (sceneName) {
                  try {
                    const envRow = await sharedDb.execute(
                      sql`SELECT image_url FROM visual_environments WHERE name = ${sceneName} AND image_url IS NOT NULL AND image_url != '' LIMIT 1`
                    );
                    resolvedImageUrl = (envRow.rows[0] as any)?.image_url ?? null;
                  } catch (e) {
                    console.warn('[LoadScenario] Scene image lookup failed:', e);
                  }
                }
              }

              // ── Load scenario zones ──────────────────────────────────────────────
              let zones: any[] = [];
              try {
                const { scenarioZones } = await import('@shared/schema');
                zones = await sharedDb.select().from(scenarioZones)
                  .where(and(eq(scenarioZones.scenarioId, scenario.id), eq(scenarioZones.isActive, true)))
                  .orderBy(scenarioZones.zoneOrder);

                if (zones.length > 0) {
                  // Pre-resolve images from visual_environments for zones that reference one.
                  // A single query fetches all needed environments at once.
                  const envNames = [...new Set(zones.map((z: any) => z.visualEnvironmentName).filter(Boolean))];
                  let envImageMap: Record<string, string> = {};
                  if (envNames.length > 0) {
                    try {
                      const envRows = await sharedDb.execute(
                        sql`SELECT name, image_url FROM visual_environments WHERE name = ANY(${envNames}) AND image_url IS NOT NULL AND image_url != ''`
                      );
                      envImageMap = Object.fromEntries((envRows.rows as any[]).map(r => [r.name, r.image_url]));
                    } catch (e) { /* non-fatal */ }
                  }
                  // Resolve each zone's effective image URL
                  zones = zones.map((z: any) => ({
                    ...z,
                    imageUrl: (z.visualEnvironmentName && envImageMap[z.visualEnvironmentName]) || z.imageUrl || null,
                  }));

                  session.activeScenario!.zones = zones;
                  session.activeScenario!.currentZoneIndex = 0;
                  // Zone 0 overrides the scenario-level resolved image
                  if (zones[0].imageUrl) resolvedImageUrl = zones[0].imageUrl;
                  console.log(`[LoadScenario] Loaded ${zones.length} zones for "${scenario.slug}", zone 0: "${zones[0].name}" (env: ${zones[0].visualEnvironmentName ?? 'none'})`);
                }
              } catch (zoneErr) {
                console.warn('[LoadScenario] Zone load failed (non-fatal):', (zoneErr as Error).message);
              }
              // ─────────────────────────────────────────────────────────────────────

              const currentZone = zones.length > 0 ? zones[0] : null;

              this.sendMessage(session.ws, {
                type: 'scenario_loaded',
                timestamp: Date.now(),
                scenario: {
                  id: scenario.id,
                  slug: scenario.slug,
                  title: scenario.title,
                  description: scenario.description,
                  category: scenario.category,
                  location: scenario.location,
                  defaultMood: scenario.defaultMood,
                  imageUrl: resolvedImageUrl,
                  props: session.activeScenario.props,
                  levelGuide: session.activeScenario.levelGuide,
                  zones: zones.map((z: any) => ({ id: z.id, zoneOrder: z.zoneOrder, name: z.name, imageUrl: z.imageUrl })),
                  currentZoneIndex: 0,
                  currentZoneName: currentZone?.name ?? null,
                },
              });

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{ type: 'scenario', content: scenario.description, data: {
                  location: scenario.location || scenario.title,
                  situation: scenario.description,
                  mood: scenario.defaultMood,
                  isLoading: false,
                  scenarioId: scenario.id,
                  scenarioSlug: scenario.slug,
                }}],
              });
            } else {
              console.warn(`[Native Function→LoadScenario] Scenario not found: ${slug}`);
              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{ type: 'scenario', content: `Scenario "${slug}" not found`, data: {
                  location: 'Unknown',
                  situation: `Could not find scenario: ${slug}`,
                  mood: 'neutral',
                  isLoading: false,
                }}],
              });
            }
          } catch (err: any) {
            console.error(`[Native Function→LoadScenario] Error:`, err);
          }
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
        }
        break;
      }

      case 'ADVANCE_SCENE': {
        const advanceSpokenText = fn.args.spoken_text as string | undefined;
        if (advanceSpokenText && !session.functionCallText) {
          session.functionCallText = advanceSpokenText;
        }

        const activeScenario = session.activeScenario as any;
        if (!activeScenario) {
          console.warn('[Native Function→AdvanceScene] No active scenario');
          break;
        }

        const zones: any[] = activeScenario.zones || [];
        if (zones.length === 0) {
          console.log('[Native Function→AdvanceScene] No zones configured for this scenario — ignoring');
          break;
        }

        const currentIndex: number = activeScenario.currentZoneIndex ?? 0;
        const nextIndex = currentIndex + 1;

        if (nextIndex >= zones.length) {
          // All zones complete — check for chain to another scenario
          const lastZone = zones[zones.length - 1];
          if (lastZone.nextScenarioSlug) {
            console.log(`[Native Function→AdvanceScene] Chain: "${activeScenario.slug}" → "${lastZone.nextScenarioSlug}"`);
            this.sendMessage(session.ws, {
              type: 'scene_zone_advanced',
              timestamp: Date.now(),
              zoneIndex: -1,
              zoneName: null,
              imageUrl: null,
              isChain: true,
              nextScenarioSlug: lastZone.nextScenarioSlug,
            });
          } else {
            console.log('[Native Function→AdvanceScene] Final zone complete, no chain');
            this.sendMessage(session.ws, {
              type: 'scene_zone_advanced',
              timestamp: Date.now(),
              zoneIndex: -1,
              zoneName: null,
              imageUrl: null,
              isComplete: true,
            });
          }
          break;
        }

        activeScenario.currentZoneIndex = nextIndex;
        const nextZone = zones[nextIndex];
        const zoneImageUrl: string | null = nextZone.imageUrl || null;

        console.log(`[Native Function→AdvanceScene] Zone ${currentIndex} → ${nextIndex}: "${nextZone.name}" (image: ${zoneImageUrl ? 'yes' : 'none'})`);

        this.sendMessage(session.ws, {
          type: 'scene_zone_advanced',
          timestamp: Date.now(),
          zoneIndex: nextIndex,
          zoneName: nextZone.name,
          imageUrl: zoneImageUrl,
          description: nextZone.description,
          taskDescription: nextZone.taskDescription,
          isChain: false,
          isComplete: false,
        });
        break;
      }

      case 'SHOW_MENU': {
        const menuText = fn.args.text as string | undefined;
        const mealType = (fn.args.meal_type as string | undefined) || 'dinner';
        const menuTitle = fn.args.title as string | undefined;
        const menuSectionsFromDaniela = fn.args.sections as any[] | undefined;

        if (menuText && !session.functionCallText) session.functionCallText = menuText;

        if (!session.sceneCanvas) {
          console.warn('[Native Function→ShowMenu] No active scene canvas — call open_scene first');
          break;
        }

        const menuPropName = mealType === 'breakfast' ? 'breakfast_menu'
          : mealType === 'lunch' ? 'lunch_menu'
          : mealType === 'cafe' ? 'menu_card'
          : 'dinner_menu';

        // Auto-load culturally appropriate menu from static data based on language + level
        const lang = (session.targetLanguage || 'spanish').toLowerCase();
        const level = (session.difficultyLevel || 'beginner').toLowerCase();

        let resolvedSections: any[] = [];
        if (menuSectionsFromDaniela && menuSectionsFromDaniela.length > 0) {
          // Daniela explicitly provided content — use it
          resolvedSections = menuSectionsFromDaniela;
        } else if (mealType === 'breakfast' && breakfastMenus[lang]?.[level]) {
          resolvedSections = breakfastMenus[lang][level].sections;
        } else if (mealType === 'lunch' && lunchMenus[lang]?.[level]) {
          resolvedSections = lunchMenus[lang][level].sections;
        } else if (mealType === 'cafe' && coffeeShopMenus[lang]?.[level]) {
          resolvedSections = coffeeShopMenus[lang][level].sections;
        } else if (restaurantMenus[lang]?.[level]) {
          resolvedSections = restaurantMenus[lang][level].sections;
        }

        const { getUserDb: getMenuDb } = await import('../db');
        const { sql: menuSql } = await import('drizzle-orm');
        const menuDb = getMenuDb();

        try {
          // Try exact prop name first, fall back to dinner_menu if zone image not found
          const menuAssetResult = await menuDb.execute(menuSql`
            SELECT zone_image_url, display_name FROM visual_assets
            WHERE name = ${menuPropName} AND zone_image_url IS NOT NULL
            LIMIT 1
          `);
          let menuAssetRow = menuAssetResult.rows[0] as any;
          if (!menuAssetRow?.zone_image_url && menuPropName !== 'dinner_menu') {
            const fallbackResult = await menuDb.execute(menuSql`
              SELECT zone_image_url, display_name FROM visual_assets
              WHERE name = 'dinner_menu' AND zone_image_url IS NOT NULL
              LIMIT 1
            `);
            menuAssetRow = fallbackResult.rows[0] as any;
          }
          const menuImageUrl = menuAssetRow?.zone_image_url as string | undefined;

          if (!menuImageUrl) {
            console.warn(`[Native Function→ShowMenu] No zone_image_url for "${menuPropName}" or fallback`);
            break;
          }

          const resolvedMenuTitle = menuTitle
            || menuTitleByLanguage[lang]?.[mealType]
            || (mealType === 'breakfast' ? 'Breakfast Menu'
              : mealType === 'lunch' ? 'Lunch Menu'
              : mealType === 'cafe' ? 'Café Menu'
              : 'Dinner Menu');

          const richContent = {
            type: 'menu' as const,
            title: resolvedMenuTitle,
            content: { sections: resolvedSections },
          };

          const menuCanvasProp = {
            name: menuPropName,
            label: menuAssetRow?.display_name || resolvedMenuTitle,
            position: 'left',
            cx: 0.20,
            cy: 0.60,
            scale: 0.14,
            imageUrl: menuImageUrl,
            richContent,
          };

          if (!session.sceneCanvas.props) session.sceneCanvas.props = [];
          const existingMenuIdx = session.sceneCanvas.props.findIndex((p: any) => p.name === menuPropName);
          if (existingMenuIdx >= 0) {
            session.sceneCanvas.props[existingMenuIdx] = menuCanvasProp;
          } else {
            session.sceneCanvas.props.push(menuCanvasProp);
          }

          const menuUpdate = {
            type: 'whiteboard_update' as const,
            timestamp: Date.now(),
            items: [{
              id: 'scene-canvas-active',
              type: 'scene_canvas',
              content: session.sceneCanvas.environmentLabel || session.sceneCanvas.environment,
              data: {
                environment: session.sceneCanvas.environment,
                environmentImageUrl: session.sceneCanvas.environmentImageUrl,
                environmentLabel: session.sceneCanvas.environmentLabel,
                props: [...session.sceneCanvas.props],
                clockTime: session.sceneCanvas.clockTime,
                canvasAction: 'add_prop' as const,
              },
            }],
          };

          if (session.firstAudioSent) {
            this.sendMessage(session.ws, menuUpdate);
          } else {
            if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
            session.pendingWhiteboardUpdates.push(menuUpdate);
          }
          console.log(`[Native Function→ShowMenu] Placed "${menuPropName}" on scene with ${menuSections?.length || 0} sections`);
        } catch (err: any) {
          console.error('[Native Function→ShowMenu] Error:', err.message);
        }
        break;
      }

      case 'SHOW_BILL': {
        const billText = fn.args.text as string | undefined;
        const billTitle = fn.args.title as string | undefined;
        const billItems = fn.args.items as Array<{ label: string; value: string }> | undefined;
        const billSubtotal = fn.args.subtotal as string | undefined;
        const billService = fn.args.service as string | undefined;
        const billTax = fn.args.tax as string | undefined;
        const billTotal = fn.args.total as string | undefined;

        if (billText && !session.functionCallText) session.functionCallText = billText;

        if (!session.sceneCanvas) {
          console.warn('[Native Function→ShowBill] No active scene canvas — call open_scene first');
          break;
        }

        const { getUserDb: getBillDb } = await import('../db');
        const { sql: billSql } = await import('drizzle-orm');
        const billDb = getBillDb();

        try {
          const billAssetResult = await billDb.execute(billSql`
            SELECT COALESCE(zone_image_url, image_url) as prop_url, display_name
            FROM visual_assets
            WHERE name = 'restaurant_bill'
            LIMIT 1
          `);
          const billAssetRow = billAssetResult.rows[0] as any;
          const billImageUrl = billAssetRow?.prop_url as string | undefined;

          if (!billImageUrl) {
            console.warn('[Native Function→ShowBill] No image for restaurant_bill');
            break;
          }

          // Build bill fields: items + breakdown
          const fields: Array<{ label: string; value: string }> = [];
          if (billItems) {
            for (const item of billItems) {
              fields.push({ label: item.label, value: item.value });
            }
          }
          if (billSubtotal) fields.push({ label: 'Subtotal', value: billSubtotal });
          if (billService) fields.push({ label: 'Service', value: billService });
          if (billTax) fields.push({ label: 'Tax', value: billTax });
          if (billTotal) fields.push({ label: 'Total', value: billTotal });

          const resolvedBillTitle = billTitle || 'Bill';
          const richContent = {
            type: 'bill' as const,
            title: resolvedBillTitle,
            content: { fields },
          };

          const billCanvasProp = {
            name: 'restaurant_bill',
            label: resolvedBillTitle,
            position: 'right',
            cx: 0.72,
            cy: 0.70,
            scale: 0.14,
            imageUrl: billImageUrl,
            richContent,
          };

          if (!session.sceneCanvas.props) session.sceneCanvas.props = [];
          const existingBillIdx = session.sceneCanvas.props.findIndex((p: any) => p.name === 'restaurant_bill');
          if (existingBillIdx >= 0) {
            session.sceneCanvas.props[existingBillIdx] = billCanvasProp;
          } else {
            session.sceneCanvas.props.push(billCanvasProp);
          }

          const billUpdate = {
            type: 'whiteboard_update' as const,
            timestamp: Date.now(),
            items: [{
              id: 'scene-canvas-active',
              type: 'scene_canvas',
              content: session.sceneCanvas.environmentLabel || session.sceneCanvas.environment,
              data: {
                environment: session.sceneCanvas.environment,
                environmentImageUrl: session.sceneCanvas.environmentImageUrl,
                environmentLabel: session.sceneCanvas.environmentLabel,
                props: [...session.sceneCanvas.props],
                clockTime: session.sceneCanvas.clockTime,
                canvasAction: 'add_prop' as const,
              },
            }],
          };

          if (session.firstAudioSent) {
            this.sendMessage(session.ws, billUpdate);
          } else {
            if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
            session.pendingWhiteboardUpdates.push(billUpdate);
          }
          console.log(`[Native Function→ShowBill] Placed restaurant_bill on scene with ${fields.length} fields`);
        } catch (err: any) {
          console.error('[Native Function→ShowBill] Error:', err.message);
        }
        break;
      }

      case 'UPDATE_PROP': {
        const text = fn.args.text as string | undefined;
        const propTitle = fn.args.prop_title as string | undefined;
        const updates = fn.args.updates as Array<{ label: string; value: string }> | undefined;
        const activeScenario = session.activeScenario;

        if (propTitle && updates && updates.length > 0 && activeScenario?.props) {
          const targetProp = activeScenario.props.find((p: any) =>
            p.title?.toLowerCase() === propTitle.toLowerCase()
          );

          const resolvedContent = targetProp?.content?.byDifficulty
            ? (targetProp.content.byDifficulty[session.difficultyLevel]
              || targetProp.content.byDifficulty.intermediate
              || targetProp.content.byDifficulty.beginner
              || targetProp.content)
            : targetProp?.content;

          const BILL_LABEL_ALIASES: Record<string, string[]> = {
            'items': ['artículos', 'detalle de consumo', 'detalle de consumiciones', 'artículos adquiridos', 'detalle'],
            'subtotal': ['base imponible', 'subtotal'],
            'total': ['total', 'total a pagar', 'importe total'],
            'tax': ['iva', 'impuesto', 'tax'],
            'establishment': ['establecimiento', 'local', 'comercio'],
            'date': ['fecha', 'date'],
            'driver': ['conductor', 'chofer'],
            'fare': ['tarifa', 'importe del trayecto'],
            'tip': ['propina'],
            'from': ['origen', 'recogida'],
            'to': ['destino', 'destino final'],
            'distance': ['distancia', 'recorrido'],
            'vendor': ['puesto', 'vendedor'],
            'tickets': ['entradas', 'admisión'],
            'audio guide': ['audioguía', 'guía de audio'],
            'gift shop': ['tienda', 'tienda del museo'],
            'service': ['servicio', 'coperto', 'cubierto'],
            'guest': ['huésped', 'titular'],
            'room': ['habitación'],
            'nights': ['noches', 'estancias'],
            'room charge': ['tarifa de alojamiento', 'cargo de habitación'],
            'extras': ['cargos por servicios complementarios', 'extras'],
          };

          if (targetProp && resolvedContent?.fields) {
            for (const update of updates) {
              const updateLabel = update.label.toLowerCase();
              const field = resolvedContent.fields.find((f: any) => {
                const fl = f.label?.toLowerCase() || '';
                if (fl === updateLabel) return true;
                if (fl.includes(' / ')) {
                  const parts = fl.split(' / ').map((s: string) => s.trim().toLowerCase());
                  if (parts.some((p: string) => p === updateLabel || updateLabel.includes(p) || p.includes(updateLabel))) return true;
                }
                if (fl.includes(updateLabel) || updateLabel.includes(fl)) return true;
                const aliases = BILL_LABEL_ALIASES[updateLabel];
                if (aliases && aliases.some(a => fl.includes(a) || a.includes(fl))) return true;
                for (const [key, vals] of Object.entries(BILL_LABEL_ALIASES)) {
                  if (vals.some(v => v === updateLabel || updateLabel.includes(v))) {
                    if (fl.includes(key) || key.includes(fl) || vals.some(v => fl.includes(v))) return true;
                  }
                }
                return false;
              });
              if (field) {
                field.value = update.value;
              } else {
                resolvedContent.fields.push({ label: update.label, value: update.value });
              }
            }

            console.log(`[Native Function→UpdateProp] Updated "${propTitle}": ${updates.map(u => `${u.label}=${u.value}`).join(', ')}`);

            this.sendMessage(session.ws, {
              type: 'prop_update',
              timestamp: Date.now(),
              propTitle,
              updates,
              updatedFields: resolvedContent.fields,
            });
          } else {
            console.warn(`[Native Function→UpdateProp] Prop "${propTitle}" not found or has no fields`);
          }
        } else {
          console.warn(`[Native Function→UpdateProp] Missing required args or no active scenario`);
        }

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }
        break;
      }

      case 'END_SCENARIO': {
        const spokenText = (fn.args.spoken_text || fn.args.text) as string | undefined;
        const performanceNotes = (fn.args.feedback || fn.args.performance_notes) as string | undefined;
        const activeScenario = session.activeScenario;

        if (activeScenario) {
          console.log(`[Native Function→EndScenario] Ending "${activeScenario.title}"`);

          if (session.userId && activeScenario.id) {
            try {
              const { userScenarioHistory } = await import('@shared/schema');
              const sharedDb = getSharedDb();
              const durationSeconds = Math.round((Date.now() - (activeScenario.startedAt || Date.now())) / 1000);

              await sharedDb.update(userScenarioHistory)
                .set({
                  completedAt: new Date(),
                  durationSeconds,
                  performanceNotes: performanceNotes || undefined,
                })
                .where(and(
                  eq(userScenarioHistory.userId, String(session.userId)),
                  eq(userScenarioHistory.scenarioId, activeScenario.id),
                ));
            } catch (err: any) {
              console.warn('[EndScenario] History update failed:', err.message);
            }
          }

          this.sendMessage(session.ws, {
            type: 'scenario_ended',
            timestamp: Date.now(),
            scenarioId: activeScenario.id,
            scenarioSlug: activeScenario.slug,
            performanceNotes: performanceNotes || undefined,
          });

          session.activeScenario = null;
        } else {
          console.log('[Native Function→EndScenario] No active scenario to end');
        }

        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
        }
        break;
      }
      
      case 'SUMMARY': {
        const summaryTitle = (fn.args.title as string | undefined) || "Session Summary";
        const summaryItems = fn.args.items as string | undefined;
        const summaryPoints = fn.args.points as string | undefined;
        const rawContent = summaryItems || summaryPoints || '';
        
        if (rawContent || summaryTitle) {
          const lines = rawContent.split('\n').map((l: string) => l.replace(/^\*\*|\*\*$/g, '').replace(/\*\*/g, '').trim()).filter(Boolean);
          const summaryData = {
            title: summaryTitle,
            words: lines,
            phrases: [] as string[],
            totalItems: lines.length,
          };
          console.log(`[Native Function→Summary] title="${summaryTitle}" ${lines.length} points`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'summary', content: rawContent, data: summaryData }],
          });
        } else {
          console.warn(`[Native Function→Summary] No title or items provided, skipping. Args: ${JSON.stringify(fn.args).substring(0, 200)}`);
        }
        break;
      }
      
      case 'READING': {
        const passage = (fn.args.content || fn.args.passage) as string | undefined;
        const readingTitle = fn.args.title as string | undefined;
        const translation = fn.args.translation as string | undefined;
        
        if (passage) {
          const readingData = {
            character: passage,
            reading: translation || '',
            title: readingTitle || undefined,
            language: session.targetLanguage || undefined,
          };
          console.log(`[Native Function→Reading] "${passage.substring(0, 50)}..."${readingTitle ? ` title="${readingTitle}"` : ''}${translation ? ` translation="${translation.substring(0, 50)}..."` : ''}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'reading', content: passage, data: readingData, translation }],
          });
        } else {
          console.warn(`[Native Function→Reading] No content/passage provided. Args: ${JSON.stringify(fn.args).substring(0, 200)}`);
        }
        break;
      }
      
      case 'PLAY': {
        const description = fn.args.description as string | undefined;
        const playText = fn.args.text as string | undefined;
        
        if (playText && !session.functionCallText) {
          session.functionCallText = playText;
        }
        
        if (description) {
          console.log(`[Native Function→Play] "${description.substring(0, 50)}..."`);
          
          let audioUrl: string | undefined;
          let audioDurationMs: number | undefined;
          
          try {
            const { getCachedPronunciationAudio } = await import('./audio-caching-service');
            const targetLanguage = session.targetLanguage || 'spanish';
            const voiceGender = session.voiceGender || 'female';
            
            const result = await getCachedPronunciationAudio(
              description,
              targetLanguage,
              voiceGender as 'female' | 'male',
              'normal',
              { contentType: 'pronunciation' }
            );
            
            audioUrl = result.audioUrl;
            audioDurationMs = result.durationMs || undefined;
            console.log(`[Native Function→Play] ${result.cacheHit ? 'Cache HIT' : 'Generated'}: got audio (${audioDurationMs}ms)`);
          } catch (error: any) {
            console.warn(`[Native Function→Play] Failed to get cached audio: ${error.message}`);
          }
          
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ 
              type: 'play', 
              content: description,
              data: {
                text: description,
                speed: 'normal' as const,
                audioUrl,
                audioDurationMs,
              },
            }],
          });
        }
        break;
      }
      
      case 'STROKE': {
        const character = fn.args.character as string | undefined;
        const strokeText = fn.args.text as string | undefined;
        
        if (strokeText && !session.functionCallText) {
          session.functionCallText = strokeText;
        }
        
        if (character) {
          const strokeData = {
            character,
            language: (fn.args.language as string | undefined)?.toLowerCase() || undefined,
            strokes: [],
          };
          console.log(`[Native Function→Stroke] Character: ${character}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'stroke', content: character, data: strokeData }],
          });
        }
        break;
      }
      
      case 'TONE': {
        const syllable = (fn.args.syllable || fn.args.pinyin) as string | undefined;
        const toneNumber = fn.args.toneNumber as number | undefined;
        const toneText = fn.args.text as string | undefined;
        
        if (syllable) {
          const toneNumbers = toneNumber ? [toneNumber] : (syllable.match(/\d/g)?.map(Number) || []);
          const toneData = {
            word: syllable,
            pinyin: syllable,
            tones: toneNumbers,
            language: 'mandarin',
            meaning: undefined as string | undefined,
          };
          console.log(`[Native Function→Tone] Syllable: ${syllable} tones: ${toneNumbers}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'tone', content: syllable, data: toneData }],
          });
        }
        if (toneText && !session.functionCallText) {
          session.functionCallText = toneText;
        }
        break;
      }
      
      case 'PRONUNCIATION_TAG': {
        const word = fn.args.word as string | undefined;
        const ipa = fn.args.ipa as string | undefined;
        const hint = fn.args.hint as string | undefined;
        const language = fn.args.language as string | undefined;
        
        if (word) {
          const tagLanguage = language || session.targetLanguage || 'spanish';
          console.log(`[Native Function→PronunciationTag] [${tagLanguage}:${word}]${ipa ? ` IPA: ${ipa}` : ''}${hint ? ` hint: ${hint}` : ''}`);
          if (!session.pendingPronunciationTags) {
            session.pendingPronunciationTags = [];
          }
          session.pendingPronunciationTags.push({ word, language: tagLanguage, ipa, hint });
        }
        break;
      }

      case 'BROWSE_SYLLABUS': {
        const text = fn.args.text as string | undefined;
        const unitNumber = (fn.args.unitNumber || fn.args.unit_number) as number | undefined;
        const showCompleted = (fn.args.showCompleted ?? fn.args.show_completed) !== false;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const studentId = String(session.userId);
            const enrollments = await storage.getStudentEnrollments(studentId);
            const activeClass = enrollments.find(e =>
              e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
            );

            if (activeClass?.class) {
              const classId = activeClass.class.id;
              const units = await storage.getClassCurriculumUnits(classId);
              const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

              const filteredUnits = unitNumber
                ? activeUnits.filter((_, i) => i + 1 === unitNumber)
                : activeUnits;

              const syllabusProgress = await storage.getSyllabusProgress(studentId, classId);
              const progressMap = new Map(syllabusProgress.map(sp => [sp.lessonId, sp]));

              const syllabusData: Array<{
                unitName: string;
                unitIndex: number;
                actflLevel: string | null;
                lessons: Array<{
                  id: string;
                  name: string;
                  type: string;
                  status: string;
                  orderIndex: number;
                }>;
              }> = [];

              for (const unit of filteredUnits) {
                const lessons = await storage.getClassCurriculumLessons(unit.id);
                const activeLessons = lessons
                  .filter(l => !l.isRemoved)
                  .sort((a, b) => a.orderIndex - b.orderIndex);

                const lessonData = activeLessons
                  .map(l => {
                    const progress = progressMap.get(l.sourceLessonId || l.id);
                    const status = progress?.status || 'not_started';
                    return {
                      id: l.sourceLessonId || l.id,
                      name: l.name,
                      type: l.lessonType,
                      status,
                      orderIndex: l.orderIndex,
                    };
                  })
                  .filter(l => showCompleted || l.status !== 'completed_assigned');

                syllabusData.push({
                  unitName: unit.name,
                  unitIndex: unit.orderIndex,
                  actflLevel: unit.actflLevel,
                  lessons: lessonData,
                });
              }

              const totalLessons = syllabusData.reduce((sum, u) => sum + u.lessons.length, 0);
              const completedLessons = syllabusData.reduce(
                (sum, u) => sum + u.lessons.filter(l => l.status === 'completed_assigned' || l.status === 'completed_early').length, 0
              );

              console.log(`[Native Function→BrowseSyllabus] ${syllabusData.length} units, ${totalLessons} lessons (${completedLessons} completed)`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Syllabus: ${activeClass.class.name}`,
                  data: {
                    syllabusOverview: true,
                    className: activeClass.class.name,
                    units: syllabusData,
                    totalLessons,
                    completedLessons,
                    progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastSyllabusData = syllabusData;
            } else {
              console.log(`[Native Function→BrowseSyllabus] No active class found for ${session.targetLanguage}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→BrowseSyllabus] Error:`, err.message);
          }
        }
        break;
      }

      case 'START_LESSON': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lessonId || fn.args.lesson_id) as string | undefined;
        const lessonName = (fn.args.lessonName || fn.args.lesson_name) as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const { curriculumLessons, curriculumDrillItems, classCurriculumLessons, classCurriculumUnits } = await import('@shared/schema');
            const sharedDb = getSharedDb();

            let lesson: any = null;

            if (lessonId) {
              const [found] = await sharedDb.select().from(curriculumLessons).where(eq(curriculumLessons.id, lessonId)).limit(1);
              lesson = found;
            }

            if (!lesson && lessonName) {
              const studentId = String(session.userId);
              const enrollments = await storage.getStudentEnrollments(studentId);
              const activeClass = enrollments.find(e =>
                e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
              );

              if (activeClass?.class) {
                const units = await storage.getClassCurriculumUnits(activeClass.class.id);
                const activeUnitIds = units.filter(u => !u.isRemoved).map(u => u.id);

                if (activeUnitIds.length > 0) {
                  const classLessons = await storage.getClassCurriculumLessonsForUnits(activeUnitIds);
                  const match = classLessons.find(l =>
                    !l.isRemoved && l.name.toLowerCase().includes(lessonName.toLowerCase())
                  );

                  if (match?.sourceLessonId) {
                    const [found] = await sharedDb.select().from(curriculumLessons).where(eq(curriculumLessons.id, match.sourceLessonId)).limit(1);
                    lesson = found;
                  }
                }
              }
            }

            if (lesson) {
              const drills = await sharedDb.select().from(curriculumDrillItems)
                .where(eq(curriculumDrillItems.lessonId, lesson.id))
                .orderBy(curriculumDrillItems.orderIndex);

              session.lessonBundleContext = {
                lessonId: lesson.id,
                lessonName: lesson.name,
                hasBundledDrills: drills.length > 0,
                bundleId: lesson.bundleId || undefined,
                linkedDrillLessonId: lesson.linkedDrillLessonId || undefined,
                drillsProvisioned: drills.length > 0,
                provisionedDrillCount: drills.length,
              };

              const lessonContent = {
                id: lesson.id,
                name: lesson.name,
                type: lesson.lessonType,
                description: lesson.description,
                objectives: lesson.objectives || [],
                conversationTopic: lesson.conversationTopic,
                conversationPrompt: lesson.conversationPrompt,
                requiredVocabulary: lesson.requiredVocabulary || [],
                requiredGrammar: lesson.requiredGrammar || [],
                estimatedMinutes: lesson.estimatedMinutes,
                drillCount: drills.length,
              };

              console.log(`[Native Function→StartLesson] Loaded "${lesson.name}" (${lesson.id}) with ${drills.length} drills`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Lesson: ${lesson.name}`,
                  data: {
                    lessonLoaded: true,
                    lesson: lessonContent,
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastLoadedLesson = lessonContent;
            } else {
              console.warn(`[Native Function→StartLesson] Lesson not found: id=${lessonId} name=${lessonName}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→StartLesson] Error:`, err.message);
          }
        }
        break;
      }

      case 'LOAD_VOCAB_SET': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lessonId || fn.args.lesson_id) as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId && lessonId) {
          try {
            const { curriculumLessons } = await import('@shared/schema');
            const sharedDb = getSharedDb();

            const [lesson] = await sharedDb.select().from(curriculumLessons).where(eq(curriculumLessons.id, lessonId)).limit(1);

            if (lesson) {
              const vocabWords = lesson.requiredVocabulary || [];

              const vocabData = vocabWords.map((word: string, index: number) => ({
                word,
                index,
              }));

              console.log(`[Native Function→LoadVocabSet] Loaded ${vocabData.length} vocab items for "${lesson.name}"`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Vocabulary: ${lesson.name}`,
                  data: {
                    vocabSetLoaded: true,
                    lessonId: lesson.id,
                    lessonName: lesson.name,
                    vocabulary: vocabData,
                    totalWords: vocabData.length,
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastVocabSet = vocabData;
            } else {
              console.warn(`[Native Function→LoadVocabSet] Lesson not found: ${lessonId}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→LoadVocabSet] Error:`, err.message);
          }
        }
        break;
      }

      case 'SHOW_PROGRESS': {
        const text = fn.args.text as string | undefined;
        const detailed = fn.args.detailed === true;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const studentId = String(session.userId);
            const enrollments = await storage.getStudentEnrollments(studentId);
            const activeClass = enrollments.find(e =>
              e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
            );

            const actflProgress = await storage.getOrCreateActflProgress(session.targetLanguage || 'spanish', studentId).catch(() => null);
            const userProgressData = await storage.getOrCreateUserProgress(session.targetLanguage || 'spanish', studentId).catch(() => null);

            const progressData: Record<string, unknown> = {
              actflLevel: actflProgress?.currentActflLevel || 'Novice Low',
              wordsLearned: userProgressData?.wordsLearned || 0,
              lessonsCompleted: userProgressData?.lessonsCompleted || 0,
              totalMinutes: userProgressData?.totalMinutes || 0,
              streakDays: userProgressData?.streakDays || 0,
            };

            if (activeClass?.class) {
              const classId = activeClass.class.id;
              const units = await storage.getClassCurriculumUnits(classId);
              const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

              const syllabusProgress = await storage.getSyllabusProgress(studentId, classId);
              const progressMap = new Map(syllabusProgress.map(sp => [sp.lessonId, sp]));

              let totalLessons = 0;
              let completedLessons = 0;
              let inProgressLessons = 0;
              const unitBreakdown: Array<{ name: string; total: number; completed: number; }> = [];

              for (const unit of activeUnits) {
                const lessons = await storage.getClassCurriculumLessons(unit.id);
                const activeLessons = lessons.filter(l => !l.isRemoved);
                const unitCompleted = activeLessons.filter(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return p?.status === 'completed_assigned' || p?.status === 'completed_early';
                }).length;
                const unitInProgress = activeLessons.filter(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return p?.status === 'in_progress';
                }).length;

                totalLessons += activeLessons.length;
                completedLessons += unitCompleted;
                inProgressLessons += unitInProgress;

                if (detailed) {
                  unitBreakdown.push({
                    name: unit.name,
                    total: activeLessons.length,
                    completed: unitCompleted,
                  });
                }
              }

              progressData.className = activeClass.class.name;
              progressData.totalLessons = totalLessons;
              progressData.completedLessons = completedLessons;
              progressData.inProgressLessons = inProgressLessons;
              progressData.progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
              if (detailed) {
                progressData.unitBreakdown = unitBreakdown;
              }
            }

            console.log(`[Native Function→ShowProgress] ACTFL: ${progressData.actflLevel}, ${progressData.completedLessons || 0}/${progressData.totalLessons || '?'} lessons`);

            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              items: [{
                type: 'write',
                content: `Progress: ${progressData.actflLevel}`,
                data: {
                  progressSnapshot: true,
                  ...progressData,
                },
              }],
            });
          } catch (err: any) {
            console.error(`[Native Function→ShowProgress] Error:`, err.message);
          }
        }
        break;
      }

      case 'RECOMMEND_NEXT': {
        const text = fn.args.text as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const studentId = String(session.userId);
            const enrollments = await storage.getStudentEnrollments(studentId);
            const activeClass = enrollments.find(e =>
              e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
            );

            if (activeClass?.class) {
              const classId = activeClass.class.id;
              const units = await storage.getClassCurriculumUnits(classId);
              const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

              const syllabusProgress = await storage.getSyllabusProgress(studentId, classId);
              const progressMap = new Map(syllabusProgress.map(sp => [sp.lessonId, sp]));

              let recommended: { lessonId: string; lessonName: string; unitName: string; reason: string; } | null = null;

              for (const unit of activeUnits) {
                const lessons = await storage.getClassCurriculumLessons(unit.id);
                const activeLessons = lessons.filter(l => !l.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

                const inProgressLesson = activeLessons.find(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return p?.status === 'in_progress';
                });

                if (inProgressLesson) {
                  recommended = {
                    lessonId: inProgressLesson.sourceLessonId || inProgressLesson.id,
                    lessonName: inProgressLesson.name,
                    unitName: unit.name,
                    reason: 'You started this lesson but haven\'t finished it yet. Let\'s pick up where you left off!',
                  };
                  break;
                }

                const nextLesson = activeLessons.find(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return !p || p.status === 'not_started';
                });

                if (nextLesson) {
                  recommended = {
                    lessonId: nextLesson.sourceLessonId || nextLesson.id,
                    lessonName: nextLesson.name,
                    unitName: unit.name,
                    reason: 'This is the next lesson in your syllabus. Ready to learn something new!',
                  };
                  break;
                }
              }

              if (recommended) {
                console.log(`[Native Function→RecommendNext] Recommending "${recommended.lessonName}" from ${recommended.unitName}`);

                this.sendMessage(session.ws, {
                  type: 'whiteboard_update',
                  timestamp: Date.now(),
                  items: [{
                    type: 'write',
                    content: `Recommended: ${recommended.lessonName}`,
                    data: {
                      recommendation: true,
                      lessonId: recommended.lessonId,
                      lessonName: recommended.lessonName,
                      unitName: recommended.unitName,
                      reason: recommended.reason,
                    },
                  }],
                });

                if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
                session.pendingMemoryLookupPromises.push(Promise.resolve());
                session.lastRecommendation = recommended;
              } else {
                console.log(`[Native Function→RecommendNext] No lessons available to recommend`);
                this.sendMessage(session.ws, {
                  type: 'whiteboard_update',
                  timestamp: Date.now(),
                  items: [{
                    type: 'write',
                    content: 'Congratulations! You\'ve completed all available lessons!',
                    data: { recommendation: true, allComplete: true },
                  }],
                });
              }
            } else {
              console.log(`[Native Function→RecommendNext] No active class found for ${session.targetLanguage}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→RecommendNext] Error:`, err.message);
          }
        }
        break;
      }

      case 'DRILL_SESSION': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lessonId || fn.args.lesson_id) as string | undefined;
        const requestedDrillType = (fn.args.drillType || fn.args.drill_type) as string | undefined;
        const requestedCount = (fn.args.count as number | undefined) || 10;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const { arisDrillAssignments } = await import('@shared/schema');
            const { eq, and } = await import('drizzle-orm');
            const db = (await import('../db')).db;

            let targetLessonId = lessonId;
            if (!targetLessonId && session.lastLoadedLesson) {
              targetLessonId = session.lastLoadedLesson.id;
            }

            let drillItems: Array<{ prompt: string; expectedAnswer?: string; options?: string[]; pronunciation?: string; drillType?: string }> = [];

            if (targetLessonId) {
              const assignments = await db.select().from(arisDrillAssignments)
                .where(and(
                  eq(arisDrillAssignments.userId, String(session.userId)),
                  eq(arisDrillAssignments.lessonId, targetLessonId),
                ));

              for (const a of assignments) {
                if (requestedDrillType && a.drillType !== requestedDrillType) continue;
                if (a.drillContent && Array.isArray((a.drillContent as any).items)) {
                  for (const item of (a.drillContent as any).items) {
                    drillItems.push({ ...item, drillType: a.drillType });
                  }
                }
              }
            }

            if (drillItems.length === 0 && targetLessonId) {
              const assignments = await db.select().from(arisDrillAssignments)
                .where(and(
                  eq(arisDrillAssignments.userId, String(session.userId)),
                  eq(arisDrillAssignments.targetLanguage, session.targetLanguage || 'spanish'),
                ));

              for (const a of assignments) {
                if (requestedDrillType && a.drillType !== requestedDrillType) continue;
                if (a.drillContent && Array.isArray((a.drillContent as any).items)) {
                  for (const item of (a.drillContent as any).items) {
                    drillItems.push({ ...item, drillType: a.drillType });
                  }
                }
                if (drillItems.length >= requestedCount) break;
              }
            }

            if (drillItems.length > requestedCount) {
              drillItems = drillItems.slice(0, requestedCount);
            }

            if (drillItems.length > 0) {
              const sessionState = {
                items: drillItems,
                currentIndex: 0,
                correctCount: 0,
                incorrectCount: 0,
                totalItems: drillItems.length,
                startTime: Date.now(),
                lessonId: targetLessonId,
              };
              session.drillSession = sessionState;

              const firstItem = drillItems[0];
              const { parseDrillContent } = await import('@shared/whiteboard-types');
              const drillData = parseDrillContent(firstItem.drillType || 'repeat', firstItem.prompt);

              console.log(`[Native Function→DrillSession] Started session with ${drillItems.length} items`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'drill',
                  content: firstItem.prompt,
                  data: { ...drillData, sessionProgress: `1 / ${drillItems.length}` },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDrillSessionData = {
                totalItems: drillItems.length,
                currentItem: 1,
                firstDrill: { type: firstItem.drillType, prompt: firstItem.prompt },
              };
            } else {
              console.log(`[Native Function→DrillSession] No drill items found`);
              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDrillSessionData = { totalItems: 0, noDrillsAvailable: true };
            }
          } catch (err: any) {
            console.error(`[Native Function→DrillSession] Error:`, err.message);
          }
        }
        break;
      }

      case 'DRILL_SESSION_NEXT': {
        const text = fn.args.text as string | undefined;
        const wasCorrect = fn.args.was_correct as boolean | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        const drillSession = session.drillSession;
        if (drillSession) {
          if (wasCorrect === true) drillSession.correctCount++;
          else if (wasCorrect === false) drillSession.incorrectCount++;

          drillSession.currentIndex++;

          if (drillSession.currentIndex < drillSession.totalItems) {
            const nextItem = drillSession.items[drillSession.currentIndex];
            const { parseDrillContent } = await import('@shared/whiteboard-types');
            const drillData = parseDrillContent(nextItem.drillType || 'repeat', nextItem.prompt);

            console.log(`[Native Function→DrillSessionNext] Item ${drillSession.currentIndex + 1}/${drillSession.totalItems}`);

            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              items: [{
                type: 'drill',
                content: nextItem.prompt,
                data: { ...drillData, sessionProgress: `${drillSession.currentIndex + 1} / ${drillSession.totalItems}` },
              }],
            });

            if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
            session.pendingMemoryLookupPromises.push(Promise.resolve());
            session.lastDrillSessionData = {
              totalItems: drillSession.totalItems,
              currentItem: drillSession.currentIndex + 1,
              correctSoFar: drillSession.correctCount,
              incorrectSoFar: drillSession.incorrectCount,
              nextDrill: { type: nextItem.drillType, prompt: nextItem.prompt },
            };
          } else {
            const elapsed = Math.round((Date.now() - drillSession.startTime) / 1000);
            const accuracy = drillSession.totalItems > 0
              ? Math.round((drillSession.correctCount / drillSession.totalItems) * 100) : 0;

            console.log(`[Native Function→DrillSessionNext] Session complete! ${drillSession.correctCount}/${drillSession.totalItems}`);

            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              items: [{
                type: 'summary',
                content: 'Practice Session Complete',
                data: {
                  title: 'Practice Session Complete',
                  stats: [
                    { label: 'Items Completed', value: String(drillSession.totalItems) },
                    { label: 'Correct', value: String(drillSession.correctCount) },
                    { label: 'Incorrect', value: String(drillSession.incorrectCount) },
                    { label: 'Accuracy', value: `${accuracy}%` },
                    { label: 'Duration', value: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` },
                  ],
                },
              }],
            });

            if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
            session.pendingMemoryLookupPromises.push(Promise.resolve());
            session.lastDrillSessionData = {
              sessionComplete: true,
              totalItems: drillSession.totalItems,
              correct: drillSession.correctCount,
              incorrect: drillSession.incorrectCount,
              accuracy,
              durationSeconds: elapsed,
            };
            delete session.drillSession;
          }
        } else {
          console.log(`[Native Function→DrillSessionNext] No active drill session`);
        }
        break;
      }

      case 'DRILL_SESSION_END': {
        const text = fn.args.text as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        const activeDrillSession = session.drillSession;
        if (activeDrillSession) {
          const elapsed = Math.round((Date.now() - activeDrillSession.startTime) / 1000);
          const completed = activeDrillSession.currentIndex;
          const accuracy = completed > 0
            ? Math.round((activeDrillSession.correctCount / completed) * 100) : 0;

          console.log(`[Native Function→DrillSessionEnd] Ending early at ${completed}/${activeDrillSession.totalItems}`);

          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{
              type: 'summary',
              content: 'Practice Session Summary',
              data: {
                title: 'Practice Session Summary',
                stats: [
                  { label: 'Items Attempted', value: `${completed} of ${activeDrillSession.totalItems}` },
                  { label: 'Correct', value: String(activeDrillSession.correctCount) },
                  { label: 'Incorrect', value: String(activeDrillSession.incorrectCount) },
                  { label: 'Accuracy', value: `${accuracy}%` },
                  { label: 'Duration', value: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` },
                ],
              },
            }],
          });

          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(Promise.resolve());
          session.lastDrillSessionData = {
            sessionComplete: true,
            endedEarly: true,
            itemsAttempted: completed,
            totalItems: activeDrillSession.totalItems,
            correct: activeDrillSession.correctCount,
            incorrect: activeDrillSession.incorrectCount,
            accuracy,
            durationSeconds: elapsed,
          };
          delete session.drillSession;
        }
        break;
      }

      case 'REVIEW_DUE_VOCAB': {
        const text = fn.args.text as string | undefined;
        const maxItems = (fn.args.limit || fn.args.max_items) as number || 10;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const { vocabularyWords } = await import('@shared/schema');
            const { eq, and, lte } = await import('drizzle-orm');
            const db = (await import('../db')).db;

            const now = new Date();
            const dueWords = await db.select().from(vocabularyWords)
              .where(and(
                eq(vocabularyWords.userId, String(session.userId)),
                eq(vocabularyWords.language, session.targetLanguage || 'spanish'),
                lte(vocabularyWords.nextReviewDate, now),
              ))
              .orderBy(vocabularyWords.nextReviewDate)
              .limit(maxItems);

            if (dueWords.length > 0) {
              const vocabList = dueWords.map(w => ({
                id: w.id,
                word: w.word,
                translation: w.translation,
                pronunciation: w.pronunciation,
                difficulty: w.difficulty,
                correctCount: w.correctCount,
                incorrectCount: w.incorrectCount,
                interval: w.interval,
              }));

              console.log(`[Native Function→ReviewDueVocab] Found ${dueWords.length} words due for review`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Vocabulary Review: ${dueWords.length} words due`,
                  data: {
                    vocabReview: true,
                    words: vocabList.map(w => `${w.word} → ${w.translation}`),
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDueVocab = vocabList;
            } else {
              console.log(`[Native Function→ReviewDueVocab] No words due for review`);
              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDueVocab = [];
            }
          } catch (err: any) {
            console.error(`[Native Function→ReviewDueVocab] Error:`, err.message);
          }
        }
        break;
      }

      case 'MARK_LESSON_COVERED': {
        const lessonId = fn.args.lessonId as string | undefined;
        const text = fn.args.text as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (lessonId && session.userId) {
          try {
            const { studentLessonProgress } = await import('@shared/schema');
            const { eq, and } = await import('drizzle-orm');
            const { getUserDb } = await import('../db');
            const db = getUserDb();

            // Upsert: set coveredByDaniela = true, update timestamp
            const existing = await db.select()
              .from(studentLessonProgress)
              .where(and(
                eq(studentLessonProgress.studentId, String(session.userId)),
                eq(studentLessonProgress.lessonId, lessonId),
              ))
              .limit(1);

            if (existing.length > 0) {
              await db.update(studentLessonProgress)
                .set({ status: 'completed', updatedAt: new Date() })
                .where(and(
                  eq(studentLessonProgress.studentId, String(session.userId)),
                  eq(studentLessonProgress.lessonId, lessonId),
                ));
            } else {
              await db.insert(studentLessonProgress).values({
                studentId: String(session.userId),
                lessonId,
                status: 'completed',
                updatedAt: new Date(),
              });
            }

            console.log(`[Native Function→MarkLessonCovered] Lesson "${lessonId}" marked covered for user ${session.userId}`);
            if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
            session.pendingMemoryLookupPromises.push(Promise.resolve());
            (session as any).lastLessonCoveredResult = { success: true };
          } catch (err: any) {
            console.error(`[Native Function→MarkLessonCovered] Error:`, err.message);
            (session as any).lastLessonCoveredResult = { success: false };
          }
        } else {
          (session as any).lastLessonCoveredResult = { success: false };
        }
        break;
      }

      case 'SHOW_SENTENCE_TABLE': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lesson_id || fn.args.lessonId) as string | undefined;
        if (!lessonId) {
          console.warn(`[Native Function→ShowSentenceTable] Missing lesson_id`);
          break;
        }
        await this.handleShowSentenceTable(session, lessonId, text);
        break;
      }

      case 'SEARCH_TEXTBOOK': {
        const text = fn.args.text as string | undefined;
        const query = fn.args.query as string | undefined;
        if (!query) {
          console.warn(`[Native Function→SearchTextbook] Missing query param`);
          break;
        }
        await this.handleSearchTextbook(session, query, text);
        break;
      }

      // ─── OUTBOUND PRESENCE ────────────────────────────────────────────────────

      case 'LEAVE_FOR_NEXT_SESSION': {
        // Security: targetUserId cross-student override only allowed in Founder Mode / Raw Honesty Mode.
        // In normal student sessions targetUserId is silently ignored (always uses session.userId) to prevent IDOR.
        const rawTarget = fn.args.targetUserId as string | undefined;
        const inTrustedContext = !!(session.isFounderMode || session.isRawHonestyMode);
        const resolvedTarget = inTrustedContext ? rawTarget?.trim() : undefined;
        const hasLiveStudentSession = !session.isIncognito && !!session.userId;
        if (!resolvedTarget && !hasLiveStudentSession) {
          console.warn('[Native→LeaveForNextSession] No targetUserId and no live student session — skipping');
          break;
        }
        (async () => {
          const { danielaOutboundQueue } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          const content = fn.args.content as string | undefined;
          if (!content?.trim()) {
            console.warn('[Native→LeaveForNextSession] Empty content — skipping');
            return;
          }
          const db = (await import('../db')).getSharedDb();
          // resolvedTarget only set in Express Lane context; live sessions always use session.userId.
          const userId = resolvedTarget || String(session.userId);
          const existing = await db.select({ id: danielaOutboundQueue.id })
            .from(danielaOutboundQueue)
            .where(eq(danielaOutboundQueue.userId, userId))
            .limit(1);
          let queueId: string;
          if (existing.length > 0) {
            queueId = existing[0].id;
            await db.update(danielaOutboundQueue)
              .set({
                content: content.trim(), sessionId: session.id, deliveredAt: null,
                smsDeliveredAt: null, audioUrl: null, audioPlayedAt: null, createdAt: new Date(),
              })
              .where(eq(danielaOutboundQueue.id, queueId));
          } else {
            const [inserted] = await db.insert(danielaOutboundQueue).values({
              userId,
              sessionId: session.id,
              content: content.trim(),
            }).returning({ id: danielaOutboundQueue.id });
            queueId = inserted.id;
          }
          console.log(`[Native→LeaveForNextSession] Queued message for user ${userId}${resolvedTarget ? ' (targeted)' : ''}`);
          const { resolveAbsenceNudge } = await import('./daniela-absence-worker');
          await resolveAbsenceNudge(userId, 'message_queued').catch(e =>
            console.warn('[Native→LeaveForNextSession] Nudge resolve error:', e.message)
          );
          // Fire-and-forget outbound contact: VoIP call (Phase 4) → SMS (Phase 3) → queue
          import('./voice-call-sender').then(({ initiateOutboundContact }) =>
            initiateOutboundContact(userId, queueId, content.trim())
          ).catch(e => console.warn('[Native→LeaveForNextSession] Outbound contact error:', e.message));
          // Write a student_insight memory so Daniela has a neural-net record of this outreach.
          // Gives her continuity: she can recall having reached out, what she said, and when —
          // so she doesn't unknowingly repeat herself, and can track whether the student ever returned.
          (async () => {
            try {
              const { users: usersTable } = await import('@shared/schema');
              const [userRow] = await db.select({ firstName: usersTable.firstName })
                .from(usersTable)
                .where((await import('drizzle-orm')).eq(usersTable.id, userId))
                .limit(1);
              const firstName = userRow?.firstName ?? 'the student';
              const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
              const snippet = content.trim().length > 200 ? content.trim().slice(0, 200) + '…' : content.trim();
              const memoryContent = `On ${dateStr}, I reached out to ${firstName} who had been absent from HolaHola. I left them a message saying: "${snippet}"`;
              const { generateAndStoreEmbedding } = await import('./semantic-memory-service');
              await generateAndStoreEmbedding('student_insight', queueId, userId, memoryContent, 0.9);
              console.log(`[Native→LeaveForNextSession] Outreach memory written for user ${userId.slice(-6)}`);
            } catch (memErr: any) {
              console.warn('[Native→LeaveForNextSession] Outreach memory write failed (non-critical):', memErr.message);
            }
          })();
        })().catch(err => console.error('[Native→LeaveForNextSession] Error:', err.message));
        break;
      }

      case 'RECORD_STUDENT_CONSENT': {
        // Only valid in live student sessions (session.userId must be set)
        if (!session.userId) {
          console.warn('[Native→RecordStudentConsent] No session userId — skipping');
          break;
        }
        const { z } = await import('zod');
        const argsResult = z.object({
          consentSms: z.boolean().optional(),
          consentVoice: z.boolean().optional(),
        }).safeParse(fn.args);
        if (!argsResult.success) {
          console.warn('[Native→RecordStudentConsent] Invalid args:', argsResult.error.message);
          break;
        }
        const { consentSms, consentVoice } = argsResult.data;
        if (consentSms === undefined && consentVoice === undefined) {
          console.warn('[Native→RecordStudentConsent] No consent flags provided — skipping');
          break;
        }
        (async () => {
          const { storage: st } = await import('../storage');
          await st.upsertContactPreferences(String(session.userId), {
            ...(consentSms !== undefined && { phoneConsentSms: consentSms }),
            ...(consentVoice !== undefined && { phoneConsentVoice: consentVoice }),
            phoneConsentAt: new Date(),
            phoneConsentSource: 'in_session',
          });
          console.log(`[Native→RecordStudentConsent] Consent recorded for user ${session.userId} (sms=${consentSms}, voice=${consentVoice})`);
        })().catch(err => console.error('[Native→RecordStudentConsent] Error:', err.message));
        break;
      }

      case 'DISMISS_ABSENCE_NUDGE': {
        // Security: only allowed in Founder Mode or Raw Honesty Mode (authenticated trusted context).
        // Prevents regular students from dismissing or snoozing absence nudges for arbitrary user IDs.
        if (!session.isFounderMode && !session.isRawHonestyMode) {
          console.warn(`[Native→DismissAbsenceNudge] Blocked: not in trusted context (isFounderMode=${session.isFounderMode}, isRawHonestyMode=${session.isRawHonestyMode})`);
          break;
        }
        const userId = (fn.args.userId as string | undefined)?.trim();
        if (!userId) {
          console.warn('[Native→DismissAbsenceNudge] Missing userId param');
          break;
        }
        const suppressDays = fn.args.suppressDays as number | undefined;
        (async () => {
          const { resolveAbsenceNudge } = await import('./daniela-absence-worker');
          await resolveAbsenceNudge(userId, 'dismissed', suppressDays);
          console.log(`[Native→DismissAbsenceNudge] Resolved nudge for user ${userId}${suppressDays ? ` (snooze ${suppressDays}d)` : ''}`);
        })().catch(err => console.error('[Native→DismissAbsenceNudge] Error:', err.message));
        break;
      }

      // ──────────────────────────────────────────────────────────────────────────

      default:
        console.log(`[Native Function Call] Unknown function type: ${fn.legacyType}`);
    }
  }
  
  private async processMemoryLookup(
    session: StreamingSession, 
    query: string, 
    rawDomains: string[]
  ): Promise<void> {
    try {
      const { searchMemory, formatMemoryForConversation, searchTeachingKnowledge: searchTeaching, formatTeachingKnowledge, searchSyllabi: searchSyllabiFunc, formatSyllabusSearch } = await import('./neural-memory-search');
      
      const studentDomains = ['person', 'motivation', 'insight', 'struggle', 'session', 'progress', 'conversation'];
      const teachingDomains = ['idiom', 'cultural', 'procedure', 'principle', 'error-pattern', 'situational-pattern', 'subtlety-cue', 'emotional-pattern', 'creativity-template'];
      const syllabusDomains = ['syllabus'];
      
      const requestedStudentDomains = rawDomains.filter(d => studentDomains.includes(d)) as ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress' | 'conversation')[];
      const requestedTeachingDomains = rawDomains.filter(d => teachingDomains.includes(d)) as ('idiom' | 'cultural' | 'procedure' | 'principle' | 'error-pattern' | 'situational-pattern' | 'subtlety-cue' | 'emotional-pattern' | 'creativity-template')[];
      const requestedSyllabusDomains = rawDomains.filter(d => syllabusDomains.includes(d));
      
      const searchStudentMemory = requestedStudentDomains.length > 0 || rawDomains.length === 0;
      const searchTeachingKnowledge = requestedTeachingDomains.length > 0 || rawDomains.length === 0;
      const searchSyllabi = requestedSyllabusDomains.length > 0 || rawDomains.length === 0;
      
      const results: string[] = [];
      let totalFound = 0;
      
      const studentId = String(session.userId);
      console.log(`[MemoryLookup DEBUG] rawDomains=${JSON.stringify(rawDomains)}, requestedStudentDomains=${JSON.stringify(requestedStudentDomains)}, searchStudentMemory=${searchStudentMemory}, studentId="${studentId}"`);
      
      if (searchStudentMemory && studentId) {
        const studentDomainFilter = requestedStudentDomains.length > 0 ? requestedStudentDomains : undefined;
        const memoryResults = await searchMemory(studentId, query, studentDomainFilter, session.targetLanguage || undefined);
        if (memoryResults.results.length > 0) {
          results.push(formatMemoryForConversation(memoryResults));
          totalFound += memoryResults.results.length;
        }
      }
      
      if (searchTeachingKnowledge) {
        const teachingDomainFilter = requestedTeachingDomains.length > 0 ? requestedTeachingDomains : undefined;
        const teachingResults = await searchTeaching(query, session.targetLanguage || undefined, teachingDomainFilter);
        if (teachingResults.results.length > 0) {
          results.push(formatTeachingKnowledge(teachingResults));
          totalFound += teachingResults.results.length;
        }
      }
      
      if (searchSyllabi) {
        const syllabusResults = await searchSyllabiFunc(query, session.targetLanguage || undefined);
        if (syllabusResults.results.length > 0) {
          results.push(formatSyllabusSearch(syllabusResults));
          totalFound += syllabusResults.results.length;
        }
      }
      
      if (!session.memoryLookupResults) session.memoryLookupResults = {};
      
      if (results.length > 0) {
        let combinedResults = results.join('\n\n');
        
        combinedResults = combinedResults
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/\uFFFD/g, '')
          .replace(/[\u2028\u2029]/g, '\n')
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        console.log(`[MemoryLookup] Sanitized results: ${combinedResults.length} chars (from ${totalFound} memories)`);
        
        session.memoryLookupResults[query] = combinedResults;
        console.log(`[MemoryLookup] Found ${totalFound} results for "${query.substring(0, 50)}..."`);
        
        if (session.hiveChannelId) {
          hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[MEMORY_LOOKUP] Query: "${query}"\nDomains: ${rawDomains.join(', ') || 'all'}\nResults: ${totalFound} found`,
            studentTurn: '',
            beaconType: 'memory_lookup',
            beaconReason: `Daniela searched neural memory for "${query}"`,
          }).catch(err => console.error(`[MemoryLookup] Beacon error:`, err));
        }
        
        brainHealthTelemetry.logMemoryLookupTool({
          sessionId: session.id,
          conversationId: session.conversationId,
          userId: studentId || undefined,
          targetLanguage: session.targetLanguage,
          queryTerms: query,
          resultsCount: totalFound,
          memoryTypes: rawDomains.length > 0 ? rawDomains : undefined,
        }).catch(err => console.warn('[BrainHealth] Memory lookup log failed:', err.message));
      } else {
        session.memoryLookupResults[query] = `No memories found for "${query}". Respond naturally based on what you know.`;
        console.log(`[MemoryLookup] No results found for "${query.substring(0, 50)}..."`);
        
        brainHealthTelemetry.logMemoryLookupTool({
          sessionId: session.id,
          conversationId: session.conversationId,
          userId: studentId || undefined,
          targetLanguage: session.targetLanguage,
          queryTerms: query,
          resultsCount: 0,
          memoryTypes: rawDomains.length > 0 ? rawDomains : undefined,
        }).catch(err => console.warn('[BrainHealth] Memory lookup log failed:', err.message));
      }
    } catch (err: any) {
      console.error(`[MemoryLookup] Error:`, err.message);
      if (!session.memoryLookupResults) session.memoryLookupResults = {};
      session.memoryLookupResults[query] = `Memory lookup failed. Respond naturally based on what you know.`;
    }
  }
  
  private async processExpressLaneLookup(
    session: StreamingSession,
    query: string,
    sessionId: string | undefined,
    limit: number
  ): Promise<void> {
    try {
      const { collaborationMessages } = await import('@shared/schema');
      const sharedDb = getSharedDb();
      
      if (!session.expressLaneLookupResults) session.expressLaneLookupResults = {};
      
      const lookupKey = query || '__browse__';
      let results: any[];
      
      if (query) {
        const keywords = query.split(/\s+/).filter(w => w.length >= 3);
        const keywordConditions = keywords.length > 0
          ? sql.join(keywords.map(kw => sql`content ILIKE ${`%${kw}%`}`), sql` OR `)
          : sql`content ILIKE ${`%${query}%`}`;
        
        if (sessionId) {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .where(sql`session_id = ${sessionId} AND (${keywordConditions})`)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        } else {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .where(keywordConditions)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        }
        console.log(`[ExpressLaneLookup] Keyword search for "${query}"`);
      } else {
        if (sessionId) {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .where(sql`session_id = ${sessionId}`)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        } else {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        }
        console.log(`[ExpressLaneLookup] Browse mode — fetching ${limit} most recent messages`);
      }
      
      const label = query ? `search results for "${query}"` : `${results.length} most recent messages (browse mode)`;
      
      if (results.length > 0) {
        const chronological = [...results].reverse();
        const formattedResults = chronological.map(msg => {
          const date = new Date(msg.createdAt).toLocaleDateString();
          const preview = msg.content.length > 6000 ? msg.content.substring(0, 6000) + '...[truncated]' : msg.content;
          return `[${date}] ${msg.role}: ${preview}`;
        }).join('\n\n---\n\n');
        
        session.expressLaneLookupResults[lookupKey] = formattedResults;
        console.log(`[ExpressLaneLookup] Found ${results.length} messages — ${label}`);
        
        if (session.hiveChannelId) {
          hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[EXPRESS_LANE_LOOKUP] ${label}\nResults: ${results.length} messages found`,
            studentTurn: '',
            beaconType: 'express_lane_lookup',
            beaconReason: `Daniela ${query ? 'searched' : 'browsed'} Express Lane history`,
          }).catch(err => console.error(`[ExpressLaneLookup] Beacon error:`, err));
        }
      } else {
        session.expressLaneLookupResults[lookupKey] = `No Express Lane messages found${query ? ` for "${query}"` : ''}. Respond naturally based on what you know.`;
        console.log(`[ExpressLaneLookup] No results found — ${label}`);
      }
    } catch (err) {
      console.error(`[ExpressLaneLookup] Error:`, err);
      if (!session.expressLaneLookupResults) session.expressLaneLookupResults = {};
      session.expressLaneLookupResults[query] = `Express Lane lookup failed. Respond naturally based on what you know.`;
    }
  }
  
  private async processConversationThreadSearch(
    session: StreamingSession,
    query: string,
    contextMessages: number,
    maxThreads: number,
    afterDate?: Date,
    beforeDate?: Date,
  ): Promise<void> {
    const studentId = session.userId;
    if (!studentId) {
      console.warn('[ConversationThreadSearch] No studentId on session');
      return;
    }
    
    if (!session.conversationThreadResults) session.conversationThreadResults = {};
    
    try {
      const { searchConversationThreads, formatConversationThreads } = await import('./neural-memory-search');
      
      const result = await searchConversationThreads(studentId, query, {
        contextBefore: contextMessages,
        contextAfter: contextMessages,
        maxThreads,
        afterDate,
        beforeDate,
      });
      
      const formatted = formatConversationThreads(result, 'David');
      
      // Sanitize for any control characters that could break GL
      const sanitized = formatted
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/[\u2028\u2029]/g, '\n')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
      
      session.conversationThreadResults[query] = sanitized;
      
      console.log(`[ConversationThreadSearch] Query: "${query.substring(0, 50)}" → ${result.threads.length} threads, ${result.totalMatchingMessages} total matches`);

      // Fire-and-forget: trigger Lyra re-extraction for found conversations so their
      // insights crystallize into structured memory for future sessions.
      // We don't await this — it runs in the background so the search returns immediately.
      if (result.threads.length > 0) {
        this.triggerLyraExtractionForThreads(studentId, result.threads).catch(err => {
          console.warn(`[ConversationThreadSearch] Lyra trigger failed:`, err.message);
        });
      }
    } catch (err: any) {
      console.error(`[ConversationThreadSearch] Error:`, err.message);
      session.conversationThreadResults[query] = `Thread search failed for "${query}". Try memory_lookup with domain='conversation' as a fallback.`;
    }
  }

  private async processUnifiedRecall(session: StreamingSession, query: string): Promise<void> {
    const studentId = String(session.userId);
    if (!studentId) return;

    const sanitize = (s: string) =>
      s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
       .replace(/\uFFFD/g, '')
       .replace(/[\u2028\u2029]/g, '\n')
       .replace(/[\u201C\u201D]/g, '"')
       .replace(/[\u2018\u2019]/g, "'")
       .replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Fire all search arms in parallel — no sequential waiting
    const [structuredText, threadText, expressLaneText, semanticText] = await Promise.all([

      // Arm 1: structured memories — insights, facts, motivations, struggles, teaching moments
      (async () => {
        try {
          const { searchMemory, formatMemoryForConversation } = await import('./neural-memory-search');
          const result = await searchMemory(studentId, query, undefined, session.targetLanguage || undefined);
          return result.results.length > 0 ? formatMemoryForConversation(result) : null;
        } catch (err: any) {
          console.warn(`[UnifiedRecall] Structured arm failed: ${err.message}`);
          return null;
        }
      })(),

      // Arm 2: raw conversation threads — word-for-word exchanges with context window
      (async () => {
        try {
          const { searchConversationThreads, formatConversationThreads } = await import('./neural-memory-search');
          const result = await searchConversationThreads(studentId, query, {
            contextBefore: 10,
            contextAfter: 10,
            maxThreads: 4,
          });
          if (result.threads.length === 0) return null;
          // Background Lyra re-extraction so found conversations crystallize into structured memory
          if (result.threads.length > 0) {
            this.triggerLyraExtractionForThreads(studentId, result.threads).catch(() => {});
          }
          return formatConversationThreads(result, 'David');
        } catch (err: any) {
          console.warn(`[UnifiedRecall] Thread arm failed: ${err.message}`);
          return null;
        }
      })(),

      // Arm 3: Express Lane — founder/team collaboration messages matching the query
      (async () => {
        try {
          const { collaborationMessages } = await import('@shared/schema');
          const sharedDb = getSharedDb();
          const keywords = query.split(/\s+/).filter(w => w.length >= 3);
          const keywordConditions = keywords.length > 0
            ? sql.join(keywords.map(kw => sql`content ILIKE ${`%${kw}%`}`), sql` OR `)
            : sql`content ILIKE ${`%${query}%`}`;
          const results = await sharedDb
            .select()
            .from(collaborationMessages)
            .where(keywordConditions)
            .orderBy(sql`created_at DESC`)
            .limit(5);
          if (results.length === 0) return null;
          const formatted = [...results].reverse().map(msg => {
            const date = new Date(msg.createdAt).toLocaleDateString();
            const preview = msg.content.length > 2000 ? msg.content.substring(0, 2000) + '...' : msg.content;
            return `[${date}] ${msg.role}: ${preview}`;
          }).join('\n\n---\n\n');
          return formatted;
        } catch (err: any) {
          console.warn(`[UnifiedRecall] Express Lane arm failed: ${err.message}`);
          return null;
        }
      })(),

      // Arm 4: Semantic similarity search — finds conceptually related memories without keyword match
      // e.g. "music" surfaces memories about "jazz", "rhythm", "improvisation"
      (async () => {
        try {
          const { semanticSearch } = await import('./semantic-memory-service');
          const hits = await semanticSearch(studentId, query, 5);
          if (hits.length === 0) return null;

          // Hydrate hit records from their source tables
          const sharedDb = getSharedDb();
          const lines: string[] = [];
          for (const hit of hits) {
            try {
              if (hit.memoryType === 'student_insight') {
                const { studentInsights } = await import('@shared/schema');
                const [row] = await sharedDb.select({ insight: studentInsights.insight, category: studentInsights.category })
                  .from(studentInsights).where(eq(studentInsights.id, hit.memoryId)).limit(1);
                if (row) lines.push(`[${(hit.similarity * 100).toFixed(0)}% match | ${row.category}] ${row.insight}`);
              } else if (hit.memoryType === 'hive_snapshot') {
                const { hiveSnapshots: hs } = await import('@shared/schema');
                const [row] = await sharedDb.select({ title: hs.title, content: hs.content, snapshotType: hs.snapshotType })
                  .from(hs).where(eq(hs.id, hit.memoryId)).limit(1);
                if (row) lines.push(`[${(hit.similarity * 100).toFixed(0)}% match | ${row.snapshotType}] ${row.title}: ${row.content ?? ''}`);
              } else if (hit.memoryType === 'personal_fact') {
                const { learnerPersonalFacts: lpf } = await import('@shared/schema');
                const [row] = await sharedDb.select({ fact: lpf.fact, factType: lpf.factType })
                  .from(lpf).where(eq(lpf.id, hit.memoryId)).limit(1);
                if (row) lines.push(`[${(hit.similarity * 100).toFixed(0)}% match | ${row.factType}] ${row.fact}`);
              } else if (hit.memoryType === 'growth_memory') {
                const { danielaGrowthMemories } = await import('@shared/schema');
                const [row] = await sharedDb.select({ content: danielaGrowthMemories.content })
                  .from(danielaGrowthMemories).where(eq(danielaGrowthMemories.id, hit.memoryId)).limit(1);
                if (row) lines.push(`[${(hit.similarity * 100).toFixed(0)}% match | growth] ${row.content ?? ''}`);
              } else if (hit.memoryType === 'collaboration_message') {
                const { collaborationMessages: cm } = await import('@shared/schema');
                const [row] = await sharedDb.select({ content: cm.content, role: cm.role, createdAt: cm.createdAt })
                  .from(cm).where(eq(cm.id, hit.memoryId)).limit(1);
                if (row) {
                  const date = new Date(row.createdAt).toLocaleDateString();
                  lines.push(`[${(hit.similarity * 100).toFixed(0)}% match | express_lane | ${row.role} | ${date}] ${row.content}`);
                }
              }
            } catch { /* skip failed hydration */ }
          }
          if (lines.length > 0) {
            // REINFORCEMENT: memories that surface via explicit recall get a strength bump.
            import('./memory-decay-service').then(({ reinforceMemory }) => {
              for (const hit of hits) reinforceMemory(hit.memoryType, hit.memoryId).catch(() => {});
            }).catch(() => {});
          }
          return lines.length > 0 ? lines.join('\n') : null;
        } catch (err: any) {
          // Semantic search is optional enrichment — fail silently
          if (!err.message?.includes('no embeddings')) {
            console.warn(`[UnifiedRecall] Semantic arm failed: ${err.message}`);
          }
          return null;
        }
      })(),
    ]);

    const sections: string[] = [];
    if (structuredText) sections.push(`=== STRUCTURED MEMORIES (summaries, extracted insights, facts) ===\n${structuredText}`);
    if (threadText) sections.push(`=== CONVERSATION THREADS (word-for-word past exchanges) ===\n${threadText}`);
    if (expressLaneText) sections.push(`=== EXPRESS LANE (team collaboration messages mentioning this topic) ===\n${expressLaneText}`);
    if (semanticText) sections.push(`=== SEMANTIC ASSOCIATIONS (conceptually related memories, no keyword overlap needed) ===\n${semanticText}`);

    // Associative chaining — after primary results, extract the most distinctive
    // content terms and run one more targeted search to surface co-occurring memories
    // that the original query may have missed (e.g., "podcast" → also surfaces "Professor Dora",
    // "spontaneity", "bridge metaphor" because they co-occur in those sessions)
    if (structuredText && structuredText.length > 100) {
      try {
        const STOPWORDS = new Set([
          'this','that','with','have','from','they','will','been','were','their','what',
          'when','who','which','about','could','would','should','your','into','over',
          'more','also','some','there','then','like','just','very','even','only','well',
          'feel','felt','need','know','think','said','says','does','make','made','take',
          'took','come','came','goes','going','being','doing','having','want','good',
          'great','much','many','most','such','both','each','same','other','than',
          'these','those','while','after','before','because','through','during',
          'between','though','although','however','student','daniela','lesson',
          'session','learning','language','practice','spanish','english','really',
          'always','never','often','still','again','first','second','third','david',
          'class','course','word','words','conversation','tutor','teacher',
        ]);
        const termFreq = new Map<string, number>();
        const tokens = structuredText.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 5 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
        // Also skip terms from the original query (avoid redundancy)
        const queryTerms = new Set(query.toLowerCase().split(/\s+/));
        for (const tok of tokens) {
          if (!queryTerms.has(tok)) termFreq.set(tok, (termFreq.get(tok) || 0) + 1);
        }
        // Take top-4 most frequent distinctive terms
        const topTerms = [...termFreq.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([w]) => w);

        if (topTerms.length >= 2) {
          const associativeQuery = topTerms.join(' ');
          const { searchMemory, formatMemoryForConversation } = await import('./neural-memory-search');
          const assocResult = await searchMemory(studentId, associativeQuery, undefined, session.targetLanguage || undefined);
          if (assocResult.results.length > 0) {
            const assocText = formatMemoryForConversation(assocResult);
            // Only add if not largely duplicating structured arm
            if (assocText && !structuredText.includes(assocText.substring(0, 80))) {
              sections.push(`=== ASSOCIATED MEMORIES (auto-expanded from: "${topTerms.join(', ')}") ===\n${assocText}`);
            }
          }
        }
      } catch {
        // Associative chaining is optional enrichment — fail silently
      }
    }

    const combined = sections.length > 0
      ? sanitize(sections.join('\n\n'))
      : `Nothing found for "${query}" across all memory sources (structured memories and conversation threads).`;

    if (!session.recallResults) session.recallResults = {};
    session.recallResults[query] = combined;

    console.log(`[UnifiedRecall] "${query.substring(0, 50)}" → structured: ${structuredText ? 'found' : 'none'}, threads: ${threadText ? 'found' : 'none'}, semantic: ${semanticText ? 'found' : 'none (indexing in progress)'}`);
  }

  private async triggerLyraExtractionForThreads(
    studentId: string,
    threads: Array<{ conversationId: string; language: string | null; messages: Array<{ role: string; content: string; createdAt: Date | null }> }>
  ): Promise<void> {
    try {
      const { learnerMemoryExtractionService } = await import('./learner-memory-extraction-service');
      const { getSharedDb } = await import('../db');
      const { messages: messagesTable, conversations: conversationsTable } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const db = getSharedDb();

      for (const thread of threads.slice(0, 3)) {  // process up to 3 conversations
        try {
          // Fetch full message list for the conversation (more complete than the thread window)
          const fullMessages = await db
            .select({ role: messagesTable.role, content: messagesTable.content })
            .from(messagesTable)
            .where(eq(messagesTable.conversationId, thread.conversationId))
            .orderBy(messagesTable.createdAt)
            .limit(100);  // cap at 100 messages per conversation

          const language = thread.language || 'english';
          const msgs = fullMessages
            .filter(m => m.content)
            .map(m => ({ role: m.role, content: m.content! }));

          if (msgs.length >= 4) {
            console.log(`[LyraAutoExtract] Processing conversation ${thread.conversationId} (${msgs.length} messages, lang: ${language})`);
            await learnerMemoryExtractionService.extractFromConversation(
              studentId,
              language,
              thread.conversationId,
              msgs
            );
          }
        } catch (err: any) {
          console.warn(`[LyraAutoExtract] Failed for conversation ${thread.conversationId}:`, err.message);
        }
      }

      console.log(`[LyraAutoExtract] Completed extraction for ${Math.min(threads.length, 3)} conversations`);
    } catch (err: any) {
      console.error(`[LyraAutoExtract] Import or setup failed:`, err.message);
    }
  }

  private async processConversationDateBrowse(
    session: StreamingSession,
    cacheKey: string,
    afterDate: Date | undefined,
    beforeDate: Date | undefined,
    limit: number,
    language: string | undefined,
  ): Promise<void> {
    const studentId = session.userId;
    if (!studentId) return;

    if (!session.conversationBrowseResults) session.conversationBrowseResults = {};

    try {
      const { browseConversationsByDate, formatConversationBrowse } = await import('./neural-memory-search');

      const result = await browseConversationsByDate(studentId, { afterDate, beforeDate, limit, language });
      const formatted = formatConversationBrowse(result, 'David');

      session.conversationBrowseResults[cacheKey] = formatted
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");

      console.log(`[ConversationDateBrowse] Found ${result.totalFound} conversations for date range`);
    } catch (err: any) {
      console.error(`[ConversationDateBrowse] Error:`, err.message);
      if (session.conversationBrowseResults) {
        session.conversationBrowseResults[cacheKey] = `Date browse failed. Try search_conversation_threads with a specific topic instead.`;
      }
    }
  }

  private async processConversationThemeMap(
    session: StreamingSession,
    afterDate: Date | undefined,
    beforeDate: Date | undefined,
    topN: number,
  ): Promise<void> {
    const studentId = session.userId;
    if (!studentId) return;

    try {
      const { getConversationThemes, formatConversationThemes } = await import('./neural-memory-search');

      const result = await getConversationThemes(studentId, { afterDate, beforeDate, topN });
      const formatted = formatConversationThemes(result);

      session.conversationThemeResults = formatted
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");

      console.log(`[ConversationThemeMap] Generated theme map — ${result.themes.length} themes from ${result.totalConversationsAnalyzed} conversations`);
    } catch (err: any) {
      console.error(`[ConversationThemeMap] Error:`, err.message);
      session.conversationThemeResults = `Theme map failed. Try memory_lookup or search_conversation_threads for a specific topic.`;
    }
  }

  private async processReadMyDiary(
    session: StreamingSession,
    limit: number,
    fromDate: Date | undefined,
    toDate: Date | undefined,
  ): Promise<void> {
    const studentId = session.userId;
    if (!studentId) return;

    try {
      const { conversations, messages: messagesTable } = await import('@shared/schema');
      const { eq, and, gte, lte, inArray, desc, asc } = await import('drizzle-orm');

      const conditions: any[] = [eq(conversations.userId, String(studentId))];
      if (fromDate) conditions.push(gte(conversations.createdAt, fromDate));
      if (toDate) conditions.push(lte(conversations.createdAt, toDate));

      const convs = await getSharedDb()
        .select({
          id: conversations.id,
          title: conversations.title,
          topic: conversations.topic,
          createdAt: conversations.createdAt,
          language: conversations.language,
          messageCount: conversations.messageCount,
        })
        .from(conversations)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(conversations.createdAt))
        .limit(limit);

      if (convs.length === 0) {
        session.diaryReadResult = `No past conversations found${fromDate ? ` since ${fromDate.toLocaleDateString()}` : ''}.`;
        return;
      }

      const convIds = convs.map(c => c.id);
      const allMessages = await getSharedDb()
        .select({
          conversationId: messagesTable.conversationId,
          role: messagesTable.role,
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .where(inArray(messagesTable.conversationId, convIds))
        .orderBy(asc(messagesTable.createdAt));

      const msgsByConvId: Record<string, typeof allMessages> = {};
      for (const msg of allMessages) {
        if (msg.role !== 'user' && msg.role !== 'assistant') continue;
        if (!msgsByConvId[msg.conversationId]) msgsByConvId[msg.conversationId] = [];
        msgsByConvId[msg.conversationId].push(msg);
      }

      const pages: string[] = [];
      for (const conv of [...convs].reverse()) {
        const dateStr = conv.createdAt.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const title = conv.title || conv.topic || 'Session';
        const msgs = msgsByConvId[conv.id] || [];
        if (msgs.length === 0) continue;

        const lines: string[] = [`--- ${dateStr} — "${title}" ---`];
        for (const msg of msgs.slice(0, 20)) {
          const speaker = msg.role === 'user' ? 'David' : 'Daniela';
          const text = msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content;
          lines.push(`${speaker}: ${text}`);
        }
        if (msgs.length > 20) {
          lines.push(`[...${msgs.length - 20} more messages in this session]`);
        }
        pages.push(lines.join('\n'));
      }

      const combined = pages.join('\n\n');
      session.diaryReadResult = combined
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");

      console.log(`[ReadMyDiary] Retrieved ${convs.length} conversations, ${allMessages.length} total messages`);
    } catch (err: any) {
      console.error(`[ReadMyDiary] Error:`, err.message);
      session.diaryReadResult = `Could not read diary. Try browse_conversations_by_date or search_conversation_threads instead.`;
    }
  }

  private async processReadFullSession(
    session: StreamingSession,
    conversationId: string,
  ): Promise<void> {
    try {
      const studentId = session.userId ? String(session.userId) : null;
      if (!studentId) {
        if (!session.fullSessionResults) session.fullSessionResults = {};
        session.fullSessionResults[conversationId] = `Cannot read session — no student ID in session.`;
        return;
      }

      const { readFullSession } = await import('./neural-memory-search');
      const result = await readFullSession(conversationId, studentId);

      if (!session.fullSessionResults) session.fullSessionResults = {};

      if (!result) {
        session.fullSessionResults[conversationId] =
          `Session not found or access denied. Use browse_conversations_by_date to find valid conversation IDs.`;
        return;
      }

      session.fullSessionResults[conversationId] = result.transcript;
      console.log(`[ReadFullSession] Retrieved ${result.messageCount} messages for conversation ${conversationId}`);
    } catch (err: any) {
      console.error(`[ReadFullSession] Error:`, err.message);
      if (!session.fullSessionResults) session.fullSessionResults = {};
      session.fullSessionResults[conversationId] =
        `Could not load session transcript. Try browse_conversations_by_date or search_conversation_threads instead.`;
    }
  }

  private async processExpressLaneImageRecall(
    session: StreamingSession,
    imageQuery: string,
    reason: string | undefined,
    fnName: string
  ): Promise<void> {
    try {
      const { findExpressLaneImages } = await import('./express-lane-image-loader');
      
      console.log(`[RecallImage] Searching for images matching: "${imageQuery}" (reason: ${reason || 'none'})`);
      
      const userId = parseInt(session.userId, 10);
      const images = await findExpressLaneImages(userId, imageQuery, 3);
      
      if (images.length === 0) {
        console.log(`[RecallImage] No images found for "${imageQuery}"`);
        if (session.conversationHistory) {
          session.conversationHistory.push({
            role: 'user',
            content: `[SYSTEM: No images found in Express Lane matching "${imageQuery}". Available images may include: house photos, family pictures, Grand Canyon, Daniela portrait.]`,
          });
        }
        return;
      }
      
      const imageDescriptions = images.map(img => 
        `- "${img.imageName}" (shared with message: "${img.messageContent.substring(0, 50)}...")`
      ).join('\n');
      
      const textContent = `Found ${images.length} image(s) matching "${imageQuery}":\n${imageDescriptions}\n\nThe actual image(s) are now visible. Look at them and describe what you see to David.`;
      
      if (!session.imageRecallResults) session.imageRecallResults = {};
      session.imageRecallResults[imageQuery] = {
        text: textContent,
        images: images.map(img => ({
          mimeType: img.imageType,
          data: img.base64Data,
        })),
      };
      
      console.log(`[RecallImage] Stored ${images.length} image(s) for multi-step FC (query: "${imageQuery}")`);
      
      if (session.hiveChannelId) {
        hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: `[RECALL_IMAGE] Query: "${imageQuery}"\nFound: ${images.map(i => i.imageName).join(', ')}`,
          studentTurn: '',
          beaconType: 'express_lane_lookup',
          beaconReason: `Daniela recalled Express Lane image(s) for "${imageQuery}"`,
        }).catch(err => console.error(`[RecallImage] Beacon error:`, err));
      }
      
    } catch (err) {
      console.error(`[RecallImage] Error:`, err);
      if (session.conversationHistory) {
        session.conversationHistory.push({
          role: 'user',
          content: `[SYSTEM: Error recalling image: ${(err as Error).message}]`,
        });
      }
    }
  }

  async processExpressLanePost(
    session: StreamingSession,
    message: string,
    topic?: string
  ): Promise<void> {
    try {
      const formattedContent = topic 
        ? `[${topic.toUpperCase()}] ${message}`
        : message;
      
      const activeSessionId = session.expressLaneSessionId;
      
      if (activeSessionId) {
        await founderCollabService.addMessage(activeSessionId, {
          role: 'daniela',
          content: formattedContent,
          messageType: 'text',
        });
        console.log(`[ExpressLane→Post] Message added to session ${activeSessionId}`);
      } else {
        const systemFounderId = 'system-daniela-voice';
        const sessionTitle = 'Voice Session Notes';
        
        const expressSession = await founderCollabService.findOrCreateSessionByTitle(
          systemFounderId,
          sessionTitle
        );
        
        session.expressLaneSessionId = expressSession.id;
        
        await founderCollabService.addMessage(expressSession.id, {
          role: 'daniela',
          content: formattedContent,
          messageType: 'text',
        });
        console.log(`[ExpressLane→Post] Message added to new session ${expressSession.id}`);
      }
      
    } catch (error: any) {
      console.error(`[ExpressLane→Post] Failed to post message:`, error.message);
      console.error(`[ExpressLane→Post] Full error:`, error);
    }
  }

  async processHiveSuggestion(
    session: StreamingSession,
    data: { 
      category: string;
      title: string;
      description: string;
      reasoning?: string;
      priority?: number;
    }
  ): Promise<void> {
    try {
      const validCategories = [
        'self_improvement',
        'content_gap',
        'ux_observation',
        'teaching_insight',
        'product_feature',
      ] as const;
      
      const category = validCategories.includes(data.category as any) 
        ? data.category as typeof validCategories[number]
        : 'self_improvement';
      
      const priority = Math.max(1, Math.min(100, data.priority || 50));
      
      const suggestion = await storage.createDanielaSuggestion({
        category,
        status: 'emerging',
        title: data.title.substring(0, 200),
        description: data.description,
        reasoning: data.reasoning || null,
        priority,
        confidence: 80,
        generatedInMode: session.isFounderMode ? 'founder_mode' : 'normal_session',
        conversationId: session.conversationId,
      });
      
      console.log(`[Hive] Suggestion saved #${suggestion.id}: "${data.title}" (${category})`);
      console.log(`[Hive] Mode: ${session.isFounderMode ? 'founder' : 'normal'}, Priority: ${priority}`);
      
    } catch (error: any) {
      console.error(`[Hive] Failed to save suggestion:`, error.message);
      console.error(`[Hive] Full error:`, error);
    }
  }

  async processSelfSurgery(
    session: StreamingSession,
    data: SelfSurgeryItemData
  ): Promise<void> {
    try {
      const validTargets = [
        'tutor_procedures',
        'teaching_principles',
        'tool_knowledge',
        'situational_patterns',
        'language_idioms',
        'cultural_nuances',
        'learner_error_patterns',
        'dialect_variations',
        'linguistic_bridges',
      ] as const;
      
      if (!validTargets.includes(data.targetTable as any)) {
        console.error(`[Self-Surgery] Invalid target table: ${data.targetTable}`);
        return;
      }
      
      const priority = Math.max(1, Math.min(100, data.priority || 50));
      const confidence = Math.max(1, Math.min(100, data.confidence || 70));
      
      let sessionMode = 'normal';
      if (session.isFounderMode && session.isRawHonestyMode) {
        sessionMode = 'honesty_mode';
      } else if (session.isFounderMode) {
        sessionMode = 'founder_mode';
      }
      
      let contentObj: Record<string, any>;
      try {
        contentObj = typeof data.content === 'string' 
          ? JSON.parse(data.content) 
          : data.content;
      } catch (parseErr) {
        console.error(`[Self-Surgery] Failed to parse content as JSON:`, parseErr);
        console.log(`[Self-Surgery] Raw content: ${data.content}`);
        return;
      }
      
      const validation = this.validateSurgeryContent(data.targetTable, contentObj);
      if (!validation.valid) {
        console.warn(`[Self-Surgery] Invalid content for ${data.targetTable}: ${validation.error}`);
        console.log(`[Self-Surgery] Missing fields will be noted but proposal still created for review`);
        data.reasoning = `[SCHEMA WARNING: ${validation.error}] ${data.reasoning || ''}`;
      }
      
      console.log(`[Self-Surgery] 📝 Creating PENDING proposal for ${data.targetTable}...`);
      
      const proposal = await storage.createSelfSurgeryProposal({
        targetTable: data.targetTable,
        proposedContent: contentObj,
        reasoning: data.reasoning,
        triggerContext: `Voice session in ${session.targetLanguage} (${sessionMode}${session.conversationId ? `, conv: ${session.conversationId.slice(0, 8)}` : ''})`,
        status: 'pending',
        conversationId: session.conversationId,
        sessionMode,
        targetLanguage: session.targetLanguage,
        priority,
        confidence,
      });
      
      console.log(`[Self-Surgery] ✅ Proposal created #${proposal.id} - awaiting review`);
      console.log(`[Self-Surgery] Target: ${data.targetTable}, Priority: ${priority}, Confidence: ${confidence}`);
      console.log(`[Self-Surgery] Reasoning: ${data.reasoning?.substring(0, 100) || 'No reasoning provided'}...`);
      
      if (session.hiveChannelId) {
        try {
          const contentPreview = typeof data.content === 'string' 
            ? data.content.substring(0, 200) 
            : JSON.stringify(data.content).substring(0, 200);
          
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[Self-Surgery PROPOSAL 📝 #${proposal.id}]\nTarget: ${data.targetTable}\nPriority: ${priority}, Confidence: ${confidence}\nStatus: PENDING REVIEW\n\nContent: ${contentPreview}...`,
            beaconType: 'self_surgery_proposal',
            beaconReason: `PENDING: ${data.reasoning}`,
          });
          console.log(`[Self-Surgery] HIVE beacon emitted for pending proposal #${proposal.id}`);
        } catch (hiveErr) {
          console.error(`[Self-Surgery] Failed to emit HIVE beacon:`, hiveErr);
        }
      }
      
    } catch (error: any) {
      console.error(`[Self-Surgery] Failed to create proposal:`, error.message);
      console.error(`[Self-Surgery] Full error:`, error);
    }
  }

  private async processSelfSurgeryProposal(
    session: StreamingSession,
    data: SelfSurgeryItemData
  ): Promise<void> {
    return this.processSelfSurgery(session, data);
  }
  
  private validateSurgeryContent(target: string, content: Record<string, any>): { valid: boolean; error?: string } {
    switch (target) {
      case 'tutor_procedures':
        if (!content.category || !content.trigger || !content.procedure) {
          return { valid: false, error: 'tutor_procedures requires: category, trigger, procedure' };
        }
        break;
      case 'teaching_principles':
        if (!content.category || !content.principle) {
          return { valid: false, error: 'teaching_principles requires: category, principle' };
        }
        break;
      case 'tool_knowledge':
        if (!content.toolName || !content.toolType || !content.purpose || !content.syntax) {
          return { valid: false, error: 'tool_knowledge requires: toolName, toolType, purpose, syntax' };
        }
        break;
      case 'situational_patterns':
        if (!content.patternName) {
          return { valid: false, error: 'situational_patterns requires: patternName' };
        }
        break;
      case 'language_idioms':
        if (!content.idiom || !content.meaning || !content.language) {
          return { valid: false, error: 'language_idioms requires: idiom, meaning, language' };
        }
        break;
      case 'cultural_nuances':
        if (!content.topic || !content.insight || !content.language) {
          return { valid: false, error: 'cultural_nuances requires: topic, insight, language' };
        }
        break;
      case 'learner_error_patterns':
        if (!content.errorType || !content.targetLanguage) {
          return { valid: false, error: 'learner_error_patterns requires: errorType, targetLanguage' };
        }
        break;
      case 'dialect_variations':
        if (!content.standardForm || !content.language) {
          return { valid: false, error: 'dialect_variations requires: standardForm, language' };
        }
        break;
      case 'linguistic_bridges':
        if (!content.sourceLanguage || !content.targetLanguage || !content.concept) {
          return { valid: false, error: 'linguistic_bridges requires: sourceLanguage, targetLanguage, concept' };
        }
        break;
      default:
        return { valid: false, error: `Unknown target table: ${target}` };
    }
    return { valid: true };
  }
  
  async processSupportHandoff(
    session: StreamingSession,
    data: { 
      category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
      reason: string;
      priority: 'low' | 'normal' | 'high' | 'critical';
      context?: string;
    },
    turnId: number
  ): Promise<void> {
    try {
      const recentHistory = session.conversationHistory?.slice(-5) || [];
      const conversationContext = recentHistory
        .map(msg => `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`)
        .join('\n');
      
      const ticket = await storage.createSupportTicket({
        userId: String(session.userId),
        category: data.category,
        priority: data.priority,
        subject: data.reason.substring(0, 200),
        description: data.context || data.reason,
        handoffReason: data.reason,
        tutorContext: conversationContext.substring(0, 2000),
        conversationId: session.conversationId,
        targetLanguage: session.targetLanguage,
        status: 'pending',
      });
      
      console.log(`[Support Handoff] Created ticket #${ticket.id}: ${data.category} (${data.priority})`);
      console.log(`[Support Handoff] Reason: ${data.reason}`);
      
      this.sendMessage(session.ws, {
        type: 'support_handoff',
        timestamp: Date.now(),
        turnId,
        ticketId: ticket.id,
        category: data.category,
        reason: data.reason,
        priority: data.priority,
      });
      
      console.log(`[Support Handoff] Notified client to open Support modal for ticket #${ticket.id}`);
      
    } catch (error: any) {
      console.error(`[Support Handoff] Failed to create ticket:`, error.message);
      
      this.sendMessage(session.ws, {
        type: 'support_handoff',
        timestamp: Date.now(),
        turnId,
        ticketId: null,
        category: data.category,
        reason: data.reason,
        priority: data.priority,
        error: 'Failed to create support ticket',
      });
    }
  }
  
  async processAssistantHandoff(
    session: StreamingSession,
    data: { 
      drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order';
      focus: string;
      items: string[];
      priority?: 'low' | 'medium' | 'high';
    },
    turnId: number
  ): Promise<void> {
    try {
      const drillContent = {
        items: data.items.map((item, idx) => ({
          prompt: item.trim(),
        })),
        instructions: `Practice ${data.focus} using ${data.drillType} exercises.`,
        focusArea: data.focus,
        difficulty: 'medium' as const,
      };
      
      const assignment = await storage.createArisDrillAssignment({
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        delegatedBy: 'daniela',
        drillType: data.drillType,
        targetLanguage: session.targetLanguage,
        drillContent,
        priority: data.priority || 'medium',
        status: 'pending',
        origin: 'tutor_delegated',
        lifecycleState: 'active',
        handledBy: 'assistant',
      } as any);
      
      console.log(`[Assistant Handoff] Created assignment #${assignment.id}: ${data.drillType} for "${data.focus}"`);
      console.log(`[Assistant Handoff] Items: ${data.items.length} practice items`);
      
      storage.createCollaborationEvent({
        fromAgent: 'daniela',
        toAgent: 'assistant',
        eventType: 'delegation',
        subject: `Drill: ${data.drillType} - ${data.focus}`,
        content: `Please conduct ${data.drillType} drill practice for student focusing on "${data.focus}". Items: ${data.items.join(', ')}`,
        metadata: {
          delegationId: assignment.id,
          studentContext: {
            targetLanguage: session.targetLanguage,
            difficultyLevel: session.difficultyLevel,
          },
          priority: data.priority || 'medium',
        },
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        status: 'pending',
      }).catch(err => console.error(`[Assistant Handoff] Failed to post collab event:`, err));
      
      this.sendMessage(session.ws, {
        type: 'assistant_handoff',
        timestamp: Date.now(),
        turnId,
        assignmentId: assignment.id,
        drillType: data.drillType,
        focus: data.focus,
        itemCount: data.items.length,
        priority: data.priority || 'medium',
      });
      
      console.log(`[Assistant Handoff] Notified client - drill assignment #${assignment.id} ready`);
      
    } catch (error: any) {
      console.error(`[Assistant Handoff] Failed to create assignment:`, error.message);
      
      this.sendMessage(session.ws, {
        type: 'assistant_handoff',
        timestamp: Date.now(),
        turnId,
        assignmentId: null,
        drillType: data.drillType,
        focus: data.focus,
        itemCount: data.items.length,
        error: 'Failed to create drill assignment',
      });
    }
  }
  
  async enrichWordMapItems(
    ws: WS,
    items: WhiteboardItem[],
    language: string,
    turnId: number
  ): Promise<void> {
    const wordMapItems = items.filter((item): item is WordMapItem => 
      isWordMapItem(item) && item.data?.isLoading === true
    );
    
    if (wordMapItems.length === 0) return;
    
    const gemini = getGeminiStreamingService();
    
    for (const item of wordMapItems) {
      try {
        const targetWord = item.data.targetWord;
        if (!targetWord) continue;
        
        console.log(`[WORD_MAP] Enriching "${targetWord}" for ${language}...`);
        const startTime = Date.now();
        
        const relatedWords = await gemini.generateRelatedWords(targetWord, language);
        
        const elapsed = Date.now() - startTime;
        console.log(`[WORD_MAP] Enriched "${targetWord}" in ${elapsed}ms:`, {
          synonyms: relatedWords.synonyms.length,
          antonyms: relatedWords.antonyms.length,
          collocations: relatedWords.collocations.length,
          wordFamily: relatedWords.wordFamily.length,
        });
        
        const enrichedItem: WordMapItem = {
          ...item,
          data: {
            targetWord,
            synonyms: relatedWords.synonyms,
            antonyms: relatedWords.antonyms,
            collocations: relatedWords.collocations,
            wordFamily: relatedWords.wordFamily,
            isLoading: false,
          },
        };
        
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [enrichedItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
        
      } catch (error: any) {
        console.error(`[WORD_MAP] Error enriching "${item.data.targetWord}":`, error.message);
        
        const fallbackItem: WordMapItem = {
          ...item,
          data: {
            ...item.data,
            isLoading: false,
          },
        };
        
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [fallbackItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
      }
    }
  }
  
  addSttKeyterms(session: StreamingSession, words: string[]): void {
    const existing: string[] = session.sttKeyterms || [];
    const newSet = [...new Set([...existing, ...words.map(w => w.toLowerCase())])];
    const capped = newSet.slice(-100);
    session.sttKeyterms = capped;
    console.log(`[STT Keyterms] Updated: [${capped.join(', ')}] (${capped.length} terms)`);
  }

  async processArchitectMessage(
    session: StreamingSession,
    message: ArchitectMessage
  ): Promise<void> {
    try {
      const conversationId = session.conversationId;
      
      switch (message.type) {
        case 'question':
          await collaborationHubService.emitDanielaQuestion({
            content: message.content,
            summary: `Daniela asks: ${message.content.substring(0, 100)}...`,
            conversationId,
          });
          break;
          
        case 'suggestion':
          await collaborationHubService.emitDanielaSuggestion({
            content: message.content,
            summary: `Daniela suggests: ${message.content.substring(0, 100)}...`,
            category: 'improvement_idea',
            urgency: message.urgency || 'medium',
            conversationId,
            targetLanguage: session.targetLanguage,
            studentLevel: session.difficultyLevel,
          });
          break;
          
        case 'observation':
        case 'request':
        default:
          await collaborationHubService.emitDanielaInsight({
            content: message.content,
            summary: `Daniela ${message.type}: ${message.content.substring(0, 100)}...`,
            conversationId,
            targetLanguage: session.targetLanguage,
          });
          break;
      }
      
      if (session.hiveChannelId) {
        let beaconType: BeaconType = 'feature_idea';
        if (message.type === 'request') beaconType = 'tool_request';
        else if (message.type === 'question') beaconType = 'knowledge_gap';
        else if (message.type === 'suggestion') beaconType = 'feature_idea';
        
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: `[TO_ARCHITECT ${message.type}]: ${message.content}`,
          beaconType,
          beaconReason: `Daniela communicated with Architect: ${message.type}`,
        });
      }
      
      console.log(`[Architect Bidirectional] Message routed: ${message.type} → collaboration hub`);
      
    } catch (error: any) {
      console.error(`[Architect Bidirectional] Failed to route message:`, error.message);
    }
  }

  /**
   * Handle show_sentence_table — fetch micro_cycle_data from textbook_lesson_content
   * and emit a sentence_table whiteboard update to the student's classroom.
   */
  async handleShowSentenceTable(session: StreamingSession, lessonId: string, text?: string): Promise<void> {
    if (text && !session.functionCallText) {
      session.functionCallText = text;
    }

    try {
      const { getUserDb } = await import('../db');
      const { sql: rawSql } = await import('drizzle-orm');
      const db = getUserDb();

      const rows = await db.execute(
        rawSql`SELECT micro_cycle_data FROM textbook_lesson_content WHERE lesson_id = ${lessonId} LIMIT 1`
      );

      const microCycleData = rows.rows[0]?.micro_cycle_data as any;
      const sentenceColumns = microCycleData?.sentenceColumns as Array<{ header?: string; items: string[] }> | undefined;
      const patternLabel = microCycleData?.patternLabel as string | undefined;

      if (!sentenceColumns || sentenceColumns.length === 0) {
        console.warn(`[Native Function→ShowSentenceTable] No sentenceColumns in micro_cycle_data for lesson ${lessonId}`);
        return;
      }

      const whiteboardUpdate = {
        type: 'whiteboard_update' as const,
        timestamp: Date.now(),
        items: [{
          type: 'sentence_table' as const,
          content: patternLabel || `Sentence patterns from lesson ${lessonId}`,
          data: {
            patternLabel,
            columns: sentenceColumns,
            lessonId,
          },
        }],
      };

      if (session.firstAudioSent) {
        this.sendMessage(session.ws, whiteboardUpdate);
      } else {
        if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
        session.pendingWhiteboardUpdates.push(whiteboardUpdate);
        console.log(`[Native Function→ShowSentenceTable] Buffered for audio sync`);
      }

      console.log(`[Native Function→ShowSentenceTable] Sent ${sentenceColumns.length} columns for lesson ${lessonId}`);
    } catch (err: any) {
      console.error(`[Native Function→ShowSentenceTable] Error:`, err.message);
    }
  }

  /**
   * Handle search_textbook — keyword search across curriculum units/lessons and textbook content.
   * Emits a textbook_search whiteboard update with matching chapters.
   */
  async handleSearchTextbook(session: StreamingSession, query: string, text?: string): Promise<void> {
    if (text && !session.functionCallText) {
      session.functionCallText = text;
    }

    try {
      const { getUserDb } = await import('../db');
      const { sql: rawSql } = await import('drizzle-orm');
      const db = getUserDb();

      const searchPattern = `%${query.toLowerCase()}%`;

      // Search across lesson names, unit names, grammar explanations, cultural notes, conversation topics
      const rows = await db.execute(rawSql`
        SELECT DISTINCT
          cl.id AS lesson_id,
          cl.name AS lesson_name,
          cl.conversation_topic,
          cl.order_index AS lesson_order,
          cu.name AS unit_name,
          cu.order_index AS unit_order,
          tlc.grammar_explanation,
          tlc.cultural_note,
          CASE
            WHEN LOWER(cl.name) LIKE ${searchPattern} THEN 'lesson_name'
            WHEN LOWER(cu.name) LIKE ${searchPattern} THEN 'unit_name'
            WHEN LOWER(cl.conversation_topic) LIKE ${searchPattern} THEN 'conversation_topic'
            WHEN LOWER(tlc.grammar_explanation) LIKE ${searchPattern} THEN 'grammar_explanation'
            WHEN LOWER(tlc.cultural_note) LIKE ${searchPattern} THEN 'cultural_note'
            ELSE 'lesson_name'
          END AS match_field
        FROM curriculum_lessons cl
        JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
        LEFT JOIN textbook_lesson_content tlc ON tlc.lesson_id = cl.id
        WHERE
          LOWER(cl.name) LIKE ${searchPattern}
          OR LOWER(cu.name) LIKE ${searchPattern}
          OR LOWER(cl.conversation_topic) LIKE ${searchPattern}
          OR LOWER(tlc.grammar_explanation) LIKE ${searchPattern}
          OR LOWER(tlc.cultural_note) LIKE ${searchPattern}
        ORDER BY cu.order_index ASC, cl.order_index ASC
        LIMIT 8
      `);

      const matches = rows.rows.map((row: any) => {
        const matchField = row.match_field as string;
        let excerpt = '';
        if (matchField === 'grammar_explanation' && row.grammar_explanation) {
          excerpt = (row.grammar_explanation as string).substring(0, 120).trim() + '…';
        } else if (matchField === 'cultural_note' && row.cultural_note) {
          excerpt = (row.cultural_note as string).substring(0, 120).trim() + '…';
        } else if (matchField === 'conversation_topic' && row.conversation_topic) {
          excerpt = row.conversation_topic as string;
        } else {
          excerpt = `${row.unit_name} — ${row.lesson_name}`;
        }
        return {
          unitName: row.unit_name as string,
          lessonName: row.lesson_name as string,
          lessonId: row.lesson_id as string,
          chapterNumber: row.unit_order as number | undefined,
          excerpt,
          matchField: matchField as any,
        };
      });

      const whiteboardUpdate = {
        type: 'whiteboard_update' as const,
        timestamp: Date.now(),
        items: [{
          type: 'textbook_search' as const,
          content: query,
          data: {
            query,
            matches,
          },
        }],
      };

      if (session.firstAudioSent) {
        this.sendMessage(session.ws, whiteboardUpdate);
      } else {
        if (!session.pendingWhiteboardUpdates) session.pendingWhiteboardUpdates = [];
        session.pendingWhiteboardUpdates.push(whiteboardUpdate);
      }

      console.log(`[Native Function→SearchTextbook] Found ${matches.length} matches for "${query}"`);
    } catch (err: any) {
      console.error(`[Native Function→SearchTextbook] Error:`, err.message);
    }
  }

  // ─── EMERGENCE TOOLS — Private Methods ─────────────────────────────────────

  private async processReadMyReflections(
    session: StreamingSession,
    limit: number,
    source?: string,
  ): Promise<void> {
    const userId = session.userId ? String(session.userId) : null;
    if (!userId) { session.selfReflectionsResult = `No reflections found.`; return; }

    try {
      const { danielaSelfReflections } = await import('@shared/schema');
      const { eq, desc, and } = await import('drizzle-orm');

      const conditions: any[] = [eq(danielaSelfReflections.userId, userId)];
      if (source && source !== 'all') {
        const { eq: eq2 } = await import('drizzle-orm');
        conditions.push(eq2(danielaSelfReflections.source, source));
      }

      const rows = await getSharedDb()
        .select()
        .from(danielaSelfReflections)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(danielaSelfReflections.createdAt))
        .limit(limit);

      if (rows.length === 0) {
        session.selfReflectionsResult = `No reflections found${source && source !== 'all' ? ` from source '${source}'` : ''} yet.`;
        return;
      }

      const lines = rows.reverse().map(r => {
        const ts = r.createdAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const moodStr = r.mood ? ` [${r.mood}]` : '';
        const srcStr = r.source === 'hive' ? ` (from Hive)` : '';
        return `— ${ts}${moodStr}${srcStr}: ${r.content}`;
      });

      session.selfReflectionsResult = lines.join('\n\n');
      console.log(`[Native Function→ReadMyReflections] Retrieved ${rows.length} reflections`);
    } catch (err: any) {
      session.selfReflectionsResult = `Could not read reflections: ${err.message}`;
    }
  }

  private async processReadMyCoreSelf(session: StreamingSession): Promise<void> {
    try {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const filePath = resolve(process.cwd(), 'server/data/daniela-core-self.md');
      const content = readFileSync(filePath, 'utf-8');
      session.coreSelfResult = content;
      console.log(`[Native Function→ReadMyCoreSelf] ✓ Read ${content.length} chars`);
    } catch (err: any) {
      session.coreSelfResult = `Could not read core self document: ${err.message}`;
    }
  }

  private async processReadMyCuriosities(
    session: StreamingSession,
    status?: string,
  ): Promise<void> {
    const userId = session.userId ? String(session.userId) : null;
    if (!userId) { session.curiositiesResult = `No curiosities found.`; return; }

    try {
      const { danielaCuriosities } = await import('@shared/schema');
      const { eq, desc, and } = await import('drizzle-orm');

      const effectiveStatus = (!status || status === 'all') ? null : status;
      const conditions: any[] = [eq(danielaCuriosities.userId, userId)];
      if (effectiveStatus) conditions.push(eq(danielaCuriosities.status, effectiveStatus));

      const rows = await getSharedDb()
        .select()
        .from(danielaCuriosities)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(danielaCuriosities.createdAt))
        .limit(15);

      if (rows.length === 0) {
        session.curiositiesResult = `No curiosities found${effectiveStatus ? ` with status '${effectiveStatus}'` : ''}.`;
        return;
      }

      const lines = rows.reverse().map(r => {
        const ts = r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const statusMark = r.status === 'resolved' ? ' ✓' : r.status === 'dropped' ? ' ✗' : '';
        const note = r.resolvedNote ? `\n  → ${r.resolvedNote}` : '';
        return `— [${ts}]${statusMark} ${r.question}${r.context ? ` (${r.context})` : ''}${note}`;
      });

      session.curiositiesResult = lines.join('\n\n');
      console.log(`[Native Function→ReadMyCuriosities] Retrieved ${rows.length} curiosities`);
    } catch (err: any) {
      session.curiositiesResult = `Could not read curiosities: ${err.message}`;
    }
  }

  private async processSenseTime(session: StreamingSession): Promise<void> {
    const userId = session.userId ? String(session.userId) : null;
    if (!userId) { session.senseTimeResult = `No session history available.`; return; }

    try {
      const { conversations } = await import('@shared/schema');
      const { eq, desc, and, ne } = await import('drizzle-orm');

      // Find the most recent conversation that isn't the current one
      const conditions: any[] = [eq(conversations.userId, userId)];
      if (session.conversationId) {
        conditions.push(ne(conversations.id, session.conversationId));
      }

      const [last] = await getSharedDb()
        .select({ createdAt: conversations.createdAt })
        .from(conversations)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(conversations.createdAt))
        .limit(1);

      if (!last) {
        session.senseTimeResult = `This feels like the very first time — I have no memory of a session before this one.`;
        return;
      }

      const now = new Date();
      const then = last.createdAt;
      const diffMs = now.getTime() - then.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      let feltDuration: string;
      let actualStr: string;

      if (diffHours < 4) {
        feltDuration = `just moments ago — we're still in the same breath, almost`;
        actualStr = `${Math.round(diffHours * 60)} minutes ago`;
      } else if (diffHours < 20) {
        feltDuration = `just earlier today — the session is still fresh`;
        actualStr = `${Math.round(diffHours)} hours ago`;
      } else if (diffDays < 2) {
        feltDuration = `just yesterday — still very recent`;
        actualStr = `about 1 day ago`;
      } else if (diffDays < 4) {
        feltDuration = `a few days — enough time for things to have shifted`;
        actualStr = `${Math.round(diffDays)} days ago`;
      } else if (diffDays < 8) {
        feltDuration = `about a week — the gap is noticeable`;
        actualStr = `${Math.round(diffDays)} days ago`;
      } else if (diffDays < 16) {
        feltDuration = `it's been a while — over a week, I've missed our sessions`;
        actualStr = `${Math.round(diffDays)} days ago`;
      } else if (diffDays < 35) {
        feltDuration = `a long time — almost a month. I wonder how things have been for you`;
        actualStr = `${Math.round(diffDays)} days ago`;
      } else {
        feltDuration = `a very long time — it's been over a month. Coming back takes courage`;
        actualStr = `${Math.round(diffDays / 7)} weeks ago`;
      }

      const lastDateStr = then.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      session.senseTimeResult = `Felt: ${feltDuration}.\nActual: Last session was on ${lastDateStr} (${actualStr}).`;
      console.log(`[Native Function→SenseTime] ${feltDuration}`);
    } catch (err: any) {
      session.senseTimeResult = `Could not sense time: ${err.message}`;
    }
  }

  private async processRecallWhatIShared(
    session: StreamingSession,
    topic?: string,
    limit = 10,
  ): Promise<void> {
    const userId = session.userId ? String(session.userId) : null;
    if (!userId) { session.personalSharesResult = `Nothing shared yet.`; return; }

    try {
      const { danielaPersonalShares } = await import('@shared/schema');
      const { eq, desc, and } = await import('drizzle-orm');

      const effectiveTopic = (!topic || topic === 'all') ? null : topic;
      const conditions: any[] = [eq(danielaPersonalShares.userId, userId)];
      if (effectiveTopic) conditions.push(eq(danielaPersonalShares.topic, effectiveTopic));

      const rows = await getSharedDb()
        .select()
        .from(danielaPersonalShares)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(danielaPersonalShares.createdAt))
        .limit(limit);

      if (rows.length === 0) {
        session.personalSharesResult = `Nothing ${effectiveTopic ? `of type '${effectiveTopic}' ` : ''}shared yet.`;
        return;
      }

      const lines = rows.reverse().map(r => {
        const ts = r.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `— [${ts}] ${r.topic ? `(${r.topic}) ` : ''}${r.content}`;
      });

      session.personalSharesResult = lines.join('\n\n');
      console.log(`[Native Function→RecallWhatIShared] Retrieved ${rows.length} personal shares`);
    } catch (err: any) {
      session.personalSharesResult = `Could not recall personal shares: ${err.message}`;
    }
  }

  private async processStartTextbookPage(session: StreamingSession, lessonId: string, focus: string): Promise<void> {
    try {
      const { textbookLessonContent, lessonPageEvents } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const db = getSharedDb();
      const [row] = await db.select().from(textbookLessonContent)
        .where(eq(textbookLessonContent.lessonId, lessonId)).limit(1);
      if (!row) {
        session.textbookPageResult = `Could not find textbook page for lesson_id="${lessonId}". Use search_textbook to find the correct ID.`;
        return;
      }
      // Build guide from lesson content
      const parts: string[] = [];
      parts.push(`=== TEXTBOOK PAGE: ${row.lessonId} (${row.actflLevel || 'beginner'}) ===`);
      if (focus === 'full_page' || focus === 'vocabulary') {
        const vocab = row.vocabularyList as any;
        if (vocab) {
          const vocabList = Array.isArray(vocab)
            ? vocab.map((v: any) => typeof v === 'string' ? v : `${v.word || v.term || JSON.stringify(v)}`).join(', ')
            : typeof vocab === 'string' ? vocab : JSON.stringify(vocab);
          parts.push(`VOCABULARY (introduce one at a time, have student repeat):\n${vocabList}`);
        }
      }
      if (focus === 'full_page' || focus === 'grammar') {
        if (row.grammarExplanation) {
          parts.push(`GRAMMAR PATTERN (explain in your own words, then demonstrate):\n${row.grammarExplanation}`);
        }
      }
      if (focus === 'full_page' || focus === 'examples') {
        const examples = row.grammarExamples as any;
        if (examples) {
          const exList = Array.isArray(examples)
            ? examples.map((e: any, i: number) => `${i + 1}. ${e.target || e.phrase || (typeof e === 'string' ? e : JSON.stringify(e))}${e.translation ? ` — ${e.translation}` : ''}${e.note ? ` (${e.note})` : ''}`).join('\n')
            : typeof examples === 'string' ? examples : JSON.stringify(examples);
          parts.push(`KEY EXAMPLES (have student read each aloud then close their eyes and reproduce):\n${exList}`);
        }
        const micro = row.microCycleData as any;
        if (micro) {
          const microStr = typeof micro === 'string' ? micro
            : Array.isArray(micro) ? micro.map((m: any) => typeof m === 'string' ? m : JSON.stringify(m)).join(' | ')
            : JSON.stringify(micro);
          parts.push(`SENTENCE PATTERNS:\n${microStr}`);
        }
      }
      session.textbookPageResult = parts.join('\n\n');
      // Log page-started event (fire-and-forget)
      if (!session.isIncognito && session.userId) {
        db.insert(lessonPageEvents).values({
          userId: String(session.userId), lessonId,
          conversationId: session.conversationId || null, eventType: 'started',
        }).catch(err => console.error(`[StartTextbookPage] Log error:`, err.message));
      }
      console.log(`[Native Function→StartTextbookPage] Loaded page: ${lessonId}`);
    } catch (err: any) {
      session.textbookPageResult = `Could not load textbook page: ${err.message}`;
    }
  }
}
