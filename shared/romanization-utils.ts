/**
 * Romanization utilities for East Asian and Hebrew scripts.
 * No external dependencies — pure lookup tables and algorithms.
 */

// ─── Japanese: Hiragana / Katakana → Hepburn Romaji ────────────────────────

const HIRAGANA_MAP: Record<string, string> = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','ゐ':'i','ゑ':'e','を':'wo',
  'ん':'n',
  'っ':'',
  'ー':'-',
  // Digraphs
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
  'しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
  'みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
  'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
};

// Build katakana map by shifting codepoints (katakana = hiragana + 0x60)
const KATAKANA_MAP: Record<string, string> = {};
for (const [hira, roma] of Object.entries(HIRAGANA_MAP)) {
  const kata = [...hira].map(c => {
    const cp = c.codePointAt(0)!;
    return (cp >= 0x3041 && cp <= 0x3096)
      ? String.fromCodePoint(cp + 0x60)
      : c;
  }).join('');
  KATAKANA_MAP[kata] = roma;
}

function convertJapanese(text: string): string {
  // Try digraphs first (2-char combos), then single chars
  let result = '';
  let i = 0;
  const chars = [...text]; // spread handles multi-codepoint chars
  while (i < chars.length) {
    const twoChar = chars.slice(i, i + 2).join('');
    const oneChar = chars[i];
    
    if (twoChar.length === 2 && (HIRAGANA_MAP[twoChar] !== undefined || KATAKANA_MAP[twoChar] !== undefined)) {
      result += HIRAGANA_MAP[twoChar] ?? KATAKANA_MAP[twoChar] ?? twoChar;
      i += 2;
    } else if (HIRAGANA_MAP[oneChar] !== undefined) {
      // Handle っ doubling: っ before a consonant doubles it
      if (oneChar === 'っ' || oneChar === 'ッ') {
        const nextTwo = chars.slice(i + 1, i + 3).join('');
        const nextOne = chars[i + 1];
        const nextRoma = (nextTwo && (HIRAGANA_MAP[nextTwo] || KATAKANA_MAP[nextTwo])) ||
                         (nextOne && (HIRAGANA_MAP[nextOne] || KATAKANA_MAP[nextOne]));
        result += nextRoma ? nextRoma[0] : '';
      } else {
        result += HIRAGANA_MAP[oneChar];
      }
      i++;
    } else if (KATAKANA_MAP[oneChar] !== undefined) {
      if (oneChar === 'ッ') {
        const nextTwo = chars.slice(i + 1, i + 3).join('');
        const nextOne = chars[i + 1];
        const nextRoma = (nextTwo && KATAKANA_MAP[nextTwo]) || (nextOne && KATAKANA_MAP[nextOne]);
        result += nextRoma ? nextRoma[0] : '';
      } else {
        result += KATAKANA_MAP[oneChar];
      }
      i++;
    } else {
      // Non-kana character (kanji, punctuation, ASCII) — pass through
      result += oneChar;
      i++;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

// ─── Korean: Hangul → Revised Romanization of Korean ───────────────────────

const INITIAL_CONSONANTS = [
  'g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'
];
const VOWELS = [
  'a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'
];
const FINAL_CONSONANTS = [
  '','g','kk','gs','n','nj','nh','d','l','lg','lm','lb','ls','lt','lp','lh','m','b','bs','s','ss','ng','j','ch','k','t','p','h'
];

function isHangul(c: string): boolean {
  const cp = c.codePointAt(0)!;
  return cp >= 0xAC00 && cp <= 0xD7A3;
}

function convertKorean(text: string): string {
  let result = '';
  for (const ch of text) {
    if (isHangul(ch)) {
      const cp = ch.codePointAt(0)! - 0xAC00;
      const finalIdx = cp % 28;
      const vowelIdx = Math.floor(cp / 28) % 21;
      const initialIdx = Math.floor(cp / 28 / 21);
      result += INITIAL_CONSONANTS[initialIdx] + VOWELS[vowelIdx] + FINAL_CONSONANTS[finalIdx];
    } else {
      result += ch;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

// ─── Hebrew: Basic Latin transliteration ────────────────────────────────────

const HEBREW_MAP: Record<string, string> = {
  'א': "'", 'ב': 'v', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
  'כ': 'kh', 'ל': 'l', 'מ': 'm', 'נ': 'n', 'ס': 's',
  'ע': "'", 'פ': 'f', 'צ': 'ts', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
  // Final forms
  'ך': 'kh', 'ם': 'm', 'ן': 'n', 'ף': 'f', 'ץ': 'ts',
  // Niqqud vowel points (combine with consonant)
  '\u05B0': 'e', '\u05B1': 'e', '\u05B2': 'a', '\u05B3': 'o',
  '\u05B4': 'i', '\u05B5': 'e', '\u05B6': 'e', '\u05B7': 'a',
  '\u05B8': 'a', '\u05B9': 'o', '\u05BB': 'u', '\u05BC': '',
  '\u05BD': '', '\u05BE': '-', '\u05BF': '', '\u05C1': 'sh',
  '\u05C2': 's',
};

function convertHebrew(text: string): string {
  let result = '';
  for (const ch of text) {
    result += HEBREW_MAP[ch] ?? ch;
  }
  return result.replace(/\s+/g, ' ').replace(/'{2,}/g, "'").trim();
}

// ─── Mandarin: Pinyin lookup for common characters ──────────────────────────
// Mandarin cannot be romanized algorithmically from characters alone (tone-dependent).
// This stub returns null for Mandarin; romanization must come from AI-generated data.

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect if a string contains non-Latin script characters that need romanization.
 */
export function needsRomanization(text: string, language: string): boolean {
  if (!['japanese', 'korean', 'hebrew', 'mandarin'].includes(language)) return false;
  return /[^\x00-\x7F\s\-–—.,!?;:()\[\]'"0-9]/.test(text);
}

/**
 * Generate romanization for a word in the given language.
 * Returns null if romanization is not available or the text is already Latin-script.
 */
export function getRomanization(text: string, language: string): string | null {
  if (!text || !needsRomanization(text, language)) return null;
  
  try {
    switch (language) {
      case 'japanese': {
        const result = convertJapanese(text);
        // If the result still has non-ASCII, it contained kanji — return partial or null
        const hasKanji = /[\u4e00-\u9fff]/.test(result);
        if (hasKanji && result === text) return null; // pure kanji, can't convert
        // If mix of romaji + kanji, still useful
        return result !== text ? result : null;
      }
      case 'korean': {
        const result = convertKorean(text);
        return result !== text ? result : null;
      }
      case 'hebrew': {
        const result = convertHebrew(text);
        return result !== text ? result : null;
      }
      case 'mandarin':
        return null; // needs pinyin dictionary
      default:
        return null;
    }
  } catch {
    return null;
  }
}
