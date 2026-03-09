import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { storage } from '../storage';

// ── Internal token (in-process, changes each restart) ────────────────────────
export const INTERNAL_BROWSER_TOKEN = crypto.randomBytes(32).toString('hex');
const FOUNDER_USER_ID = '49847136';

// ── Gemini client ─────────────────────────────────────────────────────────────
let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (_gemini) return _gemini;
  _gemini = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: '',
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
    },
  });
  return _gemini;
}

// ── Chromium executable path ──────────────────────────────────────────────────
function getChromiumPath(): string {
  try {
    return execSync('which chromium', { encoding: 'utf8' }).trim();
  } catch {
    return 'chromium';
  }
}

// ── Browser singleton ─────────────────────────────────────────────────────────
let _browser: Browser | null = null;
let _browserInitializing = false;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  if (_browserInitializing) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getBrowser();
  }
  _browserInitializing = true;
  try {
    const executablePath = getChromiumPath();
    console.log('[PlaywrightBrowser] Launching Chromium at:', executablePath);
    _browser = await chromium.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
      ],
    });
    console.log('[PlaywrightBrowser] Chromium ready');
    return _browser;
  } finally {
    _browserInitializing = false;
  }
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrowseResult {
  url: string;
  title: string;
  screenshotBase64: string;
  consoleErrors: string[];
  brokenImages: string[];
  httpStatus?: number;
}

export interface BrowseAnalysis extends BrowseResult {
  analysis: string;
}

export interface BrowseIntent {
  isBrowseRequest: boolean;
  participant: 'alden' | 'daniela' | 'sofia' | 'lyra' | 'wren';
  targetPage: string;
  targetUrl: string;
  question: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── Page URL resolver ─────────────────────────────────────────────────────────

const PAGE_MAP: Record<string, string> = {
  dashboard: '/',
  home: '/',
  'team room': '/team-room',
  teamroom: '/team-room',
  lessons: '/conversations',
  conversations: '/conversations',
  vocabulary: '/vocabulary',
  profile: '/profile',
  settings: '/settings',
  curriculum: '/curriculum',
  textbook: '/interactive-textbook',
  'interactive textbook': '/interactive-textbook',
  progress: '/progress-report',
  'progress report': '/progress-report',
  classes: '/teacher/classes',
  login: '/auth',
  auth: '/auth',
};

function resolveUrl(pageName: string): string {
  const base = 'http://localhost:5000';
  const lower = pageName.toLowerCase().trim();
  if (lower.startsWith('http') || lower.startsWith('/')) {
    return lower.startsWith('http') ? lower : `${base}${lower}`;
  }
  const mapped = PAGE_MAP[lower];
  return mapped ? `${base}${mapped}` : `${base}/`;
}

// ── Authenticated browser context ─────────────────────────────────────────────

async function createAuthenticatedContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'HolaHola-AIBrowser/1.0',
  });

  try {
    const authPage = await context.newPage();
    const response = await authPage.request.post('http://localhost:5000/api/internal/ai-browser-auth', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ token: INTERNAL_BROWSER_TOKEN }),
    });

    if (!response.ok()) {
      console.warn('[PlaywrightBrowser] Auth failed:', response.status());
    } else {
      console.log('[PlaywrightBrowser] AI browser session established');
    }
    await authPage.close();
  } catch (e) {
    console.warn('[PlaywrightBrowser] Auth step error (continuing):', e);
  }

  return context;
}

// ── Core browse + capture ─────────────────────────────────────────────────────

export async function browseAndCapture(targetUrl: string): Promise<BrowseResult> {
  const browser = await getBrowser();
  const context = await createAuthenticatedContext(browser);
  const consoleErrors: string[] = [];
  const brokenImages: string[] = [];

  try {
    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('response', response => {
      if (response.request().resourceType() === 'image' && !response.ok()) {
        brokenImages.push(response.url());
      }
    });

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    await page.close();
    await context.close();

    return {
      url: targetUrl,
      title,
      screenshotBase64,
      consoleErrors,
      brokenImages,
      httpStatus: response?.status(),
    };
  } catch (e) {
    await context.close().catch(() => {});
    throw e;
  }
}

// ── Gemini Vision analysis ────────────────────────────────────────────────────

export async function analyzeScreenshot(screenshotBase64: string, question: string): Promise<string> {
  const gemini = getGemini();
  const result = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: screenshotBase64,
          },
        },
        { text: question },
      ],
    }],
  });
  return result.text || 'No analysis returned.';
}

// ── Intent classification ─────────────────────────────────────────────────────

let _geminiForClassify: GoogleGenAI | null = null;
function getGeminiForClassify() {
  if (_geminiForClassify) return _geminiForClassify;
  _geminiForClassify = getGemini();
  return _geminiForClassify;
}

const PARTICIPANT_ROLES: Record<string, string> = {
  alden: 'developer — looking for broken UI, layout issues, whether a feature rendered correctly after a build',
  daniela: 'co-founder and curriculum advisor — looking at the student experience, pedagogy, UX flow',
  sofia: 'technical health specialist — looking for errors, broken states, performance issues',
  lyra: 'learning analyst — checking curriculum content, lesson layout, broken images in lessons',
  wren: 'security architect — checking that protected routes work, auth flows, role-based UI',
};

export async function classifyBrowseIntent(message: string): Promise<BrowseIntent> {
  const gemini = getGeminiForClassify();
  const participants = Object.keys(PARTICIPANT_ROLES).join(', ');

  const prompt = `Message: "${message}"

Is this a request for one of the AI team members (${participants}) to browse or visually inspect a page of the HolaHola app?

Examples:
- "Alden, screenshot the dashboard" → yes, alden, dashboard
- "Sofia, check the login flow" → yes, sofia, login
- "Lyra, look at the Spanish textbook page" → yes, lyra, textbook
- "Daniela, browse the lesson page" → yes, daniela, lessons
- "Wren, check that the team room is protected" → yes, wren, team room
- "Can you review my Spanish session?" → no (this is a self-critique request)
- "Build a progress bar feature" → no

Known page names: dashboard, home, lessons, conversations, vocabulary, profile, settings, curriculum, textbook, interactive textbook, progress, progress report, classes, login, auth, team room

Respond ONLY in this exact JSON format:
{
  "isBrowseRequest": true or false,
  "participant": "alden" or "daniela" or "sofia" or "lyra" or "wren",
  "targetPage": "the page name mentioned",
  "targetUrl": "the relative path like /conversations or / — use your best guess from the page name",
  "question": "what the participant should answer about the screenshot",
  "confidence": "high" or "medium" or "low"
}`;

  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = result.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isBrowseRequest: Boolean(parsed.isBrowseRequest),
        participant: parsed.participant || 'alden',
        targetPage: parsed.targetPage || 'dashboard',
        targetUrl: parsed.targetUrl || '/',
        question: parsed.question || 'What does this page show? Are there any visible issues?',
        confidence: parsed.confidence || 'medium',
      };
    }
  } catch (e) {
    console.error('[PlaywrightBrowser] classifyBrowseIntent error:', e);
  }

  return {
    isBrowseRequest: false,
    participant: 'alden',
    targetPage: 'dashboard',
    targetUrl: '/',
    question: '',
    confidence: 'low',
  };
}

// ── Per-participant analysis prompts ──────────────────────────────────────────

function buildAnalysisQuestion(participant: string, targetPage: string, baseQuestion: string): string {
  const roleContext = PARTICIPANT_ROLES[participant] || '';
  return `You are ${participant.charAt(0).toUpperCase() + participant.slice(1)}, the ${roleContext}.

You are looking at a screenshot of the HolaHola app — specifically the "${targetPage}" page.

${baseQuestion}

Be specific about what you see. Note any visible issues, UI problems, or things that look wrong. Keep your answer to 3-5 sentences. Start with what you observe, then note any concerns.`;
}

// ── Full async Team Room pipeline ─────────────────────────────────────────────

export async function runBrowserPipeline(
  _messageContent: string,
  roomId: string,
  _roomTopic: string,
  intent: BrowseIntent
): Promise<void> {
  const { emitNewMessage, emitArtifact } = await import('./team-room-ws-broker');
  const participant = intent.participant;
  const participantLabel = participant.charAt(0).toUpperCase() + participant.slice(1);

  console.log('[PlaywrightBrowser] Starting browse pipeline:', participant, '→', intent.targetUrl);

  try {
    const targetUrl = resolveUrl(intent.targetUrl || intent.targetPage);

    // Navigate and capture
    const browseResult = await browseAndCapture(targetUrl);

    // Analyze with Gemini Vision in the participant's persona
    const question = buildAnalysisQuestion(participant, intent.targetPage, intent.question);
    const analysis = await analyzeScreenshot(browseResult.screenshotBase64, question);

    // Build voice message (trim to 3 sentences max)
    const voiceSentences = analysis.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
    const errorsNote = browseResult.consoleErrors.length
      ? ` Also caught ${browseResult.consoleErrors.length} JS console error(s).`
      : '';
    const imagesNote = browseResult.brokenImages.length
      ? ` Found ${browseResult.brokenImages.length} broken image(s).`
      : '';
    const voiceContent = `${voiceSentences}${errorsNote}${imagesNote}`;

    // Post voice message
    const voiceMsg = await storage.createRoomMessage({
      roomId,
      speaker: participantLabel,
      content: voiceContent,
    });
    emitNewMessage(roomId, voiceMsg);

    // Post artifact with screenshot + full analysis
    const artifactContent: Record<string, unknown> = {
      participant,
      url: browseResult.url,
      title: browseResult.title,
      httpStatus: browseResult.httpStatus,
      screenshotBase64: browseResult.screenshotBase64,
      analysis,
      consoleErrors: browseResult.consoleErrors,
      brokenImages: browseResult.brokenImages,
      capturedAt: new Date().toISOString(),
    };

    const artifact = await storage.createRoomArtifact({
      roomId,
      artifactType: 'browser_screenshot',
      title: `${participantLabel} browsed: ${intent.targetPage} — ${new Date().toLocaleTimeString()}`,
      content: artifactContent,
      createdBy: participant,
    });
    emitArtifact(roomId, artifact);

    console.log('[PlaywrightBrowser] Pipeline complete. Artifact:', artifact.id);
  } catch (e: any) {
    console.error('[PlaywrightBrowser] Pipeline error:', e);
    try {
      const errMsg = await storage.createRoomMessage({
        roomId,
        speaker: participantLabel,
        content: `I tried to browse the ${intent.targetPage} page but ran into an issue: ${e?.message || 'unknown error'}. The browser service may need a moment to warm up — try again.`,
      });
      emitNewMessage(roomId, errMsg);
    } catch { /* swallow */ }
  }
}

// ── Page keyword → URL resolution ─────────────────────────────────────────────

const PAGE_KEYWORD_MAP: Array<[string, string]> = [
  ['team room', '/team-room'],
  ['teamroom', '/team-room'],
  ['vocabulary', '/vocabulary'],
  ['vocab', '/vocabulary'],
  ['flashcard', '/vocabulary'],
  ['textbook', '/textbook'],
  ['interactive textbook', '/textbook'],
  ['lesson', '/lessons'],
  ['conversation', '/conversations'],
  ['progress report', '/progress-report'],
  ['progress', '/progress-report'],
  ['profile', '/profile'],
  ['settings', '/settings'],
  ['curriculum', '/curriculum'],
  ['classes', '/classes'],
  ['login', '/auth'],
  ['auth', '/auth'],
  ['dashboard', '/'],
  ['home', '/'],
];

function resolvePageUrl(context: string): { page: string; url: string } {
  const lower = context.toLowerCase();
  for (const [keyword, url] of PAGE_KEYWORD_MAP) {
    if (lower.includes(keyword)) {
      return { page: keyword, url };
    }
  }
  return { page: 'dashboard', url: '/' };
}

// ── Post-build screenshot for Alden ──────────────────────────────────────────

export async function aldenPostBuildScreenshot(
  context: string,
  buildDescription: string,
  roomId: string
): Promise<void> {
  const { page, url } = resolvePageUrl(context);
  console.log(`[PlaywrightBrowser] Alden post-build screenshot: "${page}" (${url}) — context: "${context}"`);
  const intent: BrowseIntent = {
    isBrowseRequest: true,
    participant: 'alden',
    targetPage: page,
    targetUrl: url,
    question: `I just built: "${buildDescription}". Does this feature appear correctly on screen? What do you see? Note any layout issues, missing elements, or anything that looks wrong.`,
    confidence: 'high',
  };
  await runBrowserPipeline(buildDescription, roomId, '', intent);
}
