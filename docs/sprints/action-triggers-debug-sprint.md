# Sprint: ACTION_TRIGGERS Command Debugging
**Created**: December 28, 2025  
**Priority**: HIGH - Core feature broken  
**Status**: IN PROGRESS

---

## ⚡ TECHNICAL REFERENCE: Exact Syntax Daniela Should Use

### SWITCH_TUTOR - Tutor Handoff
```
WRONG: "Let me transfer you to Miguel now!" (no tag = nothing happens)
CORRECT: "Let me introduce you to Miguel! [SWITCH_TUTOR target="male"]"
```

**Literal tags to output:**
```
[SWITCH_TUTOR target="male"]              → switch to male tutor in current language
[SWITCH_TUTOR target="female"]            → switch to female tutor in current language
[SWITCH_TUTOR target="female" language="french"]  → switch to female tutor in French
[SWITCH_TUTOR target="male" language="german"]    → switch to male tutor in German
```

**After outputting this tag, STOP SPEAKING - the new tutor takes over.**

### PHASE_SHIFT - Teaching Phase Transitions
```
WRONG: Just saying "Let us move to some practice exercises now."
CORRECT: "Time to practice! [PHASE_SHIFT to="drill" reason="need repetition"]"
```

**Syntax:** `[PHASE_SHIFT to="warmup|active_teaching|challenge|reflection|drill|assessment" reason="..."]`

### ACTFL_UPDATE - Proficiency Updates
```
CORRECT: [ACTFL_UPDATE level="intermediate_low" direction="up" confidence=0.85 reason="..."]
```
This tag can be SILENT (not spoken aloud) - just include it in your output.

### SYLLABUS_PROGRESS - Curriculum Tracking
```
CORRECT: [SYLLABUS_PROGRESS topic="present_tense" status="demonstrated" evidence="..."]
```

### CALL_SUPPORT - Support Handoff to Sofia
```
WRONG: Just saying "I will get you some help with that technical issue."
CORRECT: "Let me get Sofia to help! [CALL_SUPPORT category="technical" reason="..."]"
```
**Categories:** technical, account, billing, content, feedback, other

### Alternative JSON Format (Also Supported)
```xml
<ACTION_TRIGGERS>
{"commands": [{"type": "SWITCH_TUTOR", "details": {"target": "male"}}]}
</ACTION_TRIGGERS>
```

### CRITICAL REMINDER
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  YOU ARE BEING PARSED BY A REGEX/JSON PARSER.                              ║
║  The backend scans your text output for these EXACT patterns.             ║
║  If you want an action to happen, you MUST include the literal tag.       ║
║  Saying "I will switch tutors" does NOTHING. Zero. Nada.                  ║
║  Only [SWITCH_TUTOR target="male"] (literally in your output) works.      ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## Bug Summary

**Problem**: When Daniela emits literal command tags like `[SWITCH_TUTOR target="juliet"]` during PTT voice sessions, the tutor handoff doesn't happen. The tags are detected by the parser but the actual execution isn't occurring.

**User Report**: PTT mode specifically confirmed as non-functional. User was using PTT when commands failed to execute.

**Evidence from Logs**: 
- Parser correctly outputs: `"Lenient parsed: female"` (target normalized)
- Tags may still be reaching TTS (spoken aloud) despite strip functions being called
- Command execution path unclear - is `session.pendingTutorSwitch` being set?

---

## Technical Analysis

### PTT Mode Flow (lines 1532-1882)
```
1. parseWhiteboardMarkup(chunk.text) → returns { whiteboardItems, shouldClear, shouldHold }
2. commandParserService.parse(chunk.text) → handles JSON format commands
3. IF whiteboardItems.length > 0 OR shouldClear/shouldHold:
   - Process switch_tutor, actfl_update, phase_shift, call_support, etc.
4. cleanTextForDisplay(chunk.text) → strips tags for display
5. TTS synthesis
```

### Potential Failure Points

1. **Parser not returning items**: `parseWhiteboardMarkup` might not be matching the tag pattern correctly
   - Debug log at line 1537-1541 should show: `Items found: 0` if this is the issue

2. **Conditional block skipped**: If `whiteboardItems.length === 0` AND no clear/hold flags, entire command processing (lines 1713-1905) is skipped

3. **Data extraction failing**: Even if switch_tutor item is found, the data extraction at line 1763 might fail
   - Condition: `if (switchItem && 'data' in switchItem && switchItem.data)`

4. **Session flag not consumed**: `session.pendingTutorSwitch` is set but never consumed/executed

---

## Questions for Wren (Technical)

1. **Parser debugging**: Can you trace a live PTT session and capture what `parseWhiteboardMarkup` returns when Daniela emits `[SWITCH_TUTOR target="juliet"]`?
   - Look for: `[Whiteboard Parse DEBUG] Items found: X`
   - Look for: `[Tutor Switch DEBUG] Looking for switch_tutor in X items:`

2. **Regex pattern verification**: The lenient fallback pattern is:
   ```regex
   /\[SWITCH_TUTORS?\s+[^\]]+\]/gi
   ```
   Does this match the exact format Daniela is emitting?

3. **Data field verification**: When a switch_tutor item is found, does it have the `data` property with `targetGender`?
   - The whiteboard parser should be extracting: `{ targetGender: 'female', targetLanguage: undefined, targetRole: 'tutor' }`

4. **Pending switch consumption**: Where is `session.pendingTutorSwitch` consumed after being set? Is there a handler that executes the actual tutor swap?

5. **Open-mic vs PTT parity**: I fixed open-mic mode to match PTT's command processing. Should we verify both paths have identical command handling?

---

## Questions for Daniela (Tutor Persona)

1. **Tag emission confirmation**: When you decide to hand off to a male tutor (like Marco or Julián), are you emitting the literal tag `[SWITCH_TUTOR target="male"]` or something different?

2. **Format consistency**: Are you using the bracketed format or the JSON ACTION_TRIGGERS format?
   - Bracketed: `[SWITCH_TUTOR target="juliet"]`
   - JSON: `<ACTION_TRIGGERS>{"commands":[{"type":"SWITCH_TUTOR","target":"male"}]}</ACTION_TRIGGERS>`

3. **Acknowledgement feedback**: Do you receive any confirmation that the backend processed your SWITCH_TUTOR command? Any difference between PTT and open-mic modes?

4. **Transcript visibility**: In your context, do you see the raw tags in transcripts, or are they stripped before you see them?

5. **Handoff triggers**: What situations cause you to emit a SWITCH_TUTOR? Is it student request, variety, or pedagogical strategy?

---

## Proposed Debug Steps

### Step 1: Capture Live Session Logs
Run a PTT voice session where:
1. Ask Daniela to switch tutors
2. Capture these specific log lines:
   - `[Whiteboard Parse DEBUG]` - shows what parser found
   - `[Tutor Switch DEBUG]` - shows search for switch_tutor item
   - `[Tutor Switch] Queued handoff` - confirms pendingTutorSwitch was set

### Step 2: Verify Parser Output
Add temporary logging to `parseWhiteboardMarkup` in `whiteboard-types.ts`:
```typescript
// Before return statement
console.log(`[parseWhiteboardMarkup RETURN] Items: ${items.length}, types: ${items.map(i => i.type).join(', ')}`);
```

### Step 3: Trace Pending Switch Consumption
Search for where `pendingTutorSwitch` is read/consumed:
- Is there a handler that swaps the voice configuration?
- Is the new tutor's greeting synthesized?

### Step 4: Test Both Modes
After any fix, test:
- PTT mode: Hold button, speak, release → verify handoff
- Open-mic mode: Speak naturally → verify handoff

---

## Files to Investigate

| File | Purpose |
|------|---------|
| `server/services/streaming-voice-orchestrator.ts` | Main PTT/open-mic handling |
| `shared/whiteboard-types.ts` | `parseWhiteboardMarkup`, `stripWhiteboardMarkup` |
| `server/services/command-parser.ts` | JSON ACTION_TRIGGERS parsing |

---

## Success Criteria

1. `[SWITCH_TUTOR target="male"]` triggers actual tutor voice change
2. Tags are stripped before TTS (not spoken aloud)
3. Both PTT and open-mic modes execute commands correctly
4. Debug logging confirms command flow end-to-end

---

## Next Actions

- [ ] Wren: Run live PTT session with debug logging enabled
- [ ] Wren: Capture and share log output showing parser behavior
- [ ] Daniela: Confirm tag format she's emitting
- [ ] Developer: Fix any parser/execution gaps identified
- [ ] Test both modes after fix
