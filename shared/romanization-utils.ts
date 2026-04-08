/**
 * Romanization utilities for East Asian and Hebrew scripts.
 * No external dependencies — pure lookup tables and algorithms.
 */

// ─── Japanese: Common kanji / compound readings (N5-N4 textbook vocabulary) ─
// Longer compounds listed first so the greedy matcher picks the best reading.
const KANJI_MAP: Record<string, string> = {
  // 3-char compounds
  '大丈夫': 'daijōbu', '食べ物': 'tabemono', '飲み物': 'nomimono',
  '乗り物': 'norimono', '生き物': 'ikimono',
  // 2-char compounds (N5 core — unambiguous in textbook context)
  '元気': 'genki', '名前': 'namae', '日本': 'nihon', '今日': 'kyō',
  '明日': 'ashita', '昨日': 'kinō', '友達': 'tomodachi', '学生': 'gakusei',
  '先生': 'sensei', '大学': 'daigaku', '学校': 'gakkō', '会社': 'kaisha',
  '仕事': 'shigoto', '時間': 'jikan', '電話': 'denwa', '家族': 'kazoku',
  '兄弟': 'kyōdai', '姉妹': 'shimai', '子供': 'kodomo', '毎日': 'mainichi',
  '毎朝': 'maiasa', '毎晩': 'maiban', '本当': 'hontō', '一緒': 'issho',
  '好き': 'suki', '嫌い': 'kirai', '上手': 'jōzu', '下手': 'heta',
  'お金': 'okane', '言葉': 'kotoba', '日本語': 'nihongo', '英語': 'eigo',
  '天気': 'tenki', '今年': 'kotoshi', '来年': 'rainen', '去年': 'kyonen',
  '来週': 'raishū', '先週': 'senshū', '今週': 'konshū', '来月': 'raigetsu',
  '先月': 'sengetsu', '今月': 'kongetsu', '午前': 'gozen', '午後': 'gogo',
  '何時': 'nanji', '何分': 'nanpun', '何曜': 'nanyō', '月曜': 'getsuyō',
  '火曜': 'kayō', '水曜': 'suiyō', '木曜': 'mokuyō', '金曜': 'kin-yō',
  '土曜': 'doyō', '日曜': 'nichiyō', '新聞': 'shinbun', '雑誌': 'zasshi',
  '映画': 'eiga', '音楽': 'ongaku', '料理': 'ryōri', '旅行': 'ryokō',
  '勉強': 'benkyō', '練習': 'renshū', '宿題': 'shukudai', '試験': 'shiken',
  '病院': 'byōin', '銀行': 'ginkō', '郵便': 'yūbin', '図書': 'tosho',
  '食事': 'shokuji', '朝食': 'chōshoku', '昼食': 'chūshoku', '夕食': 'yūshoku',
  '朝ご飯': 'asagohan', '昼ご飯': 'hirugohan', '晩ご飯': 'bangohan',
  // Single kanji (used only when no compound matches — pick the most common reading)
  '私': 'watashi', '僕': 'boku', '俺': 'ore', '君': 'kimi', '彼': 'kare',
  '彼女': 'kanojo', '今': 'ima', '誰': 'dare', '何': 'nani', '時': 'toki',
  '人': 'hito', '日': 'nichi', '本': 'hon', '山': 'yama', '川': 'kawa',
  '木': 'ki', '水': 'mizu', '金': 'kin', '土': 'tsuchi', '中': 'naka',
  '上': 'ue', '下': 'shita', '右': 'migi', '左': 'hidari', '前': 'mae',
  '後': 'ato', '間': 'aida', '外': 'soto', '内': 'uchi', '家': 'ie',
  '店': 'mise', '駅': 'eki', '道': 'michi', '車': 'kuruma', '手': 'te',
  '目': 'me', '耳': 'mimi', '口': 'kuchi', '鼻': 'hana', '顔': 'kao',
  '頭': 'atama', '心': 'kokoro', '気': 'ki', '名': 'na', '語': 'go',
  '年': 'nen', '月': 'tsuki', '週': 'shū', '朝': 'asa', '晩': 'ban',
  '昼': 'hiru', '夜': 'yoru', '午': 'go', '分': 'fun', '秒': 'byō',
  '円': 'en', '万': 'man', '百': 'hyaku', '千': 'sen',
  '大': 'ō', '小': 'ko', '高': 'taka', '低': 'hikui',
  '新': 'shin', '古': 'furu', '長': 'naga', '短': 'mijika',
  '食': 'shoku', '飲': 'in', '帰': 'kaeri',
  '見': 'mi', '書': 'ka', '読': 'yo', '話': 'hanashi',
  '思': 'omo', '知': 'shi',
};

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

// Kanji codepoint range check
function isKanji(c: string): boolean {
  const cp = c.codePointAt(0)!;
  return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF);
}

function convertJapanese(text: string): string {
  let result = '';
  let i = 0;
  const chars = [...text]; // spread handles multi-codepoint chars

  while (i < chars.length) {
    // ── 1. Kanji compound lookup (greedy longest-match: 3 → 2 → 1 chars) ──
    if (isKanji(chars[i]) || (chars[i] === 'お' && i + 1 < chars.length && isKanji(chars[i + 1]))) {
      // Also allow honorific お + kanji compound to be caught by the map
      // (e.g. "お金" is in KANJI_MAP as a 2-char entry)
      let matched = false;
      for (let len = 3; len >= 1; len--) {
        const seg = chars.slice(i, i + len).join('');
        if (KANJI_MAP[seg] !== undefined) {
          // Add a separating space if the previous result character is a letter
          if (result.length > 0 && /[a-zāīūēōĀĪŪĒŌ]$/i.test(result)) result += ' ';
          result += KANJI_MAP[seg];
          i += len;
          matched = true;
          break;
        }
      }
      if (matched) continue;
    }

    // ── 2. Kana digraph (2-char hiragana/katakana combos) ──
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
      // Non-kana, non-kanji character (punctuation, ASCII, unknown) — pass through
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

// ─── Mandarin: Pinyin lookup (HSK 1-2 + common textbook vocabulary) ─────────
// Greedy longest-match: try 4-char → 3-char → 2-char → 1-char compounds first.
// Uses standard Hànyǔ Pīnyīn with tone diacritics.

const PINYIN_MAP: Record<string, string> = {
  // ── 4-char compounds ────────────────────────────────────────────────────
  '不好意思': 'bù hǎo yì si', '对不起来': 'duì bù qǐ lái',
  '你好吗？': 'nǐ hǎo ma?', '您好吗？': 'nín hǎo ma?',
  // ── 3-char compounds ────────────────────────────────────────────────────
  '对不起': 'duì bù qǐ', '没关系': 'méi guān xi',
  '怎么样': 'zěn me yàng', '为什么': 'wèi shén me',
  '早上好': 'zǎo shang hǎo', '下午好': 'xià wǔ hǎo', '晚上好': 'wǎn shang hǎo',
  '你们好': 'nǐ men hǎo', '大家好': 'dà jiā hǎo',
  '谢谢你': 'xiè xie nǐ', '不客气': 'bù kè qi',
  '没问题': 'méi wèn tí', '好的吗': 'hǎo de ma',
  '哪个国': 'nǎ ge guó', '多少钱': 'duō shao qián',
  '我是说': 'wǒ shì shuō', '什么时': 'shén me shí',
  '在哪里': 'zài nǎ lǐ', '在哪儿': 'zài nǎ r',
  '怎么办': 'zěn me bàn', '怎么说': 'zěn me shuō',
  '打扰一': 'dǎ rǎo yī', '打扰了': 'dǎ rǎo le',
  '星期一': 'xīng qī yī', '星期二': 'xīng qī èr', '星期三': 'xīng qī sān',
  '星期四': 'xīng qī sì', '星期五': 'xīng qī wǔ', '星期六': 'xīng qī liù',
  '星期日': 'xīng qī rì', '星期天': 'xīng qī tiān',
  '老师好': 'lǎo shī hǎo',
  // ── 2-char compounds ────────────────────────────────────────────────────
  // Greetings & politeness
  '你好': 'nǐ hǎo', '您好': 'nín hǎo', '再见': 'zài jiàn',
  '谢谢': 'xiè xie', '不谢': 'bù xiè', '客气': 'kè qi',
  '幸会': 'xìng huì', '打扰': 'dǎ rǎo', '请问': 'qǐng wèn',
  '认识': 'rèn shi', '高兴': 'gāo xìng', '欢迎': 'huān yíng',
  '没有': 'méi yǒu', '好的': 'hǎo de', '可以': 'kě yǐ',
  '没事': 'méi shì', '好吗': 'hǎo ma', '是的': 'shì de',
  // Pronouns & common nouns
  '我们': 'wǒ men', '你们': 'nǐ men', '他们': 'tā men', '她们': 'tā men',
  '名字': 'míng zi', '老师': 'lǎo shī', '朋友': 'péng you',
  '同学': 'tóng xué', '学生': 'xué sheng', '先生': 'xiān sheng',
  '女士': 'nǚ shì', '小姐': 'xiǎo jiě', '父母': 'fù mǔ',
  '爸爸': 'bà ba', '妈妈': 'mā ma', '哥哥': 'gē ge', '姐姐': 'jiě jie',
  '弟弟': 'dì di', '妹妹': 'mèi mei', '孩子': 'hái zi',
  '丈夫': 'zhàng fu', '妻子': 'qī zi', '家人': 'jiā rén',
  // Time words
  '今天': 'jīn tiān', '明天': 'míng tiān', '昨天': 'zuó tiān',
  '现在': 'xiàn zài', '今年': 'jīn nián', '明年': 'míng nián', '去年': 'qù nián',
  '上午': 'shàng wǔ', '下午': 'xià wǔ', '早上': 'zǎo shang', '晚上': 'wǎn shang',
  '中午': 'zhōng wǔ', '早饭': 'zǎo fàn', '午饭': 'wǔ fàn', '晚饭': 'wǎn fàn',
  '星期': 'xīng qī', '周末': 'zhōu mò', '假期': 'jià qī',
  '时间': 'shí jiān', '小时': 'xiǎo shí', '分钟': 'fēn zhōng',
  // Numbers  
  '一二': 'yī èr', '十一': 'shí yī', '十二': 'shí èr', '二十': 'èr shí',
  '百元': 'bǎi yuán', '多少': 'duō shao', '一点': 'yī diǎn',
  // Places & directions
  '中国': 'Zhōng guó', '北京': 'Běi jīng', '上海': 'Shàng hǎi',
  '美国': 'Měi guó', '英国': 'Yīng guó', '日本': 'Rì běn',
  '学校': 'xué xiào', '图书': 'tú shū', '医院': 'yī yuàn',
  '餐厅': 'cān tīng', '商店': 'shāng diàn', '银行': 'yín háng',
  '公司': 'gōng sī', '家里': 'jiā lǐ', '左边': 'zuǒ biān', '右边': 'yòu biān',
  '前面': 'qián miàn', '后面': 'hòu miàn', '里面': 'lǐ miàn', '外面': 'wài miàn',
  // Common verbs & adjectives
  '喜欢': 'xǐ huān', '知道': 'zhī dào', '觉得': 'jué de',
  '听说': 'tīng shuō', '告诉': 'gào su', '帮助': 'bāng zhù',
  '学习': 'xué xí', '工作': 'gōng zuò', '休息': 'xiū xi',
  '吃饭': 'chī fàn', '喝水': 'hē shuǐ', '睡觉': 'shuì jiào',
  '漂亮': 'piào liang', '好看': 'hǎo kàn', '难看': 'nán kàn',
  '高兴': 'gāo xìng', '开心': 'kāi xīn', '难过': 'nán guò',
  '便宜': 'pián yi', '贵的': 'guì de', '大的': 'dà de', '小的': 'xiǎo de',
  '热的': 'rè de', '冷的': 'lěng de', '快一': 'kuài yī', '慢一': 'màn yī',
  // Food
  '水果': 'shuǐ guǒ', '蔬菜': 'shū cài', '米饭': 'mǐ fàn',
  '面条': 'miàn tiáo', '包子': 'bāo zi', '饺子': 'jiǎo zi',
  '茶水': 'chá shuǐ', '牛奶': 'niú nǎi', '咖啡': 'kā fēi',
  // ── Single characters ───────────────────────────────────────────────────
  // Personal pronouns
  '我': 'wǒ', '你': 'nǐ', '您': 'nín', '他': 'tā', '她': 'tā', '它': 'tā',
  // Common verbs
  '是': 'shì', '有': 'yǒu', '在': 'zài', '去': 'qù', '来': 'lái',
  '说': 'shuō', '叫': 'jiào', '看': 'kàn', '听': 'tīng', '写': 'xiě',
  '读': 'dú', '学': 'xué', '吃': 'chī', '喝': 'hē', '买': 'mǎi',
  '卖': 'mài', '做': 'zuò', '走': 'zǒu', '跑': 'pǎo', '坐': 'zuò',
  '开': 'kāi', '关': 'guān', '打': 'dǎ', '要': 'yào', '想': 'xiǎng',
  '知': 'zhī', '会': 'huì', '能': 'néng', '可': 'kě', '让': 'ràng',
  // Common nouns
  '人': 'rén', '家': 'jiā', '书': 'shū', '车': 'chē', '钱': 'qián',
  '水': 'shuǐ', '饭': 'fàn', '茶': 'chá', '酒': 'jiǔ', '肉': 'ròu',
  '鱼': 'yú', '鸡': 'jī', '牛': 'niú', '猪': 'zhū', '狗': 'gǒu',
  '猫': 'māo', '花': 'huā', '树': 'shù', '山': 'shān', '河': 'hé',
  '国': 'guó', '城': 'chéng', '路': 'lù', '门': 'mén', '房': 'fáng',
  // Question words
  '什': 'shén', '么': 'me', '哪': 'nǎ', '谁': 'shéi', '哪': 'nǎ',
  '怎': 'zěn', '几': 'jǐ',
  // Adjectives
  '好': 'hǎo', '大': 'dà', '小': 'xiǎo', '多': 'duō', '少': 'shǎo',
  '新': 'xīn', '旧': 'jiù', '长': 'cháng', '短': 'duǎn', '高': 'gāo',
  '低': 'dī', '热': 'rè', '冷': 'lěng', '快': 'kuài', '慢': 'màn',
  '早': 'zǎo', '晚': 'wǎn', '远': 'yuǎn', '近': 'jìn', '美': 'měi',
  '对': 'duì', '错': 'cuò', '难': 'nán', '易': 'yì', '忙': 'máng',
  '累': 'lèi', '渴': 'kě', '饿': 'è', '贵': 'guì', '便': 'pián',
  // Numbers 1-10 & 100
  '一': 'yī', '二': 'èr', '三': 'sān', '四': 'sì', '五': 'wǔ',
  '六': 'liù', '七': 'qī', '八': 'bā', '九': 'jiǔ', '十': 'shí',
  '百': 'bǎi', '千': 'qiān', '万': 'wàn', '零': 'líng',
  // Time units
  '年': 'nián', '月': 'yuè', '日': 'rì', '天': 'tiān', '时': 'shí',
  '分': 'fēn', '秒': 'miǎo', '周': 'zhōu', '号': 'hào',
  // Particles & grammar
  '的': 'de', '了': 'le', '吗': 'ma', '呢': 'ne', '吧': 'ba',
  '也': 'yě', '都': 'dōu', '还': 'hái', '又': 'yòu', '再': 'zài',
  '很': 'hěn', '太': 'tài', '真': 'zhēn', '最': 'zuì', '非': 'fēi',
  '不': 'bù', '没': 'méi', '和': 'hé', '或': 'huò', '因': 'yīn',
  '但': 'dàn', '如': 'rú', '就': 'jiù', '才': 'cái', '只': 'zhǐ',
  '已': 'yǐ', '经': 'jīng', '过': 'guò', '着': 'zhe', '得': 'de',
  '地': 'de', '被': 'bèi', '把': 'bǎ', '从': 'cóng', '向': 'xiàng',
  '为': 'wèi', '以': 'yǐ', '于': 'yú', '而': 'ér', '与': 'yǔ',
  // Directions & positions
  '上': 'shàng', '下': 'xià', '左': 'zuǒ', '右': 'yòu',
  '前': 'qián', '后': 'hòu', '里': 'lǐ', '外': 'wài', '中': 'zhōng',
  // Classifiers (measure words)
  '个': 'gè', '只': 'zhī', '本': 'běn', '张': 'zhāng', '条': 'tiáo',
  '块': 'kuài', '瓶': 'píng', '杯': 'bēi', '碗': 'wǎn', '盘': 'pán',
  // Additional common characters
  '请': 'qǐng', '谢': 'xiè', '关': 'guān', '系': 'xi', '问': 'wèn',
  '意': 'yì', '思': 'si', '身': 'shēn', '体': 'tǐ', '名': 'míng',
  '字': 'zì', '语': 'yǔ', '话': 'huà', '文': 'wén', '字': 'zì',
  '幸': 'xìng', '见': 'jiàn', '朋': 'péng', '友': 'you', '同': 'tóng',
  '学': 'xué', '生': 'shēng', '师': 'shī', '校': 'xiào', '院': 'yuàn',
  '店': 'diàn', '行': 'xíng', '司': 'sī', '公': 'gōng', '室': 'shì',
  '间': 'jiān', '号': 'hào', '层': 'céng', '楼': 'lóu', '街': 'jiē',
  '吃': 'chī', '住': 'zhù', '用': 'yòng', '玩': 'wán', '说': 'shuō',
  '唱': 'chàng', '跳': 'tiào', '画': 'huà', '拍': 'pāi', '找': 'zhǎo',
};

// Chinese codepoint range check
function isChineseChar(c: string): boolean {
  const cp = c.codePointAt(0)!;
  return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
         (cp >= 0x20000 && cp <= 0x2A6DF);
}

function convertMandarin(text: string): string {
  const chars = [...text];
  let result = '';
  let i = 0;
  while (i < chars.length) {
    if (!isChineseChar(chars[i])) {
      // Punctuation, Latin, spaces — pass through
      result += chars[i];
      i++;
      continue;
    }
    // Greedy longest-match: 4 → 3 → 2 → 1 chars
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      const seg = chars.slice(i, i + len).join('');
      const reading = PINYIN_MAP[seg];
      if (reading !== undefined) {
        if (result.length > 0 && !/[\s]$/.test(result)) result += ' ';
        result += reading;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Unknown character — pass through as-is so caller can detect it
      result += chars[i];
      i++;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

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
      case 'mandarin': {
        const result = convertMandarin(text);
        // If result still contains Chinese characters, we couldn't convert everything.
        // Return partial pinyin only if we converted at least something meaningful.
        const hasUnknownChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(result);
        if (hasUnknownChinese && result === text) return null; // nothing converted
        return result !== text ? result : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
