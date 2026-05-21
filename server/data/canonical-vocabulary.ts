/**
 * Canonical Vocabulary Registry
 *
 * Single source of truth for all vocabulary concepts across every thematic unit
 * and all 9 supported languages.
 *
 * HOW TO USE:
 *   import { lookupCanonicalConcept } from '../data/canonical-vocabulary';
 *   const conceptKey = lookupCanonicalConcept('étudier', 'french');
 *   // Returns 'vocab_spanish_estudiar' or null if no match
 *
 * ARCHITECTURE:
 *   canonical registry (this file)
 *     → shared concept map (CONCEPT_KEY_MAP in vocabulary-image-resolver.ts)
 *     → SCENE_OVERRIDE (vocab-image-seed-service.ts)
 *     → SVG (grammar/number concepts)
 *     → DALL-E generation (last resort — style inconsistency risk)
 *
 * IMAGE TIERS:
 *   'shared'         — one DB image (under sharedConceptKey) shared across all languages
 *   'scene_override' — per-language character scene; sharedConceptKey is undefined
 *   'svg'            — inline SVG (numbers, function words); sharedConceptKey is undefined
 *   'none'           — abstract concept; no static image possible
 *
 * SHARED CONCEPT KEY FORMAT:
 *   vocab_spanish_{normalized_spanish_word}
 *   e.g. vocab_spanish_estudiar, vocab_spanish_manzana, vocab_spanish_madre
 *
 * NORMALIZATION:
 *   Words in the `words` record use their natural spelling (diacritics included).
 *   The CANONICAL_LOOKUP precomputed map normalizes them the same way normalizeWord()
 *   does in vocabulary-image-resolver.ts: lowercase → strip combining diacriticals →
 *   strip punctuation → trim.
 */

export type Language =
  | 'english'
  | 'french'
  | 'german'
  | 'italian'
  | 'portuguese'
  | 'spanish'
  | 'japanese'
  | 'korean'
  | 'mandarin'
  | 'hebrew';

export type ImageTier = 'shared' | 'scene_override' | 'svg' | 'none';

export interface ConceptEntry {
  conceptKey: string;
  englishGloss: string;
  imageTier: ImageTier;
  sharedConceptKey?: string;
  words: Partial<Record<Language, string>>;
  notes?: string;
}

export type UnitTheme =
  | 'greetings'
  | 'family'
  | 'school'
  | 'hobbies'
  | 'food'
  | 'numbers_time'
  | 'daily_routines'
  | 'shopping'
  | 'city'
  | 'travel_transport'
  | 'identity'
  | 'health'
  | 'technology'
  | 'environment'
  | 'past_tense'
  | 'global_challenges'
  | 'arts'
  | 'history'
  | 'future_plans'
  | 'travel_extended'
  | 'science'
  | 'cultural_perspectives'
  | 'exam_prep'
  | 'cultural_heritage'
  | 'media_journalism'
  | 'finance'
  | 'advanced_skills';

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 1 — Novice Low: Greetings & Introductions
// ─────────────────────────────────────────────────────────────────────────────
const GREETINGS: ConceptEntry[] = [
  {
    conceptKey: 'hello',
    englishGloss: 'hello',
    imageTier: 'scene_override',
    words: {
      english: 'hello', french: 'bonjour', german: 'hallo', italian: 'ciao',
      portuguese: 'olá', spanish: 'hola', japanese: 'こんにちは', korean: '안녕하세요', mandarin: '你好',
    },
    notes: 'Character scene per language; French "bonjour" also covers morning',
  },
  {
    conceptKey: 'goodbye',
    englishGloss: 'goodbye',
    imageTier: 'scene_override',
    words: {
      english: 'goodbye', french: 'au revoir', german: 'auf Wiedersehen', italian: 'arrivederci',
      portuguese: 'tchau', spanish: 'adiós', japanese: 'さようなら', korean: '안녕히 가세요', mandarin: '再见',
    },
  },
  {
    conceptKey: 'good_morning',
    englishGloss: 'good morning',
    imageTier: 'scene_override',
    words: {
      english: 'good morning', french: 'bonjour', german: 'guten Morgen', italian: 'buongiorno',
      portuguese: 'bom dia', spanish: 'buenos días', japanese: 'おはよう', korean: '좋은 아침', mandarin: '早上好',
    },
  },
  {
    conceptKey: 'good_evening',
    englishGloss: 'good evening',
    imageTier: 'scene_override',
    words: {
      english: 'good evening', french: 'bonsoir', german: 'guten Abend', italian: 'buonasera',
      portuguese: 'boa tarde', spanish: 'buenas tardes', japanese: 'こんばんは', korean: '좋은 저녁', mandarin: '晚上好',
    },
  },
  {
    conceptKey: 'good_night',
    englishGloss: 'good night',
    imageTier: 'scene_override',
    words: {
      english: 'good night', french: 'bonne nuit', german: 'gute Nacht', italian: 'buonanotte',
      portuguese: 'boa noite', spanish: 'buenas noches', japanese: 'おやすみ', korean: '잘 자요', mandarin: '晚安',
    },
  },
  {
    conceptKey: 'please',
    englishGloss: 'please',
    imageTier: 'scene_override',
    words: {
      english: 'please', french: "s'il vous plaît", german: 'bitte', italian: 'per favore',
      portuguese: 'por favor', spanish: 'por favor', japanese: 'どうぞ', korean: '제발', mandarin: '请',
    },
  },
  {
    conceptKey: 'thank_you',
    englishGloss: 'thank you',
    imageTier: 'scene_override',
    words: {
      english: 'thank you', french: 'merci', german: 'danke', italian: 'grazie',
      portuguese: 'obrigado', spanish: 'gracias', japanese: 'ありがとう', korean: '감사합니다', mandarin: '谢谢',
    },
  },
  {
    conceptKey: 'youre_welcome',
    englishGloss: "you're welcome",
    imageTier: 'scene_override',
    words: {
      english: "you're welcome", french: 'de rien', german: 'bitte', italian: 'prego',
      portuguese: 'de nada', spanish: 'de nada', japanese: 'どういたしまして', korean: '천만에요', mandarin: '不客气',
    },
  },
  {
    conceptKey: 'my_name_is',
    englishGloss: 'my name is',
    imageTier: 'scene_override',
    words: {
      english: 'my name is', french: "je m'appelle", german: 'ich heiße', italian: 'mi chiamo',
      portuguese: 'me chamo', spanish: 'me llamo', japanese: 'わたしは〜です', korean: '제 이름은', mandarin: '我叫',
    },
  },
  {
    conceptKey: 'nice_to_meet',
    englishGloss: 'nice to meet you',
    imageTier: 'scene_override',
    words: {
      english: 'nice to meet you', french: 'enchanté', german: 'schön dich zu treffen',
      italian: 'piacere', portuguese: 'prazer', spanish: 'mucho gusto',
      japanese: 'はじめまして', korean: '만나서 반가워요', mandarin: '很高兴认识你',
    },
  },
  {
    conceptKey: 'how_are_you',
    englishGloss: 'how are you?',
    imageTier: 'scene_override',
    words: {
      english: 'how are you', french: 'comment allez-vous', german: 'wie geht es Ihnen',
      italian: 'come stai', portuguese: 'como vai', spanish: '¿cómo estás?',
      japanese: 'お元気ですか', korean: '잘 지내세요', mandarin: '你好吗',
    },
  },
  {
    conceptKey: 'see_you_later',
    englishGloss: 'see you later',
    imageTier: 'scene_override',
    words: {
      english: 'see you later', french: 'à bientôt', german: 'bis später',
      italian: 'a presto', portuguese: 'até logo', spanish: 'hasta luego',
      japanese: 'またね', korean: '나중에 봐요', mandarin: '再见',
    },
  },
  {
    conceptKey: 'excuse_me',
    englishGloss: 'excuse me',
    imageTier: 'scene_override',
    words: {
      english: 'excuse me', french: 'excusez-moi', german: 'entschuldigung',
      italian: 'scusi', portuguese: 'com licença', spanish: 'con permiso',
      japanese: 'すみません', korean: '실례합니다', mandarin: '打扰一下',
    },
  },
  {
    conceptKey: 'sorry',
    englishGloss: 'sorry',
    imageTier: 'scene_override',
    words: {
      english: 'sorry', french: 'désolé', german: 'es tut mir leid',
      italian: 'mi dispiace', portuguese: 'desculpe', spanish: 'lo siento',
      japanese: 'ごめんなさい', korean: '미안합니다', mandarin: '对不起',
    },
  },
  {
    conceptKey: 'yes',
    englishGloss: 'yes',
    imageTier: 'scene_override',
    words: {
      english: 'yes', french: 'oui', german: 'ja',
      italian: 'sì', portuguese: 'sim', spanish: 'sí',
      japanese: 'はい', korean: '네', mandarin: '是',
    },
  },
  {
    conceptKey: 'no',
    englishGloss: 'no',
    imageTier: 'scene_override',
    words: {
      english: 'no', french: 'non', german: 'nein',
      italian: 'no', portuguese: 'não', spanish: 'no',
      japanese: 'いいえ', korean: '아니요', mandarin: '不',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 2 — Novice Low: Family & Relationships
// ─────────────────────────────────────────────────────────────────────────────
const FAMILY: ConceptEntry[] = [
  {
    conceptKey: 'mother',
    englishGloss: 'mother',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_madre',
    words: {
      english: 'mother', french: 'mère', german: 'Mutter',
      italian: 'madre', portuguese: 'mãe', spanish: 'madre',
      japanese: 'おかあさん', korean: '어머니', mandarin: '妈妈',
    },
  },
  {
    conceptKey: 'father',
    englishGloss: 'father',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_padre',
    words: {
      english: 'father', french: 'père', german: 'Vater',
      italian: 'padre', portuguese: 'pai', spanish: 'padre',
      japanese: 'おとうさん', korean: '아버지', mandarin: '爸爸',
    },
  },
  {
    conceptKey: 'brother',
    englishGloss: 'brother',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_hermano',
    words: {
      english: 'brother', french: 'frère', german: 'Bruder',
      italian: 'fratello', portuguese: 'irmão', spanish: 'hermano',
      japanese: 'おにいさん', korean: '형', mandarin: '哥哥',
    },
  },
  {
    conceptKey: 'sister',
    englishGloss: 'sister',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_hermana',
    words: {
      english: 'sister', french: 'sœur', german: 'Schwester',
      italian: 'sorella', portuguese: 'irmã', spanish: 'hermana',
      japanese: 'おねえさん', korean: '언니', mandarin: '姐姐',
    },
  },
  {
    conceptKey: 'grandmother',
    englishGloss: 'grandmother',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_abuela',
    words: {
      english: 'grandmother', french: 'grand-mère', german: 'Großmutter',
      italian: 'nonna', portuguese: 'avó', spanish: 'abuela',
      japanese: 'おばあさん', korean: '할머니', mandarin: '奶奶',
    },
  },
  {
    conceptKey: 'grandfather',
    englishGloss: 'grandfather',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_abuelo',
    words: {
      english: 'grandfather', french: 'grand-père', german: 'Großvater',
      italian: 'nonno', portuguese: 'avô', spanish: 'abuelo',
      japanese: 'おじいさん', korean: '할아버지', mandarin: '爷爷',
    },
  },
  {
    conceptKey: 'friend',
    englishGloss: 'friend',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_amigo',
    words: {
      english: 'friend', french: 'ami', german: 'Freund',
      italian: 'amico', portuguese: 'amigo', spanish: 'amigo',
      japanese: 'ともだち', korean: '친구', mandarin: '朋友',
    },
  },
  {
    conceptKey: 'man',
    englishGloss: 'man',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_hombre',
    words: {
      english: 'man', french: 'homme', german: 'Mann',
      italian: 'uomo', portuguese: 'homem', spanish: 'hombre',
      japanese: 'おとこ', korean: '남자', mandarin: '男人',
    },
  },
  {
    conceptKey: 'woman',
    englishGloss: 'woman',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mujer',
    words: {
      english: 'woman', french: 'femme', german: 'Frau',
      italian: 'donna', portuguese: 'mulher', spanish: 'mujer',
      japanese: 'おんな', korean: '여자', mandarin: '女人',
    },
  },
  {
    conceptKey: 'boy',
    englishGloss: 'boy',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_nino',
    words: {
      english: 'boy', french: 'garçon', german: 'Junge',
      italian: 'ragazzo', portuguese: 'menino', spanish: 'niño',
      japanese: 'おとこのこ', korean: '남자아이', mandarin: '男孩',
    },
  },
  {
    conceptKey: 'girl',
    englishGloss: 'girl',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_nina',
    words: {
      english: 'girl', french: 'fille', german: 'Mädchen',
      italian: 'ragazza', portuguese: 'menina', spanish: 'niña',
      japanese: 'おんなのこ', korean: '여자아이', mandarin: '女孩',
    },
  },
  {
    conceptKey: 'teacher',
    englishGloss: 'teacher',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_maestra',
    words: {
      english: 'teacher', french: 'professeur', german: 'Lehrer',
      italian: 'professore', portuguese: 'professor', spanish: 'maestra',
      japanese: 'せんせい', korean: '선생님', mandarin: '老师',
    },
    notes: 'Anchor image shows a female teacher (maestra) at a chalkboard',
  },
  {
    conceptKey: 'student',
    englishGloss: 'student',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_estudiante',
    words: {
      english: 'student', french: 'étudiant', german: 'Student',
      italian: 'studente', portuguese: 'estudante', spanish: 'estudiante',
      japanese: 'がくせい', korean: '학생', mandarin: '学生',
    },
  },
  {
    conceptKey: 'baby',
    englishGloss: 'baby',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_bebe',
    words: {
      english: 'baby', french: 'bébé', german: 'Baby',
      italian: 'bambino', portuguese: 'bebê', spanish: 'bebé',
      japanese: 'あかちゃん', korean: '아기', mandarin: '婴儿',
    },
  },
  {
    conceptKey: 'family',
    englishGloss: 'family',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_familia',
    words: {
      english: 'family', french: 'famille', german: 'Familie',
      italian: 'famiglia', portuguese: 'família', spanish: 'familia',
      japanese: 'かぞく', korean: '가족', mandarin: '家庭',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 3 — Novice Mid: School Life
// ─────────────────────────────────────────────────────────────────────────────
const SCHOOL: ConceptEntry[] = [
  {
    conceptKey: 'book',
    englishGloss: 'book',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_libro',
    words: {
      english: 'book', french: 'livre', german: 'Buch',
      italian: 'libro', portuguese: 'livro', spanish: 'libro',
      japanese: 'ほん', korean: '책', mandarin: '书',
    },
  },
  {
    conceptKey: 'pencil',
    englishGloss: 'pencil',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_lapiz',
    words: {
      english: 'pencil', french: 'crayon', german: 'Bleistift',
      italian: 'matita', portuguese: 'lápis', spanish: 'lápiz',
      japanese: 'えんぴつ', korean: '연필', mandarin: '铅笔',
    },
  },
  {
    conceptKey: 'pen',
    englishGloss: 'pen',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_boligrafo',
    words: {
      english: 'pen', french: 'stylo', german: 'Kugelschreiber',
      italian: 'penna', portuguese: 'caneta', spanish: 'bolígrafo',
      japanese: 'ペン', korean: '펜', mandarin: '钢笔',
    },
  },
  {
    conceptKey: 'backpack',
    englishGloss: 'backpack',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mochila',
    words: {
      english: 'backpack', french: 'sac à dos', german: 'Rucksack',
      italian: 'zaino', portuguese: 'mochila', spanish: 'mochila',
      japanese: 'リュック', korean: '가방', mandarin: '书包',
    },
  },
  {
    conceptKey: 'desk',
    englishGloss: 'desk',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_escritorio',
    words: {
      english: 'desk', french: 'bureau', german: 'Schreibtisch',
      italian: 'banco', portuguese: 'mesa', spanish: 'escritorio',
      japanese: 'つくえ', korean: '책상', mandarin: '桌子',
    },
  },
  {
    conceptKey: 'chair',
    englishGloss: 'chair',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_silla',
    words: {
      english: 'chair', french: 'chaise', german: 'Stuhl',
      italian: 'sedia', portuguese: 'cadeira', spanish: 'silla',
      japanese: 'いす', korean: '의자', mandarin: '椅子',
    },
  },
  {
    conceptKey: 'classroom',
    englishGloss: 'classroom',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_aula',
    words: {
      english: 'classroom', french: 'salle de classe', german: 'Klassenzimmer',
      italian: 'aula', portuguese: 'sala de aula', spanish: 'aula',
      japanese: 'きょうしつ', korean: '교실', mandarin: '教室',
    },
  },
  {
    conceptKey: 'school',
    englishGloss: 'school',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_escuela',
    words: {
      english: 'school', french: 'école', german: 'Schule',
      italian: 'scuola', portuguese: 'escola', spanish: 'escuela',
      japanese: 'がっこう', korean: '학교', mandarin: '学校',
    },
  },
  {
    conceptKey: 'to_speak',
    englishGloss: 'to speak',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_hablar',
    words: {
      english: 'speak', french: 'parler', german: 'sprechen',
      italian: 'parlare', portuguese: 'falar', spanish: 'hablar',
      japanese: '話す', korean: '말하다', mandarin: '说话',
    },
  },
  {
    conceptKey: 'to_listen',
    englishGloss: 'to listen',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_escuchar',
    words: {
      english: 'listen', french: 'écouter', german: 'hören',
      italian: 'ascoltare', portuguese: 'escutar', spanish: 'escuchar',
      japanese: '聞く', korean: '듣다', mandarin: '听',
    },
  },
  {
    conceptKey: 'to_read',
    englishGloss: 'to read',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_leer',
    words: {
      english: 'read', french: 'lire', german: 'lesen',
      italian: 'leggere', portuguese: 'ler', spanish: 'leer',
      japanese: '読む', korean: '읽다', mandarin: '看书',
    },
  },
  {
    conceptKey: 'to_write',
    englishGloss: 'to write',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_escribir',
    words: {
      english: 'write', french: 'écrire', german: 'schreiben',
      italian: 'scrivere', portuguese: 'escrever', spanish: 'escribir',
      japanese: '書く', korean: '쓰다', mandarin: '写字',
    },
  },
  {
    conceptKey: 'to_study',
    englishGloss: 'to study',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_estudiar',
    words: {
      english: 'study', french: 'étudier', german: 'studieren',
      italian: 'studiare', portuguese: 'estudar', spanish: 'estudiar',
      japanese: '勉強する', korean: '공부하다', mandarin: '学习',
    },
  },
  {
    conceptKey: 'to_play',
    englishGloss: 'to play',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_jugar',
    words: {
      english: 'play', french: 'jouer', german: 'spielen',
      italian: 'giocare', portuguese: 'jogar', spanish: 'jugar',
      japanese: '遊ぶ', korean: '놀다', mandarin: '玩',
    },
  },
  {
    conceptKey: 'window',
    englishGloss: 'window',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_ventana',
    words: {
      english: 'window', french: 'fenêtre', german: 'Fenster',
      italian: 'finestra', portuguese: 'janela', spanish: 'ventana',
      japanese: 'まど', korean: '창문', mandarin: '窗户',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 4 — Novice Mid: Hobbies & Free Time
// ─────────────────────────────────────────────────────────────────────────────
const HOBBIES: ConceptEntry[] = [
  {
    conceptKey: 'to_dance',
    englishGloss: 'to dance',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_bailar',
    words: {
      english: 'dance', french: 'danser', german: 'tanzen',
      italian: 'ballare', portuguese: 'dançar', spanish: 'bailar',
      japanese: '踊る', korean: '춤추다', mandarin: '跳舞',
    },
  },
  {
    conceptKey: 'to_sing',
    englishGloss: 'to sing',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_cantar',
    words: {
      english: 'sing', french: 'chanter', german: 'singen',
      italian: 'cantare', portuguese: 'cantar', spanish: 'cantar',
      japanese: '歌う', korean: '노래하다', mandarin: '唱歌',
    },
  },
  {
    conceptKey: 'to_swim',
    englishGloss: 'to swim',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_nadar',
    words: {
      english: 'swim', french: 'nager', german: 'schwimmen',
      italian: 'nuotare', portuguese: 'nadar', spanish: 'nadar',
      japanese: '泳ぐ', korean: '수영하다', mandarin: '游泳',
    },
  },
  {
    conceptKey: 'to_run',
    englishGloss: 'to run',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_correr',
    words: {
      english: 'run', french: 'courir', german: 'laufen',
      italian: 'correre', portuguese: 'correr', spanish: 'correr',
      japanese: '走る', korean: '달리다', mandarin: '跑步',
    },
  },
  {
    conceptKey: 'to_walk',
    englishGloss: 'to walk',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_caminar',
    words: {
      english: 'walk', french: 'marcher', german: 'gehen',
      italian: 'camminare', portuguese: 'caminhar', spanish: 'caminar',
      japanese: '歩く', korean: '걷다', mandarin: '走路',
    },
  },
  {
    conceptKey: 'to_cook',
    englishGloss: 'to cook',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_cocinar',
    words: {
      english: 'cook', french: 'cuisiner', german: 'kochen',
      italian: 'cucinare', portuguese: 'cozinhar', spanish: 'cocinar',
      japanese: '料理する', korean: '요리하다', mandarin: '做饭',
    },
  },
  {
    conceptKey: 'to_watch',
    englishGloss: 'to watch',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mirar',
    words: {
      english: 'watch', french: 'regarder', german: 'schauen',
      italian: 'guardare', portuguese: 'assistir', spanish: 'mirar',
      japanese: '見る', korean: '보다', mandarin: '看',
    },
  },
  {
    conceptKey: 'to_paint',
    englishGloss: 'to paint',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pintar',
    words: {
      english: 'paint', french: 'peindre', german: 'malen',
      italian: 'dipingere', portuguese: 'pintar', spanish: 'pintar',
      japanese: '描く', korean: '그리다', mandarin: '画画',
    },
  },
  {
    conceptKey: 'to_buy',
    englishGloss: 'to buy',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_comprar',
    words: {
      english: 'buy', french: 'acheter', german: 'kaufen',
      italian: 'comprare', portuguese: 'comprar', spanish: 'comprar',
      japanese: '買う', korean: '사다', mandarin: '买',
    },
  },
  {
    conceptKey: 'music',
    englishGloss: 'music',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_musica',
    words: {
      english: 'music', french: 'musique', german: 'Musik',
      italian: 'musica', portuguese: 'música', spanish: 'música',
      japanese: '音楽', korean: '음악', mandarin: '音乐',
    },
  },
  {
    conceptKey: 'sport',
    englishGloss: 'sport',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_deporte',
    words: {
      english: 'sport', french: 'sport', german: 'Sport',
      italian: 'sport', portuguese: 'esporte', spanish: 'deporte',
      japanese: 'スポーツ', korean: '스포츠', mandarin: '运动',
    },
  },
  {
    conceptKey: 'game',
    englishGloss: 'game',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_juego',
    words: {
      english: 'game', french: 'jeu', german: 'Spiel',
      italian: 'gioco', portuguese: 'jogo', spanish: 'juego',
      japanese: 'ゲーム', korean: '게임', mandarin: '游戏',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 5 — Novice Mid: Food & Dining
// ─────────────────────────────────────────────────────────────────────────────
const FOOD: ConceptEntry[] = [
  {
    conceptKey: 'to_eat',
    englishGloss: 'to eat',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_comer',
    words: {
      english: 'eat', french: 'manger', german: 'essen',
      italian: 'mangiare', portuguese: 'comer', spanish: 'comer',
      japanese: '食べる', korean: '먹다', mandarin: '吃',
    },
  },
  {
    conceptKey: 'to_drink',
    englishGloss: 'to drink',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_beber',
    words: {
      english: 'drink', french: 'boire', german: 'trinken',
      italian: 'bere', portuguese: 'beber', spanish: 'beber',
      japanese: '飲む', korean: '마시다', mandarin: '喝',
    },
  },
  {
    conceptKey: 'bread',
    englishGloss: 'bread',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pan',
    words: {
      english: 'bread', french: 'pain', german: 'Brot',
      italian: 'pane', portuguese: 'pão', spanish: 'pan',
      japanese: 'パン', korean: '빵', mandarin: '面包',
    },
  },
  {
    conceptKey: 'milk',
    englishGloss: 'milk',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_leche',
    words: {
      english: 'milk', french: 'lait', german: 'Milch',
      italian: 'latte', portuguese: 'leite', spanish: 'leche',
      japanese: 'ミルク', korean: '우유', mandarin: '牛奶',
    },
  },
  {
    conceptKey: 'water',
    englishGloss: 'water',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_agua',
    words: {
      english: 'water', french: 'eau', german: 'Wasser',
      italian: 'acqua', portuguese: 'água', spanish: 'agua',
      japanese: '水', korean: '물', mandarin: '水',
    },
  },
  {
    conceptKey: 'apple',
    englishGloss: 'apple',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_manzana',
    words: {
      english: 'apple', french: 'pomme', german: 'Apfel',
      italian: 'mela', portuguese: 'maçã', spanish: 'manzana',
      japanese: 'りんご', korean: '사과', mandarin: '苹果',
    },
  },
  {
    conceptKey: 'banana',
    englishGloss: 'banana',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_platano',
    words: {
      english: 'banana', french: 'banane', german: 'Banane',
      italian: 'banana', portuguese: 'banana', spanish: 'plátano',
      japanese: 'バナナ', korean: '바나나', mandarin: '香蕉',
    },
  },
  {
    conceptKey: 'egg',
    englishGloss: 'egg',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_huevo',
    words: {
      english: 'egg', french: 'œuf', german: 'Ei',
      italian: 'uovo', portuguese: 'ovo', spanish: 'huevo',
      japanese: 'たまご', korean: '달걀', mandarin: '鸡蛋',
    },
  },
  {
    conceptKey: 'rice',
    englishGloss: 'rice',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_arroz',
    words: {
      english: 'rice', french: 'riz', german: 'Reis',
      italian: 'riso', portuguese: 'arroz', spanish: 'arroz',
      japanese: 'ごはん', korean: '밥', mandarin: '米饭',
    },
  },
  {
    conceptKey: 'chicken',
    englishGloss: 'chicken (food)',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pollo',
    words: {
      english: 'chicken', french: 'poulet', german: 'Huhn',
      italian: 'pollo', portuguese: 'frango', spanish: 'pollo',
      japanese: 'とりにく', korean: '닭고기', mandarin: '鸡肉',
    },
  },
  {
    conceptKey: 'fish_food',
    englishGloss: 'fish (food)',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pescado',
    words: {
      english: 'fish', french: 'poisson', german: 'Fisch',
      italian: 'pesce', portuguese: 'peixe', spanish: 'pescado',
      japanese: 'さかな', korean: '생선', mandarin: '鱼',
    },
    notes: 'Use vocab_spanish_pescado (cooked fish) distinct from vocab_spanish_pez (live fish animal)',
  },
  {
    conceptKey: 'coffee',
    englishGloss: 'coffee',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_cafe',
    words: {
      english: 'coffee', french: 'café', german: 'Kaffee',
      italian: 'caffè', portuguese: 'café', spanish: 'café',
      japanese: 'コーヒー', korean: '커피', mandarin: '咖啡',
    },
  },
  {
    conceptKey: 'tea',
    englishGloss: 'tea',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_te',
    words: {
      english: 'tea', french: 'thé', german: 'Tee',
      italian: 'tè', portuguese: 'chá', spanish: 'té',
      japanese: 'おちゃ', korean: '차', mandarin: '茶',
    },
  },
  {
    conceptKey: 'restaurant',
    englishGloss: 'restaurant',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_restaurante',
    words: {
      english: 'restaurant', french: 'restaurant', german: 'Restaurant',
      italian: 'ristorante', portuguese: 'restaurante', spanish: 'restaurante',
      japanese: 'レストラン', korean: '식당', mandarin: '餐厅',
    },
  },
  {
    conceptKey: 'delicious',
    englishGloss: 'delicious',
    imageTier: 'scene_override',
    words: {
      english: 'delicious', french: 'délicieux', german: 'lecker',
      italian: 'delizioso', portuguese: 'delicioso', spanish: 'delicioso',
      japanese: 'おいしい', korean: '맛있다', mandarin: '好吃',
    },
  },
  {
    conceptKey: 'hungry',
    englishGloss: 'hungry',
    imageTier: 'scene_override',
    words: {
      english: 'hungry', french: 'faim', german: 'hungrig',
      italian: 'fame', portuguese: 'fome', spanish: 'hambre',
      japanese: 'おなかがすいた', korean: '배고프다', mandarin: '饿',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 6 — Novice Mid: Numbers & Time
// ─────────────────────────────────────────────────────────────────────────────
const NUMBERS_TIME: ConceptEntry[] = [
  {
    conceptKey: 'num_1', englishGloss: 'one', imageTier: 'svg',
    words: { english: 'one', french: 'un', german: 'eins', italian: 'uno', portuguese: 'um', spanish: 'uno', japanese: 'いち', korean: '일', mandarin: '一' },
  },
  {
    conceptKey: 'num_2', englishGloss: 'two', imageTier: 'svg',
    words: { english: 'two', french: 'deux', german: 'zwei', italian: 'due', portuguese: 'dois', spanish: 'dos', japanese: 'に', korean: '이', mandarin: '二' },
  },
  {
    conceptKey: 'num_3', englishGloss: 'three', imageTier: 'svg',
    words: { english: 'three', french: 'trois', german: 'drei', italian: 'tre', portuguese: 'três', spanish: 'tres', japanese: 'さん', korean: '삼', mandarin: '三' },
  },
  {
    conceptKey: 'num_4', englishGloss: 'four', imageTier: 'svg',
    words: { english: 'four', french: 'quatre', german: 'vier', italian: 'quattro', portuguese: 'quatro', spanish: 'cuatro', japanese: 'し', korean: '사', mandarin: '四' },
  },
  {
    conceptKey: 'num_5', englishGloss: 'five', imageTier: 'svg',
    words: { english: 'five', french: 'cinq', german: 'fünf', italian: 'cinque', portuguese: 'cinco', spanish: 'cinco', japanese: 'ご', korean: '오', mandarin: '五' },
  },
  {
    conceptKey: 'num_10', englishGloss: 'ten', imageTier: 'svg',
    words: { english: 'ten', french: 'dix', german: 'zehn', italian: 'dieci', portuguese: 'dez', spanish: 'diez', japanese: 'じゅう', korean: '십', mandarin: '十' },
  },
  {
    conceptKey: 'num_20', englishGloss: 'twenty', imageTier: 'svg',
    words: { english: 'twenty', french: 'vingt', german: 'zwanzig', italian: 'venti', portuguese: 'vinte', spanish: 'veinte', japanese: 'にじゅう', korean: '이십', mandarin: '二十' },
  },
  {
    conceptKey: 'monday',
    englishGloss: 'Monday',
    imageTier: 'scene_override',
    words: {
      english: 'Monday', french: 'lundi', german: 'Montag',
      italian: 'lunedì', portuguese: 'segunda-feira', spanish: 'lunes',
      japanese: '月曜日', korean: '월요일', mandarin: '星期一',
    },
  },
  {
    conceptKey: 'friday',
    englishGloss: 'Friday',
    imageTier: 'scene_override',
    words: {
      english: 'Friday', french: 'vendredi', german: 'Freitag',
      italian: 'venerdì', portuguese: 'sexta-feira', spanish: 'viernes',
      japanese: '金曜日', korean: '금요일', mandarin: '星期五',
    },
  },
  {
    conceptKey: 'weekend',
    englishGloss: 'weekend',
    imageTier: 'scene_override',
    words: {
      english: 'weekend', french: 'week-end', german: 'Wochenende',
      italian: 'fine settimana', portuguese: 'fim de semana', spanish: 'fin de semana',
      japanese: '週末', korean: '주말', mandarin: '周末',
    },
  },
  {
    conceptKey: 'today',
    englishGloss: 'today',
    imageTier: 'scene_override',
    words: {
      english: 'today', french: "aujourd'hui", german: 'heute',
      italian: 'oggi', portuguese: 'hoje', spanish: 'hoy',
      japanese: 'きょう', korean: '오늘', mandarin: '今天',
    },
  },
  {
    conceptKey: 'tomorrow',
    englishGloss: 'tomorrow',
    imageTier: 'scene_override',
    words: {
      english: 'tomorrow', french: 'demain', german: 'morgen',
      italian: 'domani', portuguese: 'amanhã', spanish: 'mañana',
      japanese: 'あした', korean: '내일', mandarin: '明天',
    },
    notes: 'mañana (tomorrow) vs mañana (morning) — context distinguishes',
  },
  {
    conceptKey: 'yesterday',
    englishGloss: 'yesterday',
    imageTier: 'scene_override',
    words: {
      english: 'yesterday', french: 'hier', german: 'gestern',
      italian: 'ieri', portuguese: 'ontem', spanish: 'ayer',
      japanese: 'きのう', korean: '어제', mandarin: '昨天',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 7 — Novice High: Daily Routines
// ─────────────────────────────────────────────────────────────────────────────
const DAILY_ROUTINES: ConceptEntry[] = [
  {
    conceptKey: 'to_wake_up',
    englishGloss: 'to wake up',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_despertarse',
    words: {
      english: 'wake up', french: 'se réveiller', german: 'aufwachen',
      italian: 'svegliarsi', portuguese: 'acordar', spanish: 'despertarse',
      japanese: '目覚める', korean: '일어나다', mandarin: '醒来',
    },
  },
  {
    conceptKey: 'to_get_up',
    englishGloss: 'to get up',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_levantarse',
    words: {
      english: 'get up', french: 'se lever', german: 'aufstehen',
      italian: 'alzarsi', portuguese: 'levantar-se', spanish: 'levantarse',
      japanese: '起きる', korean: '일어나다', mandarin: '起床',
    },
  },
  {
    conceptKey: 'to_shower',
    englishGloss: 'to shower',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_ducharse',
    words: {
      english: 'shower', french: 'se doucher', german: 'duschen',
      italian: 'fare la doccia', portuguese: 'tomar banho', spanish: 'ducharse',
      japanese: 'シャワーを浴びる', korean: '샤워하다', mandarin: '洗澡',
    },
  },
  {
    conceptKey: 'to_eat',
    englishGloss: 'to eat',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_comer',
    words: {
      english: 'eat', french: 'manger', german: 'essen',
      italian: 'mangiare', portuguese: 'comer', spanish: 'comer',
      japanese: '食べる', korean: '먹다', mandarin: '吃',
    },
  },
  {
    conceptKey: 'to_drink',
    englishGloss: 'to drink',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_beber',
    words: {
      english: 'drink', french: 'boire', german: 'trinken',
      italian: 'bere', portuguese: 'beber', spanish: 'beber',
      japanese: '飲む', korean: '마시다', mandarin: '喝',
    },
  },
  {
    conceptKey: 'to_work',
    englishGloss: 'to work',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_trabajar',
    words: {
      english: 'work', french: 'travailler', german: 'arbeiten',
      italian: 'lavorare', portuguese: 'trabalhar', spanish: 'trabajar',
      japanese: '働く', korean: '일하다', mandarin: '工作',
    },
  },
  {
    conceptKey: 'to_study',
    englishGloss: 'to study',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_estudiar',
    words: {
      english: 'study', french: 'étudier', german: 'studieren',
      italian: 'studiare', portuguese: 'estudar', spanish: 'estudiar',
      japanese: '勉強する', korean: '공부하다', mandarin: '学习',
    },
  },
  {
    conceptKey: 'to_go',
    englishGloss: 'to go',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_ir',
    words: {
      english: 'go', french: 'aller', german: 'gehen',
      italian: 'andare', portuguese: 'ir', spanish: 'ir',
      japanese: '行く', korean: '가다', mandarin: '去',
    },
  },
  {
    conceptKey: 'to_come',
    englishGloss: 'to come',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_venir',
    words: {
      english: 'come', french: 'venir', german: 'kommen',
      italian: 'venire', portuguese: 'vir', spanish: 'venir',
      japanese: '来る', korean: '오다', mandarin: '来',
    },
  },
  {
    conceptKey: 'to_sleep',
    englishGloss: 'to sleep',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_dormir',
    words: {
      english: 'sleep', french: 'dormir', german: 'schlafen',
      italian: 'dormire', portuguese: 'dormir', spanish: 'dormir',
      japanese: '寝る', korean: '자다', mandarin: '睡觉',
    },
  },
  {
    conceptKey: 'to_go_to_bed',
    englishGloss: 'to go to bed',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_acostarse',
    words: {
      english: 'go to bed', french: 'se coucher', german: 'schlafen gehen',
      italian: 'andare a letto', portuguese: 'deitar-se', spanish: 'acostarse',
      japanese: '寝る', korean: '잠자리에 들다', mandarin: '上床睡觉',
    },
  },
  {
    conceptKey: 'morning',
    englishGloss: 'morning',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_manana',
    words: {
      english: 'morning', french: 'matin', german: 'Morgen',
      italian: 'mattina', portuguese: 'manhã', spanish: 'mañana',
      japanese: '朝', korean: '아침', mandarin: '早上',
    },
  },
  {
    conceptKey: 'afternoon',
    englishGloss: 'afternoon',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_tarde',
    words: {
      english: 'afternoon', french: 'après-midi', german: 'Nachmittag',
      italian: 'pomeriggio', portuguese: 'tarde', spanish: 'tarde',
      japanese: '午後', korean: '오후', mandarin: '下午',
    },
  },
  {
    conceptKey: 'evening_night',
    englishGloss: 'evening / night',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_noche',
    words: {
      english: 'night', french: 'soir', german: 'Abend',
      italian: 'sera', portuguese: 'noite', spanish: 'noche',
      japanese: '夜', korean: '저녁', mandarin: '晚上',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 8 — Novice High: Shopping & Clothing
// ─────────────────────────────────────────────────────────────────────────────
const SHOPPING: ConceptEntry[] = [
  {
    conceptKey: 'shirt',
    englishGloss: 'shirt',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_camisa',
    words: {
      english: 'shirt', french: 'chemise', german: 'Hemd',
      italian: 'camicia', portuguese: 'camisa', spanish: 'camisa',
      japanese: 'シャツ', korean: '셔츠', mandarin: '衬衫',
    },
  },
  {
    conceptKey: 'pants',
    englishGloss: 'pants / trousers',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pantalon',
    words: {
      english: 'pants', french: 'pantalon', german: 'Hose',
      italian: 'pantaloni', portuguese: 'calça', spanish: 'pantalón',
      japanese: 'ズボン', korean: '바지', mandarin: '裤子',
    },
  },
  {
    conceptKey: 'skirt',
    englishGloss: 'skirt',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_falda',
    words: {
      english: 'skirt', french: 'jupe', german: 'Rock',
      italian: 'gonna', portuguese: 'saia', spanish: 'falda',
      japanese: 'スカート', korean: '치마', mandarin: '裙子',
    },
  },
  {
    conceptKey: 'shoe',
    englishGloss: 'shoe',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_zapato',
    words: {
      english: 'shoe', french: 'chaussure', german: 'Schuh',
      italian: 'scarpa', portuguese: 'sapato', spanish: 'zapato',
      japanese: 'くつ', korean: '신발', mandarin: '鞋子',
    },
  },
  {
    conceptKey: 'dress',
    englishGloss: 'dress',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_vestido',
    words: {
      english: 'dress', french: 'robe', german: 'Kleid',
      italian: 'vestito', portuguese: 'vestido', spanish: 'vestido',
      japanese: 'ドレス', korean: '원피스', mandarin: '连衣裙',
    },
  },
  {
    conceptKey: 'hat',
    englishGloss: 'hat',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_sombrero',
    words: {
      english: 'hat', french: 'chapeau', german: 'Hut',
      italian: 'cappello', portuguese: 'chapéu', spanish: 'sombrero',
      japanese: 'ぼうし', korean: '모자', mandarin: '帽子',
    },
  },
  {
    conceptKey: 'coat',
    englishGloss: 'coat',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_abrigo',
    words: {
      english: 'coat', french: 'manteau', german: 'Mantel',
      italian: 'cappotto', portuguese: 'casaco', spanish: 'abrigo',
      japanese: 'コート', korean: '코트', mandarin: '外套',
    },
  },
  {
    conceptKey: 'sock',
    englishGloss: 'sock',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_calcetin',
    words: {
      english: 'sock', french: 'chaussette', german: 'Socke',
      italian: 'calzino', portuguese: 'meia', spanish: 'calcetín',
      japanese: 'くつした', korean: '양말', mandarin: '袜子',
    },
  },
  {
    conceptKey: 'bag',
    englishGloss: 'bag',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_bolso',
    words: {
      english: 'bag', french: 'sac', german: 'Tasche',
      italian: 'borsa', portuguese: 'bolsa', spanish: 'bolso',
      japanese: 'バッグ', korean: '가방', mandarin: '包',
    },
  },
  {
    conceptKey: 'to_buy',
    englishGloss: 'to buy',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_comprar',
    words: {
      english: 'buy', french: 'acheter', german: 'kaufen',
      italian: 'comprare', portuguese: 'comprar', spanish: 'comprar',
      japanese: '買う', korean: '사다', mandarin: '买',
    },
  },
  {
    conceptKey: 'to_sell',
    englishGloss: 'to sell',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_vender',
    words: {
      english: 'sell', french: 'vendre', german: 'verkaufen',
      italian: 'vendere', portuguese: 'vender', spanish: 'vender',
      japanese: '売る', korean: '팔다', mandarin: '卖',
    },
  },
  {
    conceptKey: 'price',
    englishGloss: 'price',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_precio',
    words: {
      english: 'price', french: 'prix', german: 'Preis',
      italian: 'prezzo', portuguese: 'preço', spanish: 'precio',
      japanese: 'ねだん', korean: '가격', mandarin: '价格',
    },
  },
  {
    conceptKey: 'expensive',
    englishGloss: 'expensive',
    imageTier: 'scene_override',
    words: {
      english: 'expensive', french: 'cher', german: 'teuer',
      italian: 'caro', portuguese: 'caro', spanish: 'caro',
      japanese: '高い', korean: '비싸다', mandarin: '贵',
    },
  },
  {
    conceptKey: 'cheap',
    englishGloss: 'cheap',
    imageTier: 'scene_override',
    words: {
      english: 'cheap', french: 'bon marché', german: 'billig',
      italian: 'economico', portuguese: 'barato', spanish: 'barato',
      japanese: '安い', korean: '싸다', mandarin: '便宜',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 9 — Novice High: City & Community
// ─────────────────────────────────────────────────────────────────────────────
const CITY: ConceptEntry[] = [
  {
    conceptKey: 'hospital',
    englishGloss: 'hospital',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_hospital',
    words: {
      english: 'hospital', french: 'hôpital', german: 'Krankenhaus',
      italian: 'ospedale', portuguese: 'hospital', spanish: 'hospital',
      japanese: 'びょういん', korean: '병원', mandarin: '医院',
    },
  },
  {
    conceptKey: 'bank',
    englishGloss: 'bank',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_banco',
    words: {
      english: 'bank', french: 'banque', german: 'Bank',
      italian: 'banca', portuguese: 'banco', spanish: 'banco',
      japanese: 'ぎんこう', korean: '은행', mandarin: '银行',
    },
  },
  {
    conceptKey: 'supermarket',
    englishGloss: 'supermarket',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_supermercado',
    words: {
      english: 'supermarket', french: 'supermarché', german: 'Supermarkt',
      italian: 'supermercato', portuguese: 'supermercado', spanish: 'supermercado',
      japanese: 'スーパー', korean: '슈퍼마켓', mandarin: '超市',
    },
  },
  {
    conceptKey: 'park',
    englishGloss: 'park',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_parque',
    words: {
      english: 'park', french: 'parc', german: 'Park',
      italian: 'parco', portuguese: 'parque', spanish: 'parque',
      japanese: 'こうえん', korean: '공원', mandarin: '公园',
    },
  },
  {
    conceptKey: 'library',
    englishGloss: 'library',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_biblioteca',
    words: {
      english: 'library', french: 'bibliothèque', german: 'Bibliothek',
      italian: 'biblioteca', portuguese: 'biblioteca', spanish: 'biblioteca',
      japanese: 'としょかん', korean: '도서관', mandarin: '图书馆',
    },
  },
  {
    conceptKey: 'pharmacy',
    englishGloss: 'pharmacy',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_farmacia',
    words: {
      english: 'pharmacy', french: 'pharmacie', german: 'Apotheke',
      italian: 'farmacia', portuguese: 'farmácia', spanish: 'farmacia',
      japanese: 'やっきょく', korean: '약국', mandarin: '药店',
    },
  },
  {
    conceptKey: 'street',
    englishGloss: 'street',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_calle',
    words: {
      english: 'street', french: 'rue', german: 'Straße',
      italian: 'via', portuguese: 'rua', spanish: 'calle',
      japanese: 'みち', korean: '길', mandarin: '街道',
    },
  },
  {
    conceptKey: 'house',
    englishGloss: 'house',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_casa',
    words: {
      english: 'house', french: 'maison', german: 'Haus',
      italian: 'casa', portuguese: 'casa', spanish: 'casa',
      japanese: 'いえ', korean: '집', mandarin: '房子',
    },
  },
  {
    conceptKey: 'city',
    englishGloss: 'city',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_ciudad',
    words: {
      english: 'city', french: 'ville', german: 'Stadt',
      italian: 'città', portuguese: 'cidade', spanish: 'ciudad',
      japanese: 'まち', korean: '도시', mandarin: '城市',
    },
  },
  {
    conceptKey: 'to_go',
    englishGloss: 'to go',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_ir',
    words: {
      english: 'go', french: 'aller', german: 'gehen',
      italian: 'andare', portuguese: 'ir', spanish: 'ir',
      japanese: '行く', korean: '가다', mandarin: '去',
    },
  },
  {
    conceptKey: 'where_is',
    englishGloss: 'where is?',
    imageTier: 'scene_override',
    words: {
      english: 'where is', french: 'où est', german: 'wo ist',
      italian: 'dove è', portuguese: 'onde está', spanish: '¿dónde está?',
      japanese: 'どこですか', korean: '어디 있어요', mandarin: '在哪里',
    },
  },
  {
    conceptKey: 'near_far',
    englishGloss: 'near / far',
    imageTier: 'scene_override',
    words: {
      english: 'near', french: 'près', german: 'nah',
      italian: 'vicino', portuguese: 'perto', spanish: 'cerca',
      japanese: 'ちかい', korean: '가깝다', mandarin: '近',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 10 — Novice High: Travel & Transportation
// ─────────────────────────────────────────────────────────────────────────────
const TRAVEL_TRANSPORT: ConceptEntry[] = [
  {
    conceptKey: 'airplane',
    englishGloss: 'airplane',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_avion',
    words: {
      english: 'airplane', french: 'avion', german: 'Flugzeug',
      italian: 'aereo', portuguese: 'avião', spanish: 'avión',
      japanese: 'ひこうき', korean: '비행기', mandarin: '飞机',
    },
  },
  {
    conceptKey: 'train',
    englishGloss: 'train',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_tren',
    words: {
      english: 'train', french: 'train', german: 'Zug',
      italian: 'treno', portuguese: 'trem', spanish: 'tren',
      japanese: 'でんしゃ', korean: '기차', mandarin: '火车',
    },
  },
  {
    conceptKey: 'bus',
    englishGloss: 'bus',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_autobus',
    words: {
      english: 'bus', french: 'bus', german: 'Bus',
      italian: 'autobus', portuguese: 'ônibus', spanish: 'autobús',
      japanese: 'バス', korean: '버스', mandarin: '公共汽车',
    },
  },
  {
    conceptKey: 'car',
    englishGloss: 'car',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_coche',
    words: {
      english: 'car', french: 'voiture', german: 'Auto',
      italian: 'macchina', portuguese: 'carro', spanish: 'coche',
      japanese: 'くるま', korean: '자동차', mandarin: '汽车',
    },
  },
  {
    conceptKey: 'bicycle',
    englishGloss: 'bicycle',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_bicicleta',
    words: {
      english: 'bicycle', french: 'vélo', german: 'Fahrrad',
      italian: 'bicicletta', portuguese: 'bicicleta', spanish: 'bicicleta',
      japanese: 'じてんしゃ', korean: '자전거', mandarin: '自行车',
    },
  },
  {
    conceptKey: 'boat',
    englishGloss: 'boat',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_barco',
    words: {
      english: 'boat', french: 'bateau', german: 'Boot',
      italian: 'barca', portuguese: 'barco', spanish: 'barco',
      japanese: 'ふね', korean: '배', mandarin: '船',
    },
  },
  {
    conceptKey: 'airport',
    englishGloss: 'airport',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_aeropuerto',
    words: {
      english: 'airport', french: 'aéroport', german: 'Flughafen',
      italian: 'aeroporto', portuguese: 'aeroporto', spanish: 'aeropuerto',
      japanese: 'くうこう', korean: '공항', mandarin: '机场',
    },
  },
  {
    conceptKey: 'station',
    englishGloss: 'station',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_estacion',
    words: {
      english: 'station', french: 'gare', german: 'Bahnhof',
      italian: 'stazione', portuguese: 'estação', spanish: 'estación',
      japanese: 'えき', korean: '역', mandarin: '车站',
    },
  },
  {
    conceptKey: 'ticket',
    englishGloss: 'ticket',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_billete',
    words: {
      english: 'ticket', french: 'billet', german: 'Fahrkarte',
      italian: 'biglietto', portuguese: 'bilhete', spanish: 'billete',
      japanese: 'きっぷ', korean: '표', mandarin: '票',
    },
  },
  {
    conceptKey: 'suitcase',
    englishGloss: 'suitcase',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_maleta',
    words: {
      english: 'suitcase', french: 'valise', german: 'Koffer',
      italian: 'valigia', portuguese: 'mala', spanish: 'maleta',
      japanese: 'スーツケース', korean: '여행 가방', mandarin: '行李箱',
    },
  },
  {
    conceptKey: 'passport',
    englishGloss: 'passport',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pasaporte',
    words: {
      english: 'passport', french: 'passeport', german: 'Reisepass',
      italian: 'passaporto', portuguese: 'passaporte', spanish: 'pasaporte',
      japanese: 'パスポート', korean: '여권', mandarin: '护照',
    },
  },
  {
    conceptKey: 'hotel',
    englishGloss: 'hotel',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_hotel',
    words: {
      english: 'hotel', french: 'hôtel', german: 'Hotel',
      italian: 'albergo', portuguese: 'hotel', spanish: 'hotel',
      japanese: 'ホテル', korean: '호텔', mandarin: '酒店',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 11 — Intermediate Low: Identity & Personality
// ─────────────────────────────────────────────────────────────────────────────
const IDENTITY: ConceptEntry[] = [
  {
    conceptKey: 'tall',
    englishGloss: 'tall',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_alto',
    words: {
      english: 'tall', french: 'grand', german: 'groß',
      italian: 'alto', portuguese: 'alto', spanish: 'alto',
      japanese: 'たかい', korean: '키가 크다', mandarin: '高',
    },
  },
  {
    conceptKey: 'short',
    englishGloss: 'short (height)',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_bajo',
    words: {
      english: 'short', french: 'petit', german: 'klein',
      italian: 'basso', portuguese: 'baixo', spanish: 'bajo',
      japanese: 'ひくい', korean: '키가 작다', mandarin: '矮',
    },
  },
  {
    conceptKey: 'young',
    englishGloss: 'young',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_joven',
    words: {
      english: 'young', french: 'jeune', german: 'jung',
      italian: 'giovane', portuguese: 'jovem', spanish: 'joven',
      japanese: 'わかい', korean: '젊다', mandarin: '年轻',
    },
  },
  {
    conceptKey: 'old',
    englishGloss: 'old',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_viejo',
    words: {
      english: 'old', french: 'vieux', german: 'alt',
      italian: 'vecchio', portuguese: 'velho', spanish: 'viejo',
      japanese: 'としをとった', korean: '나이 든', mandarin: '老',
    },
  },
  {
    conceptKey: 'intelligent',
    englishGloss: 'intelligent',
    imageTier: 'scene_override',
    words: {
      english: 'intelligent', french: 'intelligent', german: 'intelligent',
      italian: 'intelligente', portuguese: 'inteligente', spanish: 'inteligente',
      japanese: 'かしこい', korean: '똑똑하다', mandarin: '聪明',
    },
  },
  {
    conceptKey: 'friendly',
    englishGloss: 'friendly',
    imageTier: 'scene_override',
    words: {
      english: 'friendly', french: 'sympathique', german: 'freundlich',
      italian: 'simpatico', portuguese: 'simpático', spanish: 'simpático',
      japanese: 'やさしい', korean: '친절하다', mandarin: '友好',
    },
  },
  {
    conceptKey: 'funny',
    englishGloss: 'funny',
    imageTier: 'scene_override',
    words: {
      english: 'funny', french: 'drôle', german: 'witzig',
      italian: 'divertente', portuguese: 'engraçado', spanish: 'gracioso',
      japanese: 'おもしろい', korean: '웃기다', mandarin: '有趣',
    },
  },
  {
    conceptKey: 'serious',
    englishGloss: 'serious',
    imageTier: 'scene_override',
    words: {
      english: 'serious', french: 'sérieux', german: 'ernsthaft',
      italian: 'serio', portuguese: 'sério', spanish: 'serio',
      japanese: 'まじめな', korean: '진지하다', mandarin: '严肃',
    },
  },
  {
    conceptKey: 'nationality',
    englishGloss: 'nationality',
    imageTier: 'none',
    words: {
      english: 'nationality', french: 'nationalité', german: 'Nationalität',
      italian: 'nazionalità', portuguese: 'nacionalidade', spanish: 'nacionalidad',
      japanese: 'こくせき', korean: '국적', mandarin: '国籍',
    },
  },
  {
    conceptKey: 'age',
    englishGloss: 'age',
    imageTier: 'scene_override',
    words: {
      english: 'age', french: 'âge', german: 'Alter',
      italian: 'età', portuguese: 'idade', spanish: 'edad',
      japanese: 'ねんれい', korean: '나이', mandarin: '年龄',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 12 — Intermediate Low: Health & Wellness
// ─────────────────────────────────────────────────────────────────────────────
const HEALTH: ConceptEntry[] = [
  {
    conceptKey: 'head',
    englishGloss: 'head',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_cabeza',
    words: {
      english: 'head', french: 'tête', german: 'Kopf',
      italian: 'testa', portuguese: 'cabeça', spanish: 'cabeza',
      japanese: 'あたま', korean: '머리', mandarin: '头',
    },
  },
  {
    conceptKey: 'hand',
    englishGloss: 'hand',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mano',
    words: {
      english: 'hand', french: 'main', german: 'Hand',
      italian: 'mano', portuguese: 'mão', spanish: 'mano',
      japanese: 'て', korean: '손', mandarin: '手',
    },
  },
  {
    conceptKey: 'foot',
    englishGloss: 'foot',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pie',
    words: {
      english: 'foot', french: 'pied', german: 'Fuß',
      italian: 'piede', portuguese: 'pé', spanish: 'pie',
      japanese: 'あし', korean: '발', mandarin: '脚',
    },
  },
  {
    conceptKey: 'arm',
    englishGloss: 'arm',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_brazo',
    words: {
      english: 'arm', french: 'bras', german: 'Arm',
      italian: 'braccio', portuguese: 'braço', spanish: 'brazo',
      japanese: 'うで', korean: '팔', mandarin: '胳膊',
    },
  },
  {
    conceptKey: 'leg',
    englishGloss: 'leg',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_pierna',
    words: {
      english: 'leg', french: 'jambe', german: 'Bein',
      italian: 'gamba', portuguese: 'perna', spanish: 'pierna',
      japanese: 'あし', korean: '다리', mandarin: '腿',
    },
  },
  {
    conceptKey: 'sick',
    englishGloss: 'sick',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_enfermo',
    words: {
      english: 'sick', french: 'malade', german: 'krank',
      italian: 'malato', portuguese: 'doente', spanish: 'enfermo',
      japanese: 'びょうき', korean: '아프다', mandarin: '生病',
    },
  },
  {
    conceptKey: 'healthy',
    englishGloss: 'healthy',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_sano',
    words: {
      english: 'healthy', french: 'en bonne santé', german: 'gesund',
      italian: 'sano', portuguese: 'saudável', spanish: 'sano',
      japanese: 'けんこう', korean: '건강하다', mandarin: '健康',
    },
  },
  {
    conceptKey: 'headache',
    englishGloss: 'headache',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_dolor_de_cabeza',
    words: {
      english: 'headache', french: 'mal de tête', german: 'Kopfschmerzen',
      italian: 'mal di testa', portuguese: 'dor de cabeça', spanish: 'dolor de cabeza',
      japanese: 'ずつう', korean: '두통', mandarin: '头痛',
    },
  },
  {
    conceptKey: 'fever',
    englishGloss: 'fever',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_fiebre',
    words: {
      english: 'fever', french: 'fièvre', german: 'Fieber',
      italian: 'febbre', portuguese: 'febre', spanish: 'fiebre',
      japanese: 'ねつ', korean: '열', mandarin: '发烧',
    },
  },
  {
    conceptKey: 'doctor',
    englishGloss: 'doctor',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_medico',
    words: {
      english: 'doctor', french: 'médecin', german: 'Arzt',
      italian: 'medico', portuguese: 'médico', spanish: 'médico',
      japanese: 'いしゃ', korean: '의사', mandarin: '医生',
    },
  },
  {
    conceptKey: 'medicine',
    englishGloss: 'medicine',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_medicina',
    words: {
      english: 'medicine', french: 'médicament', german: 'Medizin',
      italian: 'medicina', portuguese: 'remédio', spanish: 'medicina',
      japanese: 'くすり', korean: '약', mandarin: '药',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 13 — Intermediate Low: Technology & Media
// ─────────────────────────────────────────────────────────────────────────────
const TECHNOLOGY: ConceptEntry[] = [
  {
    conceptKey: 'phone',
    englishGloss: 'phone',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_telefono',
    words: {
      english: 'phone', french: 'téléphone', german: 'Telefon',
      italian: 'telefono', portuguese: 'telefone', spanish: 'teléfono',
      japanese: 'でんわ', korean: '전화', mandarin: '电话',
    },
  },
  {
    conceptKey: 'computer',
    englishGloss: 'computer',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_computadora',
    words: {
      english: 'computer', french: 'ordinateur', german: 'Computer',
      italian: 'computer', portuguese: 'computador', spanish: 'computadora',
      japanese: 'パソコン', korean: '컴퓨터', mandarin: '电脑',
    },
  },
  {
    conceptKey: 'internet',
    englishGloss: 'internet',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_internet',
    words: {
      english: 'internet', french: 'internet', german: 'Internet',
      italian: 'internet', portuguese: 'internet', spanish: 'internet',
      japanese: 'インターネット', korean: '인터넷', mandarin: '网络',
    },
  },
  {
    conceptKey: 'message',
    englishGloss: 'message',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mensaje',
    words: {
      english: 'message', french: 'message', german: 'Nachricht',
      italian: 'messaggio', portuguese: 'mensagem', spanish: 'mensaje',
      japanese: 'メッセージ', korean: '메시지', mandarin: '消息',
    },
  },
  {
    conceptKey: 'to_send',
    englishGloss: 'to send',
    imageTier: 'scene_override',
    words: {
      english: 'send', french: 'envoyer', german: 'schicken',
      italian: 'inviare', portuguese: 'enviar', spanish: 'enviar',
      japanese: '送る', korean: '보내다', mandarin: '发送',
    },
  },
  {
    conceptKey: 'to_search',
    englishGloss: 'to search',
    imageTier: 'scene_override',
    words: {
      english: 'search', french: 'chercher', german: 'suchen',
      italian: 'cercare', portuguese: 'procurar', spanish: 'buscar',
      japanese: '探す', korean: '검색하다', mandarin: '搜索',
    },
  },
  {
    conceptKey: 'social_media',
    englishGloss: 'social media',
    imageTier: 'none',
    words: {
      english: 'social media', french: 'réseaux sociaux', german: 'soziale Medien',
      italian: 'social media', portuguese: 'redes sociais', spanish: 'redes sociales',
      japanese: 'SNS', korean: '소셜미디어', mandarin: '社交媒体',
    },
  },
  {
    conceptKey: 'video',
    englishGloss: 'video',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_video',
    words: {
      english: 'video', french: 'vidéo', german: 'Video',
      italian: 'video', portuguese: 'vídeo', spanish: 'vídeo',
      japanese: 'ビデオ', korean: '영상', mandarin: '视频',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 14 — Intermediate Low: Environment & Nature
// ─────────────────────────────────────────────────────────────────────────────
const ENVIRONMENT: ConceptEntry[] = [
  {
    conceptKey: 'tree',
    englishGloss: 'tree',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_arbol',
    words: {
      english: 'tree', french: 'arbre', german: 'Baum',
      italian: 'albero', portuguese: 'árvore', spanish: 'árbol',
      japanese: 'き', korean: '나무', mandarin: '树',
    },
  },
  {
    conceptKey: 'flower',
    englishGloss: 'flower',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_flor',
    words: {
      english: 'flower', french: 'fleur', german: 'Blume',
      italian: 'fiore', portuguese: 'flor', spanish: 'flor',
      japanese: 'はな', korean: '꽃', mandarin: '花',
    },
  },
  {
    conceptKey: 'sun',
    englishGloss: 'sun',
    imageTier: 'shared',
    sharedConceptKey: 'concept_weather_sun',
    words: {
      english: 'sun', french: 'soleil', german: 'Sonne',
      italian: 'sole', portuguese: 'sol', spanish: 'sol',
      japanese: 'たいよう', korean: '태양', mandarin: '太阳',
    },
  },
  {
    conceptKey: 'rain',
    englishGloss: 'rain',
    imageTier: 'shared',
    sharedConceptKey: 'concept_weather_rain',
    words: {
      english: 'rain', french: 'pluie', german: 'Regen',
      italian: 'pioggia', portuguese: 'chuva', spanish: 'lluvia',
      japanese: 'あめ', korean: '비', mandarin: '雨',
    },
  },
  {
    conceptKey: 'snow',
    englishGloss: 'snow',
    imageTier: 'shared',
    sharedConceptKey: 'concept_weather_snow',
    words: {
      english: 'snow', french: 'neige', german: 'Schnee',
      italian: 'neve', portuguese: 'neve', spanish: 'nieve',
      japanese: 'ゆき', korean: '눈', mandarin: '雪',
    },
  },
  {
    conceptKey: 'sea',
    englishGloss: 'sea / ocean',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mar',
    words: {
      english: 'sea', french: 'mer', german: 'Meer',
      italian: 'mare', portuguese: 'mar', spanish: 'mar',
      japanese: 'うみ', korean: '바다', mandarin: '大海',
    },
  },
  {
    conceptKey: 'mountain',
    englishGloss: 'mountain',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_montana',
    words: {
      english: 'mountain', french: 'montagne', german: 'Berg',
      italian: 'montagna', portuguese: 'montanha', spanish: 'montaña',
      japanese: 'やま', korean: '산', mandarin: '山',
    },
  },
  {
    conceptKey: 'environment',
    englishGloss: 'environment',
    imageTier: 'none',
    words: {
      english: 'environment', french: 'environnement', german: 'Umwelt',
      italian: 'ambiente', portuguese: 'meio ambiente', spanish: 'medio ambiente',
      japanese: 'かんきょう', korean: '환경', mandarin: '环境',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 15 — Intermediate Low: Past Tense & Narration
// (Grammar-heavy; most concepts have no static image)
// ─────────────────────────────────────────────────────────────────────────────
const PAST_TENSE: ConceptEntry[] = [
  {
    conceptKey: 'yesterday', englishGloss: 'yesterday', imageTier: 'scene_override',
    words: { english: 'yesterday', french: 'hier', german: 'gestern', italian: 'ieri', portuguese: 'ontem', spanish: 'ayer', japanese: 'きのう', korean: '어제', mandarin: '昨天' },
  },
  {
    conceptKey: 'last_week', englishGloss: 'last week', imageTier: 'scene_override',
    words: { english: 'last week', french: 'la semaine dernière', german: 'letzte Woche', italian: 'la settimana scorsa', portuguese: 'semana passada', spanish: 'la semana pasada', japanese: 'せんしゅう', korean: '지난주', mandarin: '上周' },
  },
  {
    conceptKey: 'before', englishGloss: 'before', imageTier: 'none',
    words: { english: 'before', french: 'avant', german: 'vorher', italian: 'prima', portuguese: 'antes', spanish: 'antes', japanese: 'まえに', korean: '전에', mandarin: '之前' },
  },
  {
    conceptKey: 'after', englishGloss: 'after', imageTier: 'none',
    words: { english: 'after', french: 'après', german: 'nachher', italian: 'dopo', portuguese: 'depois', spanish: 'después', japanese: 'あとで', korean: '후에', mandarin: '之后' },
  },
  {
    conceptKey: 'then', englishGloss: 'then', imageTier: 'none',
    words: { english: 'then', french: 'puis', german: 'dann', italian: 'poi', portuguese: 'então', spanish: 'entonces', japanese: 'それから', korean: '그리고 나서', mandarin: '然后' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 16 — Intermediate Mid: Global Challenges
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_CHALLENGES: ConceptEntry[] = [
  {
    conceptKey: 'problem', englishGloss: 'problem', imageTier: 'none',
    words: { english: 'problem', french: 'problème', german: 'Problem', italian: 'problema', portuguese: 'problema', spanish: 'problema', japanese: 'もんだい', korean: '문제', mandarin: '问题' },
  },
  {
    conceptKey: 'solution', englishGloss: 'solution', imageTier: 'none',
    words: { english: 'solution', french: 'solution', german: 'Lösung', italian: 'soluzione', portuguese: 'solução', spanish: 'solución', japanese: 'かいけつ', korean: '해결', mandarin: '解决方案' },
  },
  {
    conceptKey: 'climate', englishGloss: 'climate', imageTier: 'none',
    words: { english: 'climate', french: 'climat', german: 'Klima', italian: 'clima', portuguese: 'clima', spanish: 'clima', japanese: 'きこう', korean: '기후', mandarin: '气候' },
  },
  {
    conceptKey: 'poverty', englishGloss: 'poverty', imageTier: 'none',
    words: { english: 'poverty', french: 'pauvreté', german: 'Armut', italian: 'povertà', portuguese: 'pobreza', spanish: 'pobreza', japanese: 'ひんこん', korean: '빈곤', mandarin: '贫困' },
  },
  {
    conceptKey: 'equality', englishGloss: 'equality', imageTier: 'none',
    words: { english: 'equality', french: 'égalité', german: 'Gleichheit', italian: 'uguaglianza', portuguese: 'igualdade', spanish: 'igualdad', japanese: 'びょうどう', korean: '평등', mandarin: '平等' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 17 — Intermediate Mid: Arts & Literature
// ─────────────────────────────────────────────────────────────────────────────
const ARTS: ConceptEntry[] = [
  {
    conceptKey: 'painting',
    englishGloss: 'painting',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_cuadro',
    words: {
      english: 'painting', french: 'tableau', german: 'Gemälde',
      italian: 'dipinto', portuguese: 'quadro', spanish: 'cuadro',
      japanese: 'えがき', korean: '그림', mandarin: '油画',
    },
  },
  {
    conceptKey: 'sculpture',
    englishGloss: 'sculpture',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_escultura',
    words: {
      english: 'sculpture', french: 'sculpture', german: 'Skulptur',
      italian: 'scultura', portuguese: 'escultura', spanish: 'escultura',
      japanese: 'ちょうこく', korean: '조각', mandarin: '雕塑',
    },
  },
  {
    conceptKey: 'novel',
    englishGloss: 'novel',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_novela',
    words: {
      english: 'novel', french: 'roman', german: 'Roman',
      italian: 'romanzo', portuguese: 'romance', spanish: 'novela',
      japanese: 'しょうせつ', korean: '소설', mandarin: '小说',
    },
  },
  {
    conceptKey: 'poem',
    englishGloss: 'poem',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_poema',
    words: {
      english: 'poem', french: 'poème', german: 'Gedicht',
      italian: 'poesia', portuguese: 'poema', spanish: 'poema',
      japanese: 'し', korean: '시', mandarin: '诗',
    },
  },
  {
    conceptKey: 'theater',
    englishGloss: 'theater',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_teatro',
    words: {
      english: 'theater', french: 'théâtre', german: 'Theater',
      italian: 'teatro', portuguese: 'teatro', spanish: 'teatro',
      japanese: 'げきじょう', korean: '극장', mandarin: '剧院',
    },
  },
  {
    conceptKey: 'museum',
    englishGloss: 'museum',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_museo',
    words: {
      english: 'museum', french: 'musée', german: 'Museum',
      italian: 'museo', portuguese: 'museu', spanish: 'museo',
      japanese: 'はくぶつかん', korean: '박물관', mandarin: '博物馆',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 18 — Intermediate Mid: History & Culture
// ─────────────────────────────────────────────────────────────────────────────
const HISTORY: ConceptEntry[] = [
  {
    conceptKey: 'history', englishGloss: 'history', imageTier: 'none',
    words: { english: 'history', french: 'histoire', german: 'Geschichte', italian: 'storia', portuguese: 'história', spanish: 'historia', japanese: 'れきし', korean: '역사', mandarin: '历史' },
  },
  {
    conceptKey: 'war', englishGloss: 'war', imageTier: 'none',
    words: { english: 'war', french: 'guerre', german: 'Krieg', italian: 'guerra', portuguese: 'guerra', spanish: 'guerra', japanese: 'せんそう', korean: '전쟁', mandarin: '战争' },
  },
  {
    conceptKey: 'peace', englishGloss: 'peace', imageTier: 'scene_override',
    words: { english: 'peace', french: 'paix', german: 'Frieden', italian: 'pace', portuguese: 'paz', spanish: 'paz', japanese: 'へいわ', korean: '평화', mandarin: '和平' },
  },
  {
    conceptKey: 'tradition', englishGloss: 'tradition', imageTier: 'none',
    words: { english: 'tradition', french: 'tradition', german: 'Tradition', italian: 'tradizione', portuguese: 'tradição', spanish: 'tradición', japanese: 'でんとう', korean: '전통', mandarin: '传统' },
  },
  {
    conceptKey: 'culture', englishGloss: 'culture', imageTier: 'none',
    words: { english: 'culture', french: 'culture', german: 'Kultur', italian: 'cultura', portuguese: 'cultura', spanish: 'cultura', japanese: 'ぶんか', korean: '문화', mandarin: '文化' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 19 — Intermediate Mid: Future Plans
// ─────────────────────────────────────────────────────────────────────────────
const FUTURE_PLANS: ConceptEntry[] = [
  {
    conceptKey: 'to_want',
    englishGloss: 'to want',
    imageTier: 'scene_override',
    words: {
      english: 'want', french: 'vouloir', german: 'wollen',
      italian: 'volere', portuguese: 'querer', spanish: 'querer',
      japanese: '～たい', korean: '원하다', mandarin: '想要',
    },
  },
  {
    conceptKey: 'to_need',
    englishGloss: 'to need',
    imageTier: 'scene_override',
    words: {
      english: 'need', french: 'avoir besoin', german: 'brauchen',
      italian: 'avere bisogno', portuguese: 'precisar', spanish: 'necesitar',
      japanese: '～が必要', korean: '필요하다', mandarin: '需要',
    },
  },
  {
    conceptKey: 'to_plan',
    englishGloss: 'to plan',
    imageTier: 'scene_override',
    words: {
      english: 'plan', french: 'planifier', german: 'planen',
      italian: 'pianificare', portuguese: 'planejar', spanish: 'planear',
      japanese: 'けいかくする', korean: '계획하다', mandarin: '计划',
    },
  },
  {
    conceptKey: 'to_hope',
    englishGloss: 'to hope',
    imageTier: 'scene_override',
    words: {
      english: 'hope', french: 'espérer', german: 'hoffen',
      italian: 'sperare', portuguese: 'esperar', spanish: 'esperar',
      japanese: 'きたいする', korean: '희망하다', mandarin: '希望',
    },
  },
  {
    conceptKey: 'future',
    englishGloss: 'future',
    imageTier: 'none',
    words: {
      english: 'future', french: 'avenir', german: 'Zukunft',
      italian: 'futuro', portuguese: 'futuro', spanish: 'futuro',
      japanese: 'みらい', korean: '미래', mandarin: '未来',
    },
  },
  {
    conceptKey: 'dream',
    englishGloss: 'dream',
    imageTier: 'scene_override',
    words: {
      english: 'dream', french: 'rêve', german: 'Traum',
      italian: 'sogno', portuguese: 'sonho', spanish: 'sueño',
      japanese: 'ゆめ', korean: '꿈', mandarin: '梦想',
    },
  },
  {
    conceptKey: 'career',
    englishGloss: 'career',
    imageTier: 'none',
    words: {
      english: 'career', french: 'carrière', german: 'Karriere',
      italian: 'carriera', portuguese: 'carreira', spanish: 'carrera',
      japanese: 'しごと', korean: '직업', mandarin: '职业',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 20 — Intermediate Mid: Extended Travel & Transport
// ─────────────────────────────────────────────────────────────────────────────
const TRAVEL_EXTENDED: ConceptEntry[] = [
  {
    conceptKey: 'map',
    englishGloss: 'map',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_mapa',
    words: {
      english: 'map', french: 'carte', german: 'Karte',
      italian: 'mappa', portuguese: 'mapa', spanish: 'mapa',
      japanese: 'ちず', korean: '지도', mandarin: '地图',
    },
  },
  {
    conceptKey: 'reservation',
    englishGloss: 'reservation',
    imageTier: 'scene_override',
    words: {
      english: 'reservation', french: 'réservation', german: 'Reservierung',
      italian: 'prenotazione', portuguese: 'reserva', spanish: 'reservación',
      japanese: 'よやく', korean: '예약', mandarin: '预订',
    },
  },
  {
    conceptKey: 'border',
    englishGloss: 'border',
    imageTier: 'none',
    words: {
      english: 'border', french: 'frontière', german: 'Grenze',
      italian: 'confine', portuguese: 'fronteira', spanish: 'frontera',
      japanese: 'さかい', korean: '국경', mandarin: '边境',
    },
  },
  {
    conceptKey: 'culture_shock',
    englishGloss: 'culture shock',
    imageTier: 'none',
    words: {
      english: 'culture shock', french: 'choc culturel', german: 'Kulturschock',
      italian: 'shock culturale', portuguese: 'choque cultural', spanish: 'choque cultural',
      japanese: 'カルチャーショック', korean: '문화 충격', mandarin: '文化冲击',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 21 — Intermediate High: Science & Innovation
// ─────────────────────────────────────────────────────────────────────────────
const SCIENCE: ConceptEntry[] = [
  {
    conceptKey: 'experiment',
    englishGloss: 'experiment',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_experimento',
    words: {
      english: 'experiment', french: 'expérience', german: 'Experiment',
      italian: 'esperimento', portuguese: 'experimento', spanish: 'experimento',
      japanese: 'じっけん', korean: '실험', mandarin: '实验',
    },
  },
  {
    conceptKey: 'technology',
    englishGloss: 'technology',
    imageTier: 'none',
    words: {
      english: 'technology', french: 'technologie', german: 'Technologie',
      italian: 'tecnologia', portuguese: 'tecnologia', spanish: 'tecnología',
      japanese: 'テクノロジー', korean: '기술', mandarin: '技术',
    },
  },
  {
    conceptKey: 'robot',
    englishGloss: 'robot',
    imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_robot',
    words: {
      english: 'robot', french: 'robot', german: 'Roboter',
      italian: 'robot', portuguese: 'robô', spanish: 'robot',
      japanese: 'ロボット', korean: '로봇', mandarin: '机器人',
    },
  },
  {
    conceptKey: 'discovery',
    englishGloss: 'discovery',
    imageTier: 'none',
    words: {
      english: 'discovery', french: 'découverte', german: 'Entdeckung',
      italian: 'scoperta', portuguese: 'descoberta', spanish: 'descubrimiento',
      japanese: 'はっけん', korean: '발견', mandarin: '发现',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 22 — Intermediate High: Cultural Perspectives
// ─────────────────────────────────────────────────────────────────────────────
const CULTURAL_PERSPECTIVES: ConceptEntry[] = [
  {
    conceptKey: 'perspective', englishGloss: 'perspective', imageTier: 'none',
    words: { english: 'perspective', french: 'perspective', german: 'Perspektive', italian: 'prospettiva', portuguese: 'perspectiva', spanish: 'perspectiva', japanese: 'かんてん', korean: '관점', mandarin: '视角' },
  },
  {
    conceptKey: 'stereotype', englishGloss: 'stereotype', imageTier: 'none',
    words: { english: 'stereotype', french: 'stéréotype', german: 'Stereotyp', italian: 'stereotipo', portuguese: 'estereótipo', spanish: 'estereotipo', japanese: 'ステレオタイプ', korean: '고정관념', mandarin: '刻板印象' },
  },
  {
    conceptKey: 'diversity', englishGloss: 'diversity', imageTier: 'none',
    words: { english: 'diversity', french: 'diversité', german: 'Vielfalt', italian: 'diversità', portuguese: 'diversidade', spanish: 'diversidad', japanese: 'たようせい', korean: '다양성', mandarin: '多样性' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 23 — Intermediate High: AP / Exam Prep
// ─────────────────────────────────────────────────────────────────────────────
const EXAM_PREP: ConceptEntry[] = [
  {
    conceptKey: 'argument', englishGloss: 'argument', imageTier: 'none',
    words: { english: 'argument', french: 'argument', german: 'Argument', italian: 'argomento', portuguese: 'argumento', spanish: 'argumento', japanese: 'ろんきょ', korean: '주장', mandarin: '论点' },
  },
  {
    conceptKey: 'evidence', englishGloss: 'evidence', imageTier: 'none',
    words: { english: 'evidence', french: 'preuve', german: 'Beweis', italian: 'prova', portuguese: 'evidência', spanish: 'evidencia', japanese: 'しょうこ', korean: '증거', mandarin: '证据' },
  },
  {
    conceptKey: 'compare', englishGloss: 'to compare', imageTier: 'none',
    words: { english: 'compare', french: 'comparer', german: 'vergleichen', italian: 'confrontare', portuguese: 'comparar', spanish: 'comparar', japanese: 'くらべる', korean: '비교하다', mandarin: '比较' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 24 — Advanced: Cultural Heritage
// ─────────────────────────────────────────────────────────────────────────────
const CULTURAL_HERITAGE: ConceptEntry[] = [
  {
    conceptKey: 'heritage', englishGloss: 'heritage', imageTier: 'none',
    words: { english: 'heritage', french: 'patrimoine', german: 'Erbe', italian: 'patrimonio', portuguese: 'patrimônio', spanish: 'patrimonio', japanese: 'いさん', korean: '유산', mandarin: '遗产' },
  },
  {
    conceptKey: 'indigenous', englishGloss: 'indigenous', imageTier: 'none',
    words: { english: 'indigenous', french: 'indigène', german: 'indigen', italian: 'indigeno', portuguese: 'indígena', spanish: 'indígena', japanese: 'せんじゅうみんぞく', korean: '토착', mandarin: '土著' },
  },
  {
    conceptKey: 'ceremony', englishGloss: 'ceremony', imageTier: 'scene_override',
    words: { english: 'ceremony', french: 'cérémonie', german: 'Zeremonie', italian: 'cerimonia', portuguese: 'cerimônia', spanish: 'ceremonia', japanese: 'しき', korean: '의식', mandarin: '仪式' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 25 — Advanced: Media & Journalism
// ─────────────────────────────────────────────────────────────────────────────
const MEDIA_JOURNALISM: ConceptEntry[] = [
  {
    conceptKey: 'news', englishGloss: 'news', imageTier: 'none',
    words: { english: 'news', french: 'actualités', german: 'Nachrichten', italian: 'notizie', portuguese: 'notícias', spanish: 'noticias', japanese: 'ニュース', korean: '뉴스', mandarin: '新闻' },
  },
  {
    conceptKey: 'journalism', englishGloss: 'journalism', imageTier: 'none',
    words: { english: 'journalism', french: 'journalisme', german: 'Journalismus', italian: 'giornalismo', portuguese: 'jornalismo', spanish: 'periodismo', japanese: 'ジャーナリズム', korean: '저널리즘', mandarin: '新闻业' },
  },
  {
    conceptKey: 'opinion', englishGloss: 'opinion', imageTier: 'none',
    words: { english: 'opinion', french: 'opinion', german: 'Meinung', italian: 'opinione', portuguese: 'opinião', spanish: 'opinión', japanese: 'いけん', korean: '의견', mandarin: '观点' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 26 — Advanced: Finance & Economy
// ─────────────────────────────────────────────────────────────────────────────
const FINANCE: ConceptEntry[] = [
  {
    conceptKey: 'money', englishGloss: 'money', imageTier: 'shared',
    sharedConceptKey: 'vocab_spanish_dinero',
    words: { english: 'money', french: 'argent', german: 'Geld', italian: 'soldi', portuguese: 'dinheiro', spanish: 'dinero', japanese: 'おかね', korean: '돈', mandarin: '钱' },
  },
  {
    conceptKey: 'economy', englishGloss: 'economy', imageTier: 'none',
    words: { english: 'economy', french: 'économie', german: 'Wirtschaft', italian: 'economia', portuguese: 'economia', spanish: 'economía', japanese: 'けいざい', korean: '경제', mandarin: '经济' },
  },
  {
    conceptKey: 'budget', englishGloss: 'budget', imageTier: 'none',
    words: { english: 'budget', french: 'budget', german: 'Budget', italian: 'budget', portuguese: 'orçamento', spanish: 'presupuesto', japanese: 'よさん', korean: '예산', mandarin: '预算' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// UNIT 27 — Advanced: Advanced Skills
// ─────────────────────────────────────────────────────────────────────────────
const ADVANCED_SKILLS: ConceptEntry[] = [
  {
    conceptKey: 'negotiate', englishGloss: 'to negotiate', imageTier: 'none',
    words: { english: 'negotiate', french: 'négocier', german: 'verhandeln', italian: 'negoziare', portuguese: 'negociar', spanish: 'negociar', japanese: 'こうしょうする', korean: '협상하다', mandarin: '谈判' },
  },
  {
    conceptKey: 'persuade', englishGloss: 'to persuade', imageTier: 'none',
    words: { english: 'persuade', french: 'persuader', german: 'überzeugen', italian: 'persuadere', portuguese: 'persuadir', spanish: 'persuadir', japanese: 'せっとくする', korean: '설득하다', mandarin: '说服' },
  },
  {
    conceptKey: 'collaborate', englishGloss: 'to collaborate', imageTier: 'scene_override',
    words: { english: 'collaborate', french: 'collaborer', german: 'zusammenarbeiten', italian: 'collaborare', portuguese: 'colaborar', spanish: 'colaborar', japanese: 'きょうりょくする', korean: '협력하다', mandarin: '合作' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Master registry
// ─────────────────────────────────────────────────────────────────────────────
export const CANONICAL_UNITS: Record<UnitTheme, ConceptEntry[]> = {
  greetings:             GREETINGS,
  family:                FAMILY,
  school:                SCHOOL,
  hobbies:               HOBBIES,
  food:                  FOOD,
  numbers_time:          NUMBERS_TIME,
  daily_routines:        DAILY_ROUTINES,
  shopping:              SHOPPING,
  city:                  CITY,
  travel_transport:      TRAVEL_TRANSPORT,
  identity:              IDENTITY,
  health:                HEALTH,
  technology:            TECHNOLOGY,
  environment:           ENVIRONMENT,
  past_tense:            PAST_TENSE,
  global_challenges:     GLOBAL_CHALLENGES,
  arts:                  ARTS,
  history:               HISTORY,
  future_plans:          FUTURE_PLANS,
  travel_extended:       TRAVEL_EXTENDED,
  science:               SCIENCE,
  cultural_perspectives: CULTURAL_PERSPECTIVES,
  exam_prep:             EXAM_PREP,
  cultural_heritage:     CULTURAL_HERITAGE,
  media_journalism:      MEDIA_JOURNALISM,
  finance:               FINANCE,
  advanced_skills:       ADVANCED_SKILLS,
};

// ─────────────────────────────────────────────────────────────────────────────
// Precomputed flat lookup: "language:normalizedWord" → sharedConceptKey
//
// Built once at module load time so lookupCanonicalConcept() is O(1).
// Only entries with a sharedConceptKey are indexed (scene_override/svg/none
// tiers don't have a shared DB image to route to).
// ─────────────────────────────────────────────────────────────────────────────
function normalizeCanonicalWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^a-z0-9\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0590-\u05FF\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CANONICAL_LOOKUP = new Map<string, string>();

for (const concepts of Object.values(CANONICAL_UNITS)) {
  for (const concept of concepts) {
    if (!concept.sharedConceptKey) continue;
    for (const [lang, word] of Object.entries(concept.words) as [Language, string][]) {
      if (!word) continue;
      const key = `${lang}:${normalizeCanonicalWord(word)}`;
      if (!CANONICAL_LOOKUP.has(key)) {
        CANONICAL_LOOKUP.set(key, concept.sharedConceptKey);
      }
    }
  }
}

/**
 * Look up a word in the canonical vocabulary registry.
 *
 * Returns the `sharedConceptKey` (e.g. "vocab_spanish_estudiar") if the word
 * is found in the registry for the given language, or null if not found.
 *
 * Called as the FIRST step in the vocabulary image resolution pipeline — before
 * the CONCEPT_KEY_MAP lookup — so that canonical words are guaranteed to route
 * to the correct shared image regardless of the fallback chain.
 *
 * @param word     The raw vocabulary word (diacritics OK, case ignored)
 * @param language One of the 9 supported language strings
 */
export function lookupCanonicalConcept(word: string, language: Language): string | null {
  const normalized = normalizeCanonicalWord(word);
  const full = CANONICAL_LOOKUP.get(`${language}:${normalized}`);
  if (full) return full;

  // Also try after stripping reflexive prefix (se lever → lever, s'habiller → habiller)
  const stripped = normalized
    .replace(/^se /, '')
    .replace(/^s /, '')
    .replace(/^sich /, '')
    .trim();
  if (stripped !== normalized) {
    const stripped2 = CANONICAL_LOOKUP.get(`${language}:${stripped}`);
    if (stripped2) return stripped2;
  }

  return null;
}

/**
 * Return all canonical entries for a given unit theme.
 * Useful for the /api/admin/vocab-audit endpoint.
 */
export function getUnitConcepts(unit: UnitTheme): ConceptEntry[] {
  return CANONICAL_UNITS[unit] ?? [];
}

/**
 * Return the full flat list of all canonical concepts across all units.
 * Useful for audit and completeness checks.
 */
export function getAllConcepts(): ConceptEntry[] {
  return Object.values(CANONICAL_UNITS).flat();
}

export { normalizeCanonicalWord };
