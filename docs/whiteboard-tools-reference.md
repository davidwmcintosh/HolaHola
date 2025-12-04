# Whiteboard Tools Reference Guide

The AI tutor's whiteboard is a real-time visual teaching system that displays content during voice lessons. This guide covers all available tools and their markup formats.

---

## Quick Reference

| Tool | Purpose | Format |
|------|---------|--------|
| WRITE | Display text/vocabulary | `[WRITE]text[/WRITE]` |
| PHONETIC | Pronunciation breakdown | `[PHONETIC]word\|breakdown[/PHONETIC]` |
| COMPARE | Show corrections | `[COMPARE]correct NOT incorrect[/COMPARE]` |
| IMAGE | Vocabulary images | `[IMAGE]word[/IMAGE]` |
| DRILL | Interactive exercises | `[DRILL type="..."]content[/DRILL]` |
| CONTEXT | Word in sentences | `[CONTEXT]word\|sentence1\|sentence2[/CONTEXT]` |
| GRAMMAR_TABLE | Verb conjugation | `[GRAMMAR_TABLE]verb\|tense[/GRAMMAR_TABLE]` |
| READING | Pronunciation guides | `[READING]char\|pronunciation[/READING]` |
| STROKE | Character strokes | `[STROKE]character[/STROKE]` |
| WORD_MAP | Related words | `[WORD_MAP]word[/WORD_MAP]` |
| CULTURE | Cultural context | `[CULTURE]topic\|context\|category[/CULTURE]` |
| PLAY | Audio replay | `[PLAY]text[/PLAY]` |
| SCENARIO | Role-play setup | `[SCENARIO]location\|situation\|mood[/SCENARIO]` |
| SUMMARY | Lesson recap | `[SUMMARY]title\|words\|phrases[/SUMMARY]` |

---

## Core Tools

### WRITE - Text Display

Display vocabulary words, key phrases, or any text prominently.

**Format:** `[WRITE]text[/WRITE]`

**Examples:**
```
[WRITE]Bonjour[/WRITE]
[WRITE]Buenos días[/WRITE]
[WRITE]Thank you very much[/WRITE]
```

**Use When:**
- Introducing new vocabulary
- Emphasizing important words
- Showing spelling clearly

---

### PHONETIC - Pronunciation Breakdown

Show how to pronounce words with phonetic notation.

**Format:** `[PHONETIC]word|breakdown[/PHONETIC]`

**Examples:**
```
[PHONETIC]croissant|krwah-SAHN[/PHONETIC]
[PHONETIC]gracias|GRAH-see-ahs[/PHONETIC]
[PHONETIC]Guten Tag|GOO-ten tahk[/PHONETIC]
```

**Use When:**
- Introducing difficult pronunciations
- Helping with syllable stress
- Breaking down long words

---

### COMPARE - Correction Display

Show the correct form alongside what was incorrect.

**Format:** `[COMPARE]correct NOT incorrect[/COMPARE]`

**Examples:**
```
[COMPARE]Estoy bien NOT Soy bien[/COMPARE]
[COMPARE]Je suis allé NOT Je suis allée[/COMPARE]
[COMPARE]I have eaten NOT I have ate[/COMPARE]
```

**Use When:**
- Correcting common errors
- Teaching grammar distinctions
- Comparing similar words

---

### IMAGE - Vocabulary Images

Display contextual images to reinforce vocabulary learning.

**Format:** `[IMAGE]word[/IMAGE]`

**Examples:**
```
[IMAGE]apple[/IMAGE]
[IMAGE]restaurant[/IMAGE]
[IMAGE]train station[/IMAGE]
```

**Use When:**
- Teaching concrete nouns
- Visual learners
- Making vocabulary memorable

---

## Interactive Tools

### DRILL - Interactive Exercises

Create interactive practice exercises with various types.

**Types Available:**
- `repeat` - Listen and repeat pronunciation
- `translate` - Translate phrase to target language
- `fill_blank` - Complete the missing word
- `match` - Match pairs of terms

**Format:**
```
[DRILL type="repeat"]phrase to repeat[/DRILL]
[DRILL type="translate"]phrase to translate[/DRILL]
[DRILL type="fill_blank"]sentence with ___ blank[/DRILL]
[DRILL type="match"]
term1 => translation1
term2 => translation2
[/DRILL]
```

**Examples:**

*Repeat Drill:*
```
[DRILL type="repeat"]Encantado de conocerte[/DRILL]
```

*Translation Drill:*
```
[DRILL type="translate"]How do you say 'thank you' in Spanish?[/DRILL]
```

*Fill in the Blank:*
```
[DRILL type="fill_blank"]Je ___ étudiant (I am a student)[/DRILL]
```

*Matching Drill:*
```
[DRILL type="match"]
hello => hola
goodbye => adiós
thank you => gracias
please => por favor
[/DRILL]
```

**Use When:**
- Active practice time
- Testing comprehension
- Building vocabulary associations

---

## Context & Grammar Tools

### CONTEXT - Word in Multiple Sentences

Show a word used in multiple real-world sentences.

**Format:** `[CONTEXT]word|sentence1|sentence2|sentence3[/CONTEXT]`

**Examples:**
```
[CONTEXT]gustar|Me gusta la pizza|¿Te gustan los libros?|A ella le gusta bailar[/CONTEXT]
[CONTEXT]faire|Je fais du sport|Il fait beau|Qu'est-ce que tu fais?[/CONTEXT]
```

**Use When:**
- Teaching word usage
- Showing grammar patterns
- Demonstrating verb conjugations

---

### GRAMMAR_TABLE - Verb Conjugation

Display verb conjugation tables for any tense.

**Format:** `[GRAMMAR_TABLE]verb|tense[/GRAMMAR_TABLE]`

**Supported Tenses:**
- present
- past
- future
- imperfect
- conditional
- subjunctive

**Examples:**
```
[GRAMMAR_TABLE]hablar|present[/GRAMMAR_TABLE]
[GRAMMAR_TABLE]avoir|past[/GRAMMAR_TABLE]
[GRAMMAR_TABLE]sein|present[/GRAMMAR_TABLE]
```

**Use When:**
- Teaching verb forms
- Reviewing conjugations
- Comparing tenses

---

## Asian Language Tools

### READING - Pronunciation Guides

Display reading guides for Asian languages (furigana, pinyin, romanization).

**Format:** `[READING]character|pronunciation|language[/READING]`

**Language Parameter:** Optional - auto-detected from characters
- Japanese: furigana above characters
- Mandarin: pinyin above characters
- Korean: romanization below characters

**Examples:**
```
[READING]食べる|たべる[/READING]
[READING]你好|nǐ hǎo[/READING]
[READING]감사합니다|gamsahamnida[/READING]
```

**Use When:**
- Teaching character reading
- Helping with pronunciation
- Supporting beginning learners

---

### STROKE - Animated Stroke Order

Display animated stroke order for CJK characters using HanziWriter.

**Format:** `[STROKE]character[/STROKE]`

**Examples:**
```
[STROKE]食[/STROKE]
[STROKE]愛[/STROKE]
[STROKE]한[/STROKE]
```

**Features:**
- Animated stroke-by-stroke demonstration
- Replay button for review
- Stroke count display

**Use When:**
- Teaching character writing
- Reviewing stroke order
- Practicing handwriting

---

## Vocabulary & Culture Tools

### WORD_MAP - Vocabulary Relationships

Display a visual web of related words.

**Format:** `[WORD_MAP]word[/WORD_MAP]`

**Includes:**
- **Synonyms:** Words with similar meaning
- **Antonyms:** Opposite meaning words
- **Collocations:** Common word pairings
- **Word Family:** Related forms (happy → happiness, happily)

**Examples:**
```
[WORD_MAP]happy[/WORD_MAP]
[WORD_MAP]manger[/WORD_MAP]
[WORD_MAP]schnell[/WORD_MAP]
```

**Use When:**
- Expanding vocabulary
- Teaching word relationships
- Building vocabulary networks

---

### CULTURE - Cultural Context

Display cultural insights and etiquette information.

**Format:** `[CULTURE]topic|context|category[/CULTURE]`

**Categories:**
- food, dining
- gestures, body language
- holidays, festivals
- etiquette, customs
- (default: general)

**Examples:**
```
[CULTURE]Tu vs Vous|In France, use 'vous' with strangers and 'tu' with friends|etiquette[/CULTURE]
[CULTURE]Tipping in Japan|Tipping is considered rude - good service is expected|dining[/CULTURE]
[CULTURE]Business Cards|In Japan, receive meishi with both hands and study it carefully|customs[/CULTURE]
```

**Use When:**
- Explaining why phrases are used
- Teaching cultural norms
- Preparing for real-world situations

---

## Audio & Session Tools

### PLAY - Audio Replay Button

Provide a button for students to replay pronunciation.

**Format:** `[PLAY]text[/PLAY]` or `[PLAY speed="slow"]text[/PLAY]`

**Speed Options:**
- `slow` - 0.5x speed
- `normal` - 1.0x speed (default)
- `fast` - 1.5x speed

**Examples:**
```
[PLAY]Encantado de conocerte[/PLAY]
[PLAY speed="slow"]Entschuldigung[/PLAY]
[PLAY speed="fast"]Bonjour, comment allez-vous?[/PLAY]
```

**Use When:**
- Complex phrases
- Pronunciation practice
- Student requests to hear again

---

### SCENARIO - Role-Play Scene Setup

Create immersive scene cards for role-play exercises.

**Format:** `[SCENARIO]location|situation|mood[/SCENARIO]`

**Mood Options:**
- formal
- casual
- urgent
- friendly

**Examples:**
```
[SCENARIO]Café|You walk into a café in Barcelona and want to order coffee|casual[/SCENARIO]
[SCENARIO]Office|You're introducing yourself to new colleagues on your first day|formal[/SCENARIO]
[SCENARIO]Train Station|You've missed your train and need to find the next one|urgent[/SCENARIO]
```

**Use When:**
- Starting role-play exercises
- Setting context for practice
- Creating immersive scenarios

---

### SUMMARY - Lesson Recap

Display a summary of vocabulary and phrases learned in a lesson.

**Format:** `[SUMMARY]title|word1,word2,word3|phrase1,phrase2[/SUMMARY]`

**Examples:**
```
[SUMMARY]Today's Greetings|hola,adiós,gracias|Buenos días,Hasta luego[/SUMMARY]
[SUMMARY]Restaurant Vocabulary|menu,cuenta,propina|Una mesa para dos,La cuenta por favor[/SUMMARY]
```

**Use When:**
- End of lesson
- Reviewing learned content
- Creating takeaway notes

---

## Best Practices

1. **Don't Overuse:** Use tools strategically - one or two per exchange, not everything at once
2. **Match to Student Level:** Use simpler tools (WRITE, IMAGE) for beginners; advanced tools (GRAMMAR_TABLE, CONTEXT) for higher levels
3. **Combine Thoughtfully:** PHONETIC + PLAY work well together; COMPARE after noting an error
4. **Asian Languages:** Always use READING for new characters; STROKE for writing practice
5. **Interactive Balance:** Mix DRILL exercises with explanatory tools
6. **Cultural Context:** Use CULTURE when explaining "why" not just "what"

---

*Last updated: December 2025*
