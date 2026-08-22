/**
 * Micro-Ack Service
 *
 * Pre-generates short acknowledgment audio clips using the tutor's voice,
 * then plays them immediately after the user finishes speaking — before the
 * main AI response arrives. Fills the dead-silence gap between speech end
 * and first audio, making Daniela feel present and responsive.
 *
 * Feature flag: localStorage key 'holahola_micro_ack' ('on' | 'off'), default 'on'
 */

const FEATURE_KEY = 'holahola_micro_ack';

export function isMicroAckEnabled(): boolean {
  return false;
}

export function setMicroAckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FEATURE_KEY, enabled ? 'on' : 'off');
  } catch {
    // ignore
  }
}

// --- Phrase pools per language ---

type AckCategory = 'thinking' | 'affirmative' | 'encouraging';

const PHRASE_POOLS: Record<string, Record<AckCategory, string[]>> = {
  spanish: {
    thinking:     ['A ver...', 'Déjame pensar...', 'Mm...'],
    affirmative:  ['Sí...', 'Claro...', 'Entiendo.'],
    encouraging:  ['Buena pregunta.', 'Interesante...', 'Muy bien.'],
  },
  french: {
    thinking:     ['Voyons...', 'Laissez-moi réfléchir...', 'Hmm...'],
    affirmative:  ['Oui...', "D'accord.", 'Je vois.'],
    encouraging:  ['Bonne question.', 'Intéressant...', 'Très bien.'],
  },
  german: {
    thinking:     ['Also...', 'Lass mich nachdenken...', 'Hmm...'],
    affirmative:  ['Ja...', 'Genau.', 'Ich verstehe.'],
    encouraging:  ['Gute Frage.', 'Interessant...', 'Sehr gut.'],
  },
  italian: {
    thinking:     ['Vediamo...', 'Fammi pensare...', 'Mm...'],
    affirmative:  ['Sì...', 'Certo.', 'Capisco.'],
    encouraging:  ['Buona domanda.', 'Interessante...', 'Molto bene.'],
  },
  portuguese: {
    thinking:     ['Vejamos...', 'Deixe-me pensar...', 'Mm...'],
    affirmative:  ['Sim...', 'Claro.', 'Entendo.'],
    encouraging:  ['Boa pergunta.', 'Interessante...', 'Muito bem.'],
  },
  japanese: {
    thinking:     ['ええと...', '少し考えさせて...', 'うーん...'],
    affirmative:  ['はい...', 'なるほど。', 'わかります。'],
    encouraging:  ['いい質問ですね。', '面白い...', 'とても良いです。'],
  },
  'mandarin chinese': {
    thinking:     ['让我想想...', '嗯...', '好的...'],
    affirmative:  ['是的...', '明白了。', '我理解。'],
    encouraging:  ['好问题。', '有意思...', '非常好。'],
  },
  korean: {
    thinking:     ['음...', '생각해 볼게요...', '잠깐...'],
    affirmative:  ['네...', '알겠어요.', '이해해요.'],
    encouraging:  ['좋은 질문이에요.', '흥미롭네요...', '잘 했어요.'],
  },
  hebrew: {
    thinking:     ['בואו נראה...', 'תן לי לחשוב...', 'אממ...'],
    affirmative:  ['כן...', 'בסדר.', 'מובן.'],
    encouraging:  ['שאלה טובה.', 'מעניין...', 'מצוין.'],
  },
  english: {
    thinking:     ['Let me think...', 'Hmm...', 'Let\'s see...'],
    affirmative:  ['Okay...', 'I see.', 'Right.'],
    encouraging:  ['Good question.', 'Interesting...', 'Very good.'],
  },
};

function getPool(language: string): Record<AckCategory, string[]> {
  const normalized = language.toLowerCase().trim();
  return PHRASE_POOLS[normalized] || PHRASE_POOLS['english'];
}

// --- State ---

interface AckClip {
  phrase: string;
  audioDataUrl: string;
}

let warmPool: AckClip[] = [];
let isWarming = false;
let lastUsedPhrase: string | null = null;
let currentLanguage: string = 'spanish';

// --- Pre-warm ---

export async function preWarmMicroAcks(language: string, gender: 'male' | 'female' = 'female'): Promise<void> {
  if (isWarming) return;
  isWarming = true;
  currentLanguage = language;
  warmPool = [];

  const pool = getPool(language);
  // Pick 2 from each category = 6 clips total
  const phrases: string[] = [
    pool.thinking[0],
    pool.thinking[1] || pool.thinking[0],
    pool.affirmative[0],
    pool.affirmative[1] || pool.affirmative[0],
    pool.encouraging[0],
    pool.encouraging[1] || pool.encouraging[0],
  ];

  try {
    const res = await fetch('/api/voice/micro-ack/pregenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ language, gender, phrases }),
    });

    if (!res.ok) {
      console.warn('[MicroAck] Pre-warm failed:', res.status);
      isWarming = false;
      return;
    }

    const data = await res.json() as { clips: { phrase: string; audioBase64: string }[] };
    warmPool = data.clips.map(c => ({
      phrase: c.phrase,
      audioDataUrl: `data:audio/mpeg;base64,${c.audioBase64}`,
    }));

    console.log(`[MicroAck] Pre-warmed ${warmPool.length} clips for ${language}`);
  } catch (err) {
    console.warn('[MicroAck] Pre-warm error:', err);
  } finally {
    isWarming = false;
  }
}

export function isMicroAckReady(): boolean {
  return warmPool.length > 0;
}

// --- Selection ---

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith('?') || /^(what|how|why|when|where|who|can|could|would|is|are|do|does|did)\b/i.test(trimmed);
}

export function selectMicroAck(transcript: string): AckClip | null {
  if (!isMicroAckEnabled()) return null;
  if (warmPool.length === 0) return null;

  const isPttPath = transcript === '';

  if (isPttPath) {
    // PTT path: transcript not available at button-release time — always fire
    // from the affirmative pool (30% skip still applies for natural variation)
    if (Math.random() < 0.3) return null;
  } else {
    // VAD / open-mic path: skip on very short utterances (e.g. "sí", "ok", "yes")
    if (wordCount(transcript) <= 3) return null;
    // Random 30% skip for natural variation
    if (Math.random() < 0.3) return null;
  }

  const pool = getPool(currentLanguage);
  let candidates: AckClip[];

  if (!isPttPath && isQuestion(transcript)) {
    // Thinking or encouraging acks for questions
    const questionPhrases = [...pool.thinking, ...pool.encouraging];
    candidates = warmPool.filter(c => questionPhrases.includes(c.phrase));
  } else {
    // Affirmative acks for statements and all PTT releases
    const affirmPhrases = [...pool.affirmative];
    candidates = warmPool.filter(c => affirmPhrases.includes(c.phrase));
  }

  if (candidates.length === 0) candidates = warmPool;

  // Don't repeat the same phrase twice in a row
  const fresh = candidates.filter(c => c.phrase !== lastUsedPhrase);
  const pick = fresh.length > 0 ? fresh : candidates;
  const chosen = pick[Math.floor(Math.random() * pick.length)];
  lastUsedPhrase = chosen.phrase;
  return chosen;
}

// --- Playback ---

/**
 * Plays an ack clip. Returns a Promise that resolves when playback ends.
 * If audio fails, resolves immediately (fail-safe).
 */
export function playMicroAck(clip: AckClip): Promise<void> {
  return new Promise(resolve => {
    try {
      const audio = new Audio(clip.audioDataUrl);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    } catch {
      resolve();
    }
  });
}
