/**
 * Scenario Image Generator
 *
 * Generates vivid, illustrative cover images for each practice scenario
 * using Gemini Flash Image. Images are stored in object storage and the URL is
 * saved back to scenarios.imageUrl.
 *
 * Runs once at startup (fire-and-forget) and processes only scenarios
 * that are missing images — safe to restart.
 */

import { generateFromCustomPrompt } from './google-image-service';
import { getSharedDb } from '../db';
import { scenarios } from '../../shared/schema';
import { isNull, eq } from 'drizzle-orm';
import { uploadPublicBuffer } from './image-storage';

const GEMINI_STYLE = `Soft watercolor children's book illustration style. Warm, gentle colors with clean fine ink outlines. Wide landscape format. The artwork fills the entire image canvas completely — no white space, no color bars, no borders, no margins, no frames, no vignette at any edge. Color and content go all the way to every corner. At most 2-3 people visible in the entire scene. Every character shown from head to waist with face clearly visible, positioned well within the center of the frame. All characters wear contemporary casual clothing — jeans, T-shirts, blouses, sweaters, blazers, sneakers. CRITICAL HAIR RULE: Every single character has completely bare, natural, uncovered hair — absolutely NO hijab, NO headscarf, NO religious head covering, NO hat, NO hood, NO cap, NO turban, NO hair wrap of any kind on any character under any circumstances. No text, letters, numbers, signs, labels, or typography of any kind anywhere in the image. Suitable for a language-learning app scenario card thumbnail.`;

/**
 * Per-scenario scene descriptions.
 * Each entry describes the setting, characters, and key props.
 * The GEMINI_STYLE suffix handles all style, format, and safety rules.
 */
const SCENE_OVERRIDES: Record<string, string> = {
  // ── SOCIAL ──────────────────────────────────────────────────────────────────

  'birthday-party': `Cozy apartment living room decorated for a birthday. A round dining table holds a frosted cake with lit candles and a few wrapped gifts beside it. Two friends stand on opposite sides of the table — a young woman in a floral top clapping with delight, a young man in a grey T-shirt smiling warmly. Colorful balloons float at the ceiling. Warm lamplight fills the room. ${GEMINI_STYLE}`,

  'dinner-with-friend': `Bright casual neighbourhood restaurant at lunchtime. Two friends sit on opposite sides of a wooden table — a young man in a navy crewneck sweater facing the viewer, laughing; a young woman in a simple blouse sitting across from him, gesturing as she talks. On the table: two plates of food, a bread basket, two glasses of water with lemon slices. Natural window light. Relaxed, platonic lunch-between-friends energy. ${GEMINI_STYLE}`,

  'house-party': `Living room of a friendly house party. A small gathered space with string lights and a snack table in the background. In the foreground, two young adults stand chatting — a man in a casual button-down shirt holding a soda can, a woman in jeans and a colorful top. Warm, inviting indoor lighting. The background suggests a small group but only the two foreground people are detailed. ${GEMINI_STYLE}`,

  // ── PROFESSIONAL ────────────────────────────────────────────────────────────

  'business-lunch': `Upscale restaurant interior, midday. Two colleagues sit across from each other at a set table — a man in a blazer and open-collar shirt reviewing a menu, a woman in a smart blouse with a glass of water in front of her. White tablecloth, wine glasses, a small bread basket. Warm neutral restaurant tones. Professional but relaxed energy. ${GEMINI_STYLE}`,

  'job-interview': `Office job interview. At the extreme left edge of the image: a tall floor-to-ceiling bookshelf packed with binders and books. At the extreme right edge of the image: a large floor-to-ceiling window with bright daylight streaming in. The entire back wall between them is a warm grey painted surface. In the center foreground, a wooden desk: a female interviewer with a short bob haircut (uncovered, no hat) in a navy blazer sits on one side holding a clipboard; a male candidate with short neat hair (uncovered) in a button-up shirt sits across the desk leaning forward. A small potted succulent on the desk. The floor carpet is visible at the bottom edge. ${GEMINI_STYLE}`,

  'networking-event': `A bright conference hall during a professional networking mixer. Two professionals stand face-to-face exchanging business cards — a woman in a blazer and a man in a button-down shirt, both with small name-badge lanyards. In the blurred background, a few indistinct figures and a banner with no text. Confident, friendly energy. ${GEMINI_STYLE}`,

  'office-meeting': `Modern office meeting room. Three colleagues sit around a small conference table — a woman at the head of the table gesturing toward a large blank whiteboard, a man with a notepad across from her, another woman listening attentively. A laptop on the table, a water jug and glasses, and large windows with daylight. Collaborative professional mood. ${GEMINI_STYLE}`,

  'performance-review': `A private manager's office. A female manager in a blazer sits behind a desk, smiling kindly while holding a printed document. An employee — a young man in a collared shirt — sits across the desk, attentive and engaged. Neat desktop with a closed laptop and a small plant. A framed blank print on the wall. Warm, supportive professional setting. ${GEMINI_STYLE}`,

  'university-class': `University lecture hall with tiered wooden seats and large windows. A male professor in a tweed blazer stands at the front gesturing toward a completely blank whiteboard. In the foreground, two students are visible: a young woman taking notes in a notebook, a young man with his hand raised to ask a question. Warm mahogany tones and golden afternoon light. ${GEMINI_STYLE}`,

  // ── TRAVEL ──────────────────────────────────────────────────────────────────

  'airport-checkin': `An airport check-in counter, bright terminal lighting. A female traveler in jeans, a light jacket, and sneakers stands at the counter with a rolling suitcase, handing over her passport. A male airline agent in a uniform shirt stands behind the counter, smiling and typing on a keyboard. Clean, modern airport terminal. ${GEMINI_STYLE}`,

  'hotel-checkin': `Wide interior view of a stylish hotel lobby, filling the full frame corner to corner. The background is a warm beige wall spanning the full width, with a large decorative mirror on the left and a tall leafy plant on the right. The marble floor is visible at the bottom. Center: a male hotel receptionist with short neat dark hair (bare, uncovered head) in a dark suit jacket stands behind an elegant front desk. Across the desk, a female traveler with long straight chestnut hair completely loose and uncovered (NO scarf, NO hijab) wearing a casual blazer and jeans, holds a wheeled suitcase handle and receives a key card. ${GEMINI_STYLE}`,

  'taxi-ride': `Inside a yellow taxi cab, viewed from a slight side angle. A young woman with loose hair and casual clothes sits in the back seat, leaning toward a plastic partition to speak with the driver. The driver — a man in a casual shirt — is visible from behind and reflected in the rear-view mirror. Through the windows: a sunny city street. A glowing fare meter sits on the dashboard. ${GEMINI_STYLE}`,

  // ── DAILY LIFE ───────────────────────────────────────────────────────────────

  'coffee-shop': `Warm, cozy coffee shop interior. A female barista in a green apron stands behind a gleaming espresso machine, handing a paper cup to a male customer who leans on the counter with a friendly smile. Behind the barista: a chalkboard menu (completely blank), a pastry display case, and a wall of coffee equipment. Warm amber lighting. Inviting neighbourhood café feel. ${GEMINI_STYLE}`,

  'french-cafe': `A classic Parisian café interior. A male waiter in a crisp white shirt and black apron carries a small tray with an espresso cup and a croissant toward a female customer seated at a small round bistro table. Wicker chairs, a marble table top, lace curtains in the window, warm golden light. Quintessentially French café atmosphere. ${GEMINI_STYLE}`,

  'grocery-store': `A clean, bright indoor supermarket aisle. A young woman pushes a shopping cart filled with colorful produce — apples, greens, oranges. Beside her, a friendly male store employee in a vest points down the aisle helpfully. Well-stocked shelves of products visible in both directions. Neat, cheerful grocery store atmosphere. ${GEMINI_STYLE}`,

  'hebrew-coffee-shop': `A bright, modern Tel Aviv coffee shop with large windows and Mediterranean light. A female barista with curly hair in a casual apron stands at the counter smiling, placing a glass of strong coffee and a small pastry in front of a male customer seated on a stool. A succulent plant on the counter. Casual, sunny, contemporary Israeli café vibe. ${GEMINI_STYLE}`,

  'izakaya': `A cozy Japanese izakaya interior at evening. Warm amber lanterns hang above a polished wooden counter. A male bartender-chef in a short white jacket places a small dish of yakitori on the counter in front of a female customer perched on a bar stool, glass of cold barley tea in hand. Wooden shelves with sake bottles in the background. Intimate, convivial atmosphere. ${GEMINI_STYLE}`,

  'neighborhood-walk': `A charming residential city neighborhood on a sunny afternoon. Two friends walk side-by-side on a wide clean sidewalk — a woman in a light jacket carrying a reusable bag, a man in a T-shirt and jeans with hands in pockets. Small boutique shop fronts and mature trees line the street in the background. Relaxed, everyday city-walk energy. ${GEMINI_STYLE}`,

  'pharmacy': `A bright, clean modern pharmacy interior with white shelving stocked with colorful product boxes. A female pharmacist in a white lab coat with auburn hair pulled into a bun stands behind the counter, handing a white paper bag to a male customer in a grey hoodie. The pharmacist points helpfully to the label on the bag. Both visible from head to waist. ${GEMINI_STYLE}`,

  'restaurant': `A warm, inviting local restaurant interior, dinner service. A male waiter in a casual apron stands tableside, notepad in hand, taking an order from a female diner who looks up from her menu with a smile. A lit candle and simple table setting on the table. Other tables blurred softly in the background. Relaxed neighborhood restaurant feel. ${GEMINI_STYLE}`,

  'taqueria': `A vibrant Mexican street taqueria. A male taquero in his 30s — white apron and backward baseball cap — stands at a sizzling flat-top grill loaded with carne asada, using a spatula. A small counter in front of him holds lime wedges, fresh cilantro, and small bowls of salsa verde and roja. A female customer leans on the counter smiling, ready to order. Rich warm colors: terracotta, avocado green, golden yellow. ${GEMINI_STYLE}`,

  'the-bank': `Modern bank interior. At the extreme left edge of the foreground: a silver velvet rope stanchion (classic bank queue barrier). At the extreme right edge of the background: a large round chrome bank vault door with a spinning wheel handle, set flush into the right wall. The back wall is cream-white and flat. A long low service desk spans horizontally across the center of the scene — flat, rectangular, with a thin flat glass panel (NO arch, NO oval, NO rounded frame of any kind) and a computer monitor on top. Behind the desk: a male bank employee with short natural hair (uncovered) in a dark dress shirt, smiling, pointing at a document. In front of the desk: a female customer with shoulder-length curly hair (uncovered) in a light blazer, holding a paper form. The tiled floor is visible at the bottom. ${GEMINI_STYLE}`,

  // ── EMERGENCY ────────────────────────────────────────────────────────────────

  'doctors-office': `A clean, calm doctor's examination room with soft white walls. A female doctor in a white coat holds a clipboard and speaks gently to a male patient seated on an examination table in a casual shirt. A small desk, a jar of cotton swabs, and blank medical posters on the wall. Reassuring and professional atmosphere. ${GEMINI_STYLE}`,

  'lost-and-found': `Inside a train station information desk. A male station agent in a neat uniform leans over a small counter, pointing at a map on the desk to help a young female tourist who holds her backpack straps with a relieved expression. Large arched windows with soft daylight visible behind them. Helpful, calm atmosphere. ${GEMINI_STYLE}`,

  // ── CULTURAL ─────────────────────────────────────────────────────────────────

  'cooking-class': `A bright, well-equipped teaching kitchen. A female chef instructor in a white chef's coat and apron stands at a prep station demonstrating knife technique on a cutting board surrounded by colorful vegetables. Two students in aprons on either side of her watch attentively. Stainless steel counters, pendant lights, a rack of hanging pots in the background. Energetic, educational cooking atmosphere. ${GEMINI_STYLE}`,

  'local-festival': `An outdoor town festival on a sunny afternoon. Two friends browse a colorful market stall decorated with festive bunting — a young woman holding a small handmade craft item, a young man pointing at goods on the table with a grin. The stall holder is partially visible behind a table of displayed items. Festive decorations, trees, and blue sky in the background. ${GEMINI_STYLE}`,

  'museum-visit': `A quiet art gallery with white walls and track lighting. Two visitors stand side-by-side in front of a large framed painting, studying it with interest — a woman in a casual blazer with arms crossed in appreciation, a man beside her gesturing toward a detail in the artwork. The painting itself is abstract with soft colors and no recognizable imagery. Peaceful, contemplative museum atmosphere. ${GEMINI_STYLE}`,
};

function buildScenarioPrompt(slug: string, title: string, description: string, location: string | null, category: string, topics: string[]): string {
  if (SCENE_OVERRIDES[slug]) return SCENE_OVERRIDES[slug];

  const topicHint = topics.slice(0, 3).map(t => t.replace(/-/g, ' ')).join(', ');
  const locationHint = location ? ` Set in: ${location}.` : '';

  return `Scene for a language-learning app: "${title}" — ${description}${locationHint}${topicHint ? ` Topics: ${topicHint}.` : ''} Two people in conversation in a clearly recognisable setting. ${GEMINI_STYLE}`;
}

async function generateImageBuffer(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const dataUrl = await generateFromCustomPrompt(prompt);
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    return { buffer: Buffer.from(matches[2], 'base64'), mimeType: matches[1] };
  } catch (err) {
    console.error('[ScenarioImages] Gemini generation error:', err);
    return null;
  }
}

async function generateScenarioImages(): Promise<void> {
  try {
    const db = getSharedDb();

    const pending = await db
      .select({
        id: scenarios.id,
        slug: scenarios.slug,
        title: scenarios.title,
        description: scenarios.description,
        location: scenarios.location,
        category: scenarios.category,
        topics: scenarios.curriculumTopics,
      })
      .from(scenarios)
      .where(isNull(scenarios.imageUrl));

    if (pending.length === 0) {
      console.log('[ScenarioImages] All scenarios already have images');
      return;
    }

    console.log(`[ScenarioImages] Generating ${pending.length} scenario covers via Gemini...`);
    let generated = 0;
    let failed = 0;

    for (const scenario of pending) {
      try {
        const prompt = buildScenarioPrompt(
          scenario.slug,
          scenario.title,
          scenario.description,
          scenario.location ?? null,
          scenario.category,
          (scenario.topics as string[]) || [],
        );

        const img = await generateImageBuffer(prompt);
        if (!img) {
          console.warn(`[ScenarioImages] No image returned for: ${scenario.slug}`);
          failed++;
          continue;
        }

        const filename = `scenario-${scenario.slug}.png`;
        const baseUrl = await uploadPublicBuffer(filename, img.buffer, img.mimeType);
        const url = `${baseUrl}?v=${Date.now()}`;

        await db
          .update(scenarios)
          .set({ imageUrl: url })
          .where(eq(scenarios.id, scenario.id));

        generated++;
        console.log(`[ScenarioImages] ✓ ${scenario.title}`);

        await new Promise(r => setTimeout(r, 1_000));
      } catch (err: any) {
        if (err?.status === 401 || err?.code === 'invalid_api_key') throw err;
        console.error(`[ScenarioImages] Failed for ${scenario.slug}:`, err);
        failed++;
      }
    }

    console.log(`[ScenarioImages] Done — ${generated} generated, ${failed} failed`);
  } catch (err) {
    console.error('[ScenarioImages] Fatal error:', err);
  }
}

let _scenarioWorkerStarted = false;

/**
 * Runs scenario image generation once at startup (fire-and-forget).
 * Safe to call multiple times — only one run will proceed.
 */
export function startScenarioImageWorker(): void {
  if (_scenarioWorkerStarted) return;
  _scenarioWorkerStarted = true;
  setTimeout(() => generateScenarioImages(), 8_000);
}
