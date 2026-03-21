import { SENTENCE_CHUNKING_CONFIG } from "@shared/streaming-voice-types";

export function splitTextIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let remaining = text.trim();
  const endings = SENTENCE_CHUNKING_CONFIG.SENTENCE_ENDINGS;
  const minLen = SENTENCE_CHUNKING_CONFIG.MIN_SENTENCE_LENGTH;
  const maxLen = SENTENCE_CHUNKING_CONFIG.TTS_SAFE_MAX_LENGTH;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      let breakIndex = -1;
      for (const ending of endings) {
        let searchFrom = minLen - 1;
        while (true) {
          const idx = remaining.indexOf(ending, searchFrom);
          if (idx === -1) break;
          const afterChar = remaining[idx + 1];
          const isRealEnd = !afterChar || afterChar === ' ' || afterChar === '\n' || afterChar === '"' || afterChar === ')';
          if (isRealEnd && idx < remaining.length - 1) {
            breakIndex = idx + 1;
            break;
          }
          searchFrom = idx + 1;
        }
        if (breakIndex > 0) break;
      }

      if (breakIndex > 0 && remaining.length - breakIndex >= minLen) {
        sentences.push(remaining.substring(0, breakIndex).trim());
        remaining = remaining.substring(breakIndex).trim();
        continue;
      }
    }

    if (remaining.length > maxLen) {
      let breakIndex = -1;
      for (const ending of endings) {
        const idx = remaining.lastIndexOf(ending, maxLen - 1);
        if (idx >= minLen) {
          breakIndex = Math.max(breakIndex, idx + 1);
        }
      }
      if (breakIndex <= 0) {
        const clauseBreaks = SENTENCE_CHUNKING_CONFIG.CLAUSE_BREAKS;
        for (const br of clauseBreaks) {
          const idx = remaining.lastIndexOf(br, maxLen - 1);
          if (idx >= minLen) {
            breakIndex = Math.max(breakIndex, idx + 1);
          }
        }
      }
      if (breakIndex > 0) {
        sentences.push(remaining.substring(0, breakIndex).trim());
        remaining = remaining.substring(breakIndex).trim();
        continue;
      }
      sentences.push(remaining.substring(0, maxLen).trim());
      remaining = remaining.substring(maxLen).trim();
      continue;
    }

    sentences.push(remaining);
    break;
  }

  return sentences.filter(s => s.length > 0);
}

/**
 * Architect Message Types for bidirectional communication
 * Daniela can send different types of messages to the Architect/Claude
 */
interface ArchitectMessage {
  type: 'question' | 'suggestion' | 'observation' | 'request';
  content: string;
  urgency?: 'low' | 'medium' | 'high';
}

/**
 * Detect and extract [TO_ARCHITECT: message] tags from Daniela's responses
 * Uses balanced bracket matching to handle nested brackets in payloads
 * 
 * Supports multiple formats:
 * - [TO_ARCHITECT: message] - Simple format (becomes 'observation')
 * - [TO_ARCHITECT type="question": message] - With type
 * - [TO_ARCHITECT type="suggestion" urgency="high": message] - Full format
 * 
 * Returns: Array of messages extracted, and text with tags stripped (preserving original whitespace)
 */
function extractArchitectMessages(text: string): { messages: ArchitectMessage[]; cleanedText: string } {
  const messages: ArchitectMessage[] = [];
  let cleanedText = text;
  
  // Find all [TO_ARCHITECT ...] blocks using balanced bracket matching
  let searchStart = 0;
  while (true) {
    const tagStart = cleanedText.indexOf('[TO_ARCHITECT', searchStart);
    if (tagStart === -1) break;
    
    // Find the matching closing bracket using bracket counting
    let bracketCount = 0;
    let tagEnd = -1;
    for (let i = tagStart; i < cleanedText.length; i++) {
      if (cleanedText[i] === '[') bracketCount++;
      else if (cleanedText[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          tagEnd = i;
          break;
        }
      }
    }
    
    if (tagEnd === -1) {
      // No matching bracket found, skip
      searchStart = tagStart + 1;
      continue;
    }
    
    // Extract the full tag content
    const fullTag = cleanedText.substring(tagStart, tagEnd + 1);
    const innerContent = fullTag.substring('[TO_ARCHITECT'.length, fullTag.length - 1);
    
    // Parse type and urgency attributes
    const typeMatch = innerContent.match(/type="(question|suggestion|observation|request)"/i);
    const urgencyMatch = innerContent.match(/urgency="(low|medium|high)"/i);
    
    // Find the colon that separates attributes from message
    const colonIndex = innerContent.indexOf(':');
    if (colonIndex !== -1) {
      const messageContent = innerContent.substring(colonIndex + 1).trim();
      const type = (typeMatch?.[1]?.toLowerCase() || 'observation') as ArchitectMessage['type'];
      const urgency = (urgencyMatch?.[1]?.toLowerCase() || 'medium') as ArchitectMessage['urgency'];
      
      messages.push({ type, content: messageContent, urgency });
    }
    
    // Remove the tag from cleaned text (preserve surrounding whitespace structure)
    cleanedText = cleanedText.substring(0, tagStart) + cleanedText.substring(tagEnd + 1);
    // Don't advance searchStart since we removed content
  }
  
  return { messages, cleanedText };
}

/**
 * Strip [TO_ARCHITECT: ...] tags from text (for TTS/display)
 * Uses balanced bracket matching - preserves original whitespace/newlines
 */
function stripArchitectMessages(text: string): string {
  const { cleanedText } = extractArchitectMessages(text);
  return cleanedText;
}

/**
 * Clean text for display by removing markdown, emotion tags, and other formatting
 * that should not appear in subtitles
 */
export function cleanTextForDisplay(text: string): string {
  // First check if the entire text is just JSON emotion data (AI sometimes outputs this at end)
  // Match patterns like: { "emotion": "happy" } or { emotion: "happy" }
  const jsonEmotionPattern = /^\s*\{\s*"?emotion"?\s*:\s*"?\w+"?\s*\}\s*$/i;
  if (jsonEmotionPattern.test(text.trim())) {
    return ''; // Return empty to skip this sentence entirely
  }
  
  // Strip architect messages first (internal, should not be spoken/displayed)
  text = stripArchitectMessages(text);
  
  // Strip COLLAB tags (Daniela's collaboration signals to Editor - invisible to students)
  // Pattern: [COLLAB:TYPE]content[/COLLAB]
  text = text.replace(/\[COLLAB:[A-Z_]+\][\s\S]*?\[\/COLLAB\]/gi, '');
  
  // Strip SELF_SURGERY tags (Daniela's neural network proposals - invisible to students)
  // Pattern: [SELF_SURGERY target="..." priority=... confidence=... content='...' ...]
  text = text.replace(/\[SELF_SURGERY[^\]]*\]/gi, '');
  
  // Strip VOICE_ADJUST tags (voice control commands - should affect TTS settings, not be spoken)
  // Pattern 1: [VOICE_ADJUST speed="normal" emotion="friendly" personality="warm"]
  text = text.replace(/\[VOICE_ADJUST[^\]]*\]/gi, '');
  // Pattern 2: voice_adjust{...} - malformed curly brace format (seen in production)
  text = text.replace(/voice_adjust\s*\{[^}]*\}/gi, '');
  // Pattern 3: { voice_adjust"": {...} } or { "voice_adjust": {...} } - JSON-like format
  text = text.replace(/\{\s*"?voice_adjust"?\s*"*:\s*\{[^}]*\}\s*\}/gi, '');
  // Pattern 4: voice_adjust: { emotion: "...", ... } - inline JSON-like
  text = text.replace(/voice_adjust\s*:\s*\{[^}]*\}/gi, '');
  // Pattern 5: <ctrl46> artifacts from tokenization issues
  text = text.replace(/<ctrl\d+>/gi, '');
  // Pattern 6: voice_adjust(...) - native function call syntax spoken as text
  text = text.replace(/voice_adjust\s*\([^)]*\)/gi, '');
  
  // Strip VOICE_RESET tags (voice reset commands - internal, not spoken)
  // Pattern: [VOICE_RESET] or [VOICE_RESET reason="..."]
  text = text.replace(/\[VOICE_RESET[^\]]*\]/gi, '');
  // Pattern 2: voice_reset{...} or voice_reset: {...} - malformed formats
  text = text.replace(/voice_reset\s*[:\{][^}]*\}?/gi, '');
  
  // Strip SUBTITLE control tags (UI commands - should affect display, not be spoken)
  // Pattern 1: [SUBTITLE off|on|target] with optional trailing attributes like reason="..."
  text = text.replace(/\[SUBTITLE\s+(?:off|on|target|all)\s*\](?:\s*(?:reason|reasoning|text)\s*=\s*"[^"]*"\s*)*/gi, '');
  // Pattern 1b: [SUBTITLE on] ... [/SUBTITLE] block format (strip entire block)
  text = text.replace(/\[SUBTITLE\s+[^\]]*\][\s\S]*?\[\/SUBTITLE\]/gi, '');
  // Pattern 1c: Bare SUBTITLE with attributes (no closing bracket matched above)
  text = text.replace(/\[SUBTITLE\s+[^\]]*\]/gi, '');
  // Pattern 1d: Orphaned SUBTITLE",} or SUBTITLE",reasoning="..." fragments
  text = text.replace(/SUBTITLE"\s*,?\s*\}?\s*(?:reasoning\s*=\s*"[^"]*")?/gi, '');
  // Pattern 2: { subtitle: { mode: "...", text: "..." } } - JSON-like format
  text = text.replace(/\{\s*subtitle\s*:\s*\{[^}]*\}\s*\}/gi, '');
  // Pattern 3: subtitle: { mode: "...", ... } - inline format
  text = text.replace(/subtitle\s*:\s*\{[^}]*\}/gi, '');
  // Pattern 4: { subtitle"": {...} } - malformed quotes format
  text = text.replace(/\{\s*subtitle"*\s*:\s*\{[^}]*\}\s*\}/gi, '');
  // Pattern 5: subtitle(...) - native function call syntax spoken as text
  text = text.replace(/subtitle\s*\([^)]*\)/gi, '');
  
  // Catch-all: Strip any Daniela function name spoken as text with parentheses
  // Matches patterns like: play_audio({...}), show_image({...}), phase_shift({...}), etc.
  // IMPORTANT: This list MUST include ALL functions from gemini-function-declarations.ts
  const functionNames = [
    'voice_adjust', 'voice_reset', 'subtitle', 'play_audio', 'show_image', 'generate_visual',
    'compose_visual_scene', 'search_visual_library', 'get_scene_zones',
    'show_overlay', 'hide_overlay', 'clear_whiteboard', 'word_emphasis', 'hold_whiteboard',
    'phase_shift', 'milestone', 'take_note', 'drill', 'express_lane_lookup',
    'switch_tutor', 'actfl_update', 'syllabus_progress', 'call_support', 'call_assistant',
    'request_text_input', 'memory_lookup', 'recall_express_lane_image', 'express_lane_post',
    'hive_suggestion', 'self_surgery', 'write', 'grammar_table', 'compare', 'word_map',
    'phonetic', 'culture', 'context', 'scenario', 'summary', 'reading', 'stroke', 'tone',
    'pronunciation_tag', 'first_meeting_complete',
  ];
  for (const fnName of functionNames) {
    // Pattern 1: function_name({...}) or function_name({nested {...}}) - handle nested braces
    text = text.replace(new RegExp(fnName + '\\s*\\(\\{[\\s\\S]*?\\}\\)', 'gi'), '');
    // Pattern 2: function_name(...) - simple parentheses (no braces)
    text = text.replace(new RegExp(fnName + '\\s*\\([^)]*\\)', 'gi'), '');
    // Pattern 3: function_name: {...} - colon-object format
    text = text.replace(new RegExp(fnName + '\\s*:\\s*\\{[^}]*\\}', 'gi'), '');
    // Pattern 4: function_name{...} - direct brace format
    text = text.replace(new RegExp(fnName + '\\s*\\{[^}]*\\}', 'gi'), '');
  }
  
  // Strip bare function names that are compound underscore terms (safe — won't appear in natural speech)
  // These are internal system function names that should NEVER be spoken aloud
  const safeToStripBare = [
    'voice_adjust', 'voice_reset', 'play_audio', 'show_image', 'generate_visual',
    'compose_visual_scene', 'search_visual_library', 'get_scene_zones',
    'show_overlay', 'hide_overlay', 'clear_whiteboard', 'word_emphasis', 'hold_whiteboard',
    'phase_shift', 'take_note', 'switch_tutor', 'actfl_update',
    'syllabus_progress', 'call_support', 'call_assistant', 'request_text_input',
    'memory_lookup', 'recall_express_lane_image', 'express_lane_lookup',
    'express_lane_post', 'hive_suggestion', 'self_surgery', 'grammar_table',
    'word_map', 'pronunciation_tag', 'first_meeting_complete',
  ];
  for (const fnName of safeToStripBare) {
    text = text.replace(new RegExp('\\b' + fnName + '\\b', 'gi'), '');
  }
  
  // Strip legacy startcall/endcall format from older Gemini responses
  // Pattern: startcall:default_api:voice_adjust{...}end
  text = text.replace(/startcall:[^}]*\}?end/gi, '');
  text = text.replace(/\bstartcall\b/gi, '');
  text = text.replace(/\bendcall\b/gi, '');
  
  // Ultra catch-all: Strip any remaining word_word(...) pattern that looks like a function call
  // This catches new functions added in the future that aren't in the list above
  text = text.replace(/\b[a-z_]{2,30}\s*\(\s*\{[\s\S]*?\}\s*\)/g, '');
  // Also catch FUNCTION CALL: prefix that might leak from tool_knowledge docs
  // Pattern 1: Full "FUNCTION CALL: func_name(...)" 
  text = text.replace(/FUNCTION\s+CALL\s*:\s*\w+\s*\([^)]*\)/gi, '');
  // Pattern 2: Orphaned "FUNCTION CALL:" prefix (left behind after per-function regexes strip the call)
  text = text.replace(/FUNCTION\s+CALL\s*:?\s*/gi, '');
  
  // Strip MEMORY_LOOKUP tags (internal command triggers - should not be spoken)
  // Pattern: MEMORY_LOOKUP query="..." domains="..." (with or without brackets)
  text = text.replace(/\[?MEMORY_LOOKUP[^\]]*\]?/gi, '');
  // Pattern 2: memory_lookup query=... domains=... (lowercase, no brackets)
  text = text.replace(/memory_lookup\s+query\s*=\s*"[^"]*"\s*domains?\s*=\s*"[^"]*"/gi, '');
  
  // Strip SHOW/HIDE whiteboard control tags (UI commands - processed by function calls)
  // Pattern 1: [SHOW text="..."] or SHOW text="..."]  (with or without opening bracket)
  text = text.replace(/\[?SHOW\s+text\s*=\s*"[^"]*"\s*\]?/gi, '');
  // Pattern 2: [HIDE] or [HIDE text]
  text = text.replace(/\[HIDE[^\]]*\]/gi, '');
  
  // Strip WORD_EMPHASIS control tags (UI commands - processed by function calls)
  // Pattern 1: [WORD_EMPHASIS word="..." style="..."] or WORD_EMPHASIS word="..."] (malformed)
  text = text.replace(/\[?WORD_EMPHASIS\s+[^\]]*\]?/gi, '');
  // Pattern 2: word_emphasis{...} - curly brace format
  text = text.replace(/word_emphasis\s*\{[^}]*\}/gi, '');
  
  // Strip OBSERVE tags (Daniela's teaching observations for office hours - invisible to students)
  // Pattern: [OBSERVE reason="..." note="..."]
  text = text.replace(/\[OBSERVE[^\]]*\]/gi, '');
  
  // Strip SELF_LEARN tags (Daniela's autonomous neural network writes - invisible to students)
  // Pattern: [SELF_LEARN category="..." insight="..." context="..."]
  text = text.replace(/\[SELF_LEARN[^\]]*\]/gi, '');
  
  // Strip content growth tags (Daniela's pedagogical content creation - invisible to students)
  text = text.replace(/\[SAVE_IDIOM[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_NUANCE[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_ERROR_PATTERN[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_BRIDGE[^\]]*\]/gi, '');
  text = text.replace(/\[SAVE_DIALECT[^\]]*\]/gi, '');
  // Note: SAVE_CULTURAL_TIP not stripped - culturalTips table lacks sync fields
  
  // Strip KNOWLEDGE_PING tags
  text = text.replace(/\[KNOWLEDGE_PING[^\]]*\]/gi, '');
  
  // Strip WREN_SPRINT_SUGGEST tags (Daniela's sprint suggestions to Wren - invisible to students)
  // Pattern: [WREN_SPRINT_SUGGEST: {...JSON...}] or [WREN_SPRINT_SUGGEST title="..." ...]
  text = text.replace(/\[WREN_SPRINT_SUGGEST[:\s][^\]]*\]/gi, '');
  
  // Strip WREN_MESSAGE tags (Daniela's direct messages to Wren via Express Lane)
  // Pattern: [WREN_MESSAGE: content here] or [WREN_MESSAGE content="..."]
  text = text.replace(/\[WREN_MESSAGE[:\s][^\]]*\]/gi, '');
  
  // Strip ACTION_TRIGGERS XML blocks (JSON command format - invisible to students)
  // Pattern: <ACTION_TRIGGERS>{"commands":[...]}</ACTION_TRIGGERS>
  text = text.replace(/<ACTION_TRIGGERS>[\s\S]*?<\/ACTION_TRIGGERS>/gi, '');
  
  // Strip internal notes/reasoning fragments that Gemini sometimes leaks
  // These are fragments of structured output that shouldn't be spoken
  // Patterns: reasoning="...", priority=\d+, confidence=\d+ (attribute format)
  text = text.replace(/\breasoning\s*=\s*"[^"]*"/gi, '');
  text = text.replace(/\bpriority\s*=\s*\d+/gi, '');
  text = text.replace(/\bconfidence\s*=\s*[\d.]+/gi, '');
  // Also handle JSON format: "priority":90, "confidence":95, "reasoning":"..."
  text = text.replace(/"priority"\s*:\s*\d+\s*,?/gi, '');
  text = text.replace(/"confidence"\s*:\s*[\d.]+\s*,?/gi, '');
  text = text.replace(/"reasoning"\s*:\s*"[^"]*"\s*,?/gi, '');
  // Strip JSON command type fragments: "type":"SELF_SURGERY", "target":"..."
  text = text.replace(/"type"\s*:\s*"[A-Z_]+"\s*,?/gi, '');
  text = text.replace(/"target"\s*:\s*"[^"]*"\s*,?/gi, '');
  text = text.replace(/"content"\s*:\s*'[^']*'\s*,?/gi, '');
  text = text.replace(/"content"\s*:\s*"[^"]*"\s*,?/gi, '');
  // Strip "commands": array wrappers and stray JSON structure
  text = text.replace(/"commands"\s*:\s*\[\s*/gi, '');
  text = text.replace(/\{\s*"commands"\s*:/gi, '');
  text = text.replace(/^\s*\{\s*\}\s*$/g, '');  // Empty JSON objects
  // Strip JSON-like artifacts (closing brackets from malformed structures)
  text = text.replace(/^\s*\]\s*\}?\s*'?\s*/g, '');
  text = text.replace(/\s*\]\s*\}?\s*'?\s*$/g, '');
  // Strip orphaned opening/closing brackets from split tags (when [TAG attr="..."] spans sentences)
  // After stripping attributes above, we may be left with just "]" or "[" at start/end
  text = text.replace(/^\s*[\[\]]+\s*/g, '');  // Strip leading [ or ] brackets
  text = text.replace(/\s*[\[\]]+\s*$/g, '');  // Strip trailing [ or ] brackets
  // Strip lines that are clearly internal instructions (imperative verbs for AI)
  text = text.replace(/^Simulate\s+internal\b[^.]*\./gi, '');
  text = text.replace(/^Optionally,?\s+(?:offer|provide|include|add)\b[^.]*\./gi, '');
  text = text.replace(/^Internally,?\s+(?:process|handle|execute|trigger)\b[^.]*\./gi, '');
  text = text.replace(/^user\s+of\s+the\s+transition\b[^.]*\./gi, '');
  
  // First strip all whiteboard markup (WRITE, DRILL, SWITCH_TUTOR, etc.)
  // This must happen before other cleaning to ensure markup doesn't appear in TTS
  let cleaned = stripWhiteboardMarkup(text)
    // Remove code blocks (```language\ncode\n```) - extract just the code content without backticks
    // Code blocks should not be spoken aloud at all in voice sessions
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '')
    // Remove inline code backticks (`code`) - keep the text but remove backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove any remaining stray backticks
    .replace(/`/g, '')
    // Remove action/emotion tags like *laughs softly*, *chuckles*, *sighs*, *smiles warmly*, etc.
    // These should be emoted by the voice, not spoken aloud
    // Must happen BEFORE stripping individual asterisks
    .replace(/\*(?:laughs?|chuckles?|giggles?|sighs?|smiles?|grins?|nods?|pauses?|clears? throat|ahem|winks?|gasps?|whispers?|exclaims?|thinks?|considers?|reflects?|ponders?)(?:\s+\w+)*\*/gi, '')
    // Remove markdown bold/italic markers
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/##/g, '')
    .replace(/#/g, '')
    // Remove empty quote pairs that Gemini sometimes outputs at sentence starts
    .replace(/^["'"']+\s*/g, '')  // Leading quotes
    .replace(/\s*["'"']+$/g, '')  // Trailing quotes
    .replace(/["'"']{2,}/g, '')   // Multiple consecutive quotes (empty pairs)
    // Remove stray quotes that aren't part of meaningful text
    // Be careful not to remove apostrophes in contractions like "it's" or "you're"
    .replace(/"\s+/g, ' ')  // Quote followed by space → just space
    .replace(/\s+"/g, ' ')  // Space followed by quote → just space
    // Remove emotion tags like (friendly), (curious), (excited), etc at start/end
    .replace(/^\s*\([^)]+\)\s*/g, '')
    .replace(/\s*\([^)]+\)\s*$/g, '')
    // Also remove mid-text emotion tags
    .replace(/\s*\((?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\)\s*/gi, ' ')
    // Remove [laughter] tags for display
    .replace(/\[laughter\]/gi, '')
    // Remove [ADOPT_INSIGHT:uuid] markers - internal tracking, not for display
    .replace(/\[ADOPT_INSIGHT:[a-f0-9-]+\]/gi, '')
    // Remove [bracket] emotion/action tags like [happy], [excited]
    .replace(/\[(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\]/gi, '')
    // Remove BARE emotion words at start of text (AI sometimes outputs "happy\n" or "friendly**text**")
    // Must be at the very start, optionally followed by punctuation, whitespace/newline, or ** (markdown)
    // Handles: "friendly\n", "friendly ", "friendly**Excelente**", "happyHola", "Happy! That was..."
    .replace(/^(?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)[!.,;:?]*(?:[\s\n\r]+|\*\*)?/gi, '')
    // Remove BARE action phrases at start of text (AI sometimes outputs "laughs softly It's..." without asterisks)
    // Catches: "laughs softly", "chuckles", "sighs contentedly", "smiles warmly", etc.
    .replace(/^(?:laughs?|chuckles?|giggles?|sighs?|smiles?|grins?|nods?|pauses?|clears? throat|ahem|winks?|gasps?|whispers?|exclaims?|thinks?|considers?|reflects?|ponders?)(?:\s+\w+)*\s+/gi, '');
  
  // Remove ALL parenthetical content (English translations like (Hello!), (Excellent!), (Perfect!))
  // These are distracting and redundant - the user heard the Spanish and doesn't need English in subtitles
  let prevCleaned = '';
  while (cleaned !== prevCleaned) {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(/\s*\([^()]*\)\s*/g, ' ');
  }
  
  // Convert ALL CAPS common words to lowercase to prevent TTS from spelling them out as acronyms.
  // Gemini uses caps for emphasis (e.g. "I will ASK you a question") but TTS engines interpret
  // short all-caps words as acronyms and spell each letter: "A-S-K".
  // Preserve legitimate acronyms (ACTFL, SSML, etc.) by only lowering known common words.
  const commonWordsUpperSet = new Set([
    'ASK', 'ASKED', 'ASKING', 'ASKS',
    'TELL', 'TOLD', 'TELLING', 'TELLS',
    'SAY', 'SAID', 'SAYING', 'SAYS',
    'WILL', 'WOULD', 'COULD', 'SHOULD', 'SHALL', 'CAN', 'MAY', 'MIGHT', 'MUST',
    'AND', 'BUT', 'THE', 'FOR', 'NOT', 'ALL', 'ARE', 'WAS', 'HAS', 'HAD', 'HER', 'HIS',
    'YOU', 'YOUR', 'YOURS',
    'NOW', 'THEN', 'WHEN', 'WHAT', 'HOW', 'WHY', 'WHO', 'WHERE', 'WHICH',
    'LET', 'LETS', 'GET', 'GETS', 'GOT', 'SET', 'PUT', 'RUN', 'TRY',
    'FIRST', 'NEXT', 'LAST', 'NEW', 'OLD', 'BIG', 'GOOD', 'GREAT', 'BEST',
    'VERY', 'JUST', 'ALSO', 'ONLY', 'EVEN', 'STILL', 'ALREADY', 'ALWAYS', 'NEVER',
    'YES', 'OKAY', 'SURE', 'RIGHT', 'WELL', 'READY', 'DONE', 'BACK',
    'MAKE', 'TAKE', 'GIVE', 'COME', 'LOOK', 'THINK', 'KNOW', 'WANT', 'NEED',
    'LIKE', 'LOVE', 'HELP', 'SHOW', 'HEAR', 'LISTEN', 'READ', 'WRITE', 'SPEAK',
    'TALK', 'LEARN', 'PRACTICE', 'REPEAT', 'REMEMBER', 'ANSWER',
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE',
    'HERE', 'THERE', 'THIS', 'THAT', 'THESE', 'THOSE',
    'SAME', 'EACH', 'BOTH', 'MORE', 'MOST', 'SOME', 'MANY', 'MUCH',
    'WITH', 'FROM', 'INTO', 'OVER', 'ABOUT', 'AFTER', 'BEFORE',
    'TURN', 'ROLE', 'PLAY', 'GAME', 'WORD', 'WORDS', 'TIME',
  ]);
  cleaned = cleaned.replace(/\b[A-Z]{2,}\b/g, (match) => {
    if (commonWordsUpperSet.has(match)) {
      return match.toLowerCase();
    }
    return match;
  });

  // Normalize whitespace and clean up residual punctuation
  return cleaned
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')  // Trim leading/trailing commas, periods, spaces
    .trim();
}

/**
 * Apply word emphasis SSML tags to text for Cartesia TTS
 * 
 * Cartesia Sonic-3 supports inline SSML-like tags:
 * - <volume ratio="2"/> for emphasis (louder)
 * - <speed ratio="1"/> for slower speech (can't use decimals in streaming)
 * 
 * IMPORTANT: Per Cartesia docs, decimal ratios can get split during streaming.
 * We use integer values only (1, 2) to avoid this issue.
 * 
 * @param text - The text to process
 * @param emphases - Array of {word, style} emphasis instructions
 * @returns Text with SSML tags injected around emphasized words
 */
export function applyWordEmphases(
  text: string,
  emphases: Array<{ word: string; style: 'stress' | 'slow' | 'both' }> | undefined
): string {
  if (!emphases || emphases.length === 0) {
    return text;
  }
  
  let processedText = text;
  
  for (const emphasis of emphases) {
    const { word, style } = emphasis;
    if (!word) continue;
    
    // Create case-insensitive regex to find the word
    // Use word boundaries to avoid partial matches
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
    
    // Build SSML tags based on style
    // NOTE: Using integer ratios only (2, not 1.5) to avoid streaming split issues
    let prefix = '';
    let suffix = '';
    
    switch (style) {
      case 'stress':
        // Louder volume for emphasis - Cartesia uses wrapping tags
        prefix = '<volume level="2">';
        suffix = '</volume>';
        break;
      case 'slow':
        // Slower speed for clear pronunciation
        prefix = '<speed ratio="0.7">';
        suffix = '</speed>';
        break;
      case 'both':
        // Both slower AND louder for maximum emphasis
        prefix = '<pause duration="0.1"/><speed ratio="0.7"><volume level="2">';
        suffix = '</volume></speed><pause duration="0.1"/>';
        break;
    }
    
    // Replace the word with emphasized version (preserving original case)
    processedText = processedText.replace(regex, `${prefix}$1${suffix}`);
    console.log(`[WordEmphasis] Applied "${style}" to "${word}" in text`);
  }
  
  return processedText;
}
