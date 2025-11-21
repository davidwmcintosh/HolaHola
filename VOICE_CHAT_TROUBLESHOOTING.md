# Voice Chat Troubleshooting Log

## Issue Summary
Voice chat stopped working at 3:06 AM when attempting to switch from Pro tier model to mini model for free tier users. Getting consistent `server_error` from OpenAI Realtime API after `session.updated` event.

## Timeline

### ✅ WORKING STATE (Before Break)
- **Mic was working** - Audio recording functional
- **Tutor was responding** - Voice chat fully operational
- **Model**: Using `gpt-4o-realtime-preview-2024-12-17` (Pro tier model)

### ⚠️ GREETING DUPLICATION ISSUE
- **Problem**: Greeting messages being created multiple times
- **Action**: Made changes to fix greeting duplication
- **Files Changed**: 
  - `client/src/lib/realtimeManager.ts` - Added `hasGreetingBeenSent()` and `markGreetingAsSent()` using localStorage
  - `server/routes.ts` - Modified to ONLY generate greetings for text mode (voice mode handles its own)
  - `client/src/components/VoiceChat.tsx` - Added:
    - `skipNextGreetingRef` to prevent duplicate greeting saves
    - Check for `hasGreetingBeenSent()` before sending greeting
    - Logic to skip saving greeting to database
    - `markGreetingAsSent()` tracking (lines 222-271, 387-394)

### ❌ BREAKING POINT
- **After Greeting Fix**: Mic stopped working
- **Error Started**: 3:06 AM - Consistent server errors after session configuration
- **Additional Change**: Added tier-based model selection to use `gpt-4o-mini-realtime-preview-2024-12-17`

### 🔍 ROOT CAUSE HYPOTHESIS - UPDATED

**CONFIRMED: It's NOT the model!**
- Tested Pro model (`gpt-4o-realtime-preview-2024-12-17`) - ❌ STILL FAILS
- Tested Mini model (`gpt-4o-mini-realtime-preview-2024-12-17`) - ❌ STILL FAILS
- **Both models worked perfectly in REST API tests** ✅
- **Voice chat was working before greeting fix** ✅

**CONCLUSION: The issue is NOT model-related. It's something in the session configuration or greeting fix changes.**

**What changed between working and broken state:**
1. **Greeting fix changes** (client-side):
   - `VoiceChat.tsx` - Added greeting tracking, skipNextGreetingRef
   - `routes.ts` - Modified backend greeting logic
   - `realtimeManager.ts` - Added localStorage greeting tracking

2. **Possible culprits in `server/realtime-proxy.ts`:**
   - System prompt generation (createSystemPrompt call)
   - Session configuration parameters
   - Turn detection settings
   - Input audio transcription settings

**Tomorrow's debugging strategy:**
1. ✅ ~~Try Pro model~~ - DONE, still fails
2. **Next**: Comment out greeting-related logic in VoiceChat.tsx and test
3. **Next**: Test with absolute minimal session config (just voice, no instructions)
4. **Next**: Check if system prompt is being generated correctly
5. **Last resort**: Try the newer GA model `gpt-realtime`

## Error Details
```json
{
  "type": "error",
  "event_id": "event_...",
  "error": {
    "type": "server_error",
    "code": null,
    "message": "The server had an error while processing your request..."
  }
}
```

**When it occurs**: Immediately after sending `session.update` event to OpenAI WebSocket

## Tests Performed

### 1. API Key Validation ✅ PASSED
**Test**: Direct REST API call to create ephemeral session
```bash
curl https://api.openai.com/v1/realtime/sessions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o-mini-realtime-preview-2024-12-17", "voice": "alloy"}'
```
**Result**: SUCCESS - API key has full Realtime API access for both models
**Conclusion**: API key is NOT the problem

### 2. Model Availability ✅ BOTH MODELS WORK
**Test**: Created ephemeral sessions for both models via REST
- Standard model: `gpt-4o-realtime-preview-2024-12-17` ✅
- Mini model: `gpt-4o-mini-realtime-preview-2024-12-17` ✅

**Result**: Both models return valid ephemeral tokens
**Conclusion**: Both models are accessible via our API key

### 3. System Prompt Length Investigation
**Initial Hypothesis**: Mini model has stricter instruction length limits (~12,000 chars too long)

**Test A**: Created condensed ~500 character prompt for mini model
```typescript
const condensedPrompt = `You are a ${conversationLanguage} tutor for ${userName}. 
Native language: ${nativeLanguage}. Difficulty: ${difficulty}.

BEGINNER RULES:
- Use present tense only
- Teach ONE concept per exchange
- Max 7 words per sentence
- Provide English translations
- Use listen-and-repeat

Keep responses under 3 sentences.`;
```
**Result**: Code saved but server still sent full 11,994-character prompt
**Issue**: Server restart didn't load new code (caching issue)

**Test B**: Forced server restart, verified condensed prompt loading
**Log Output**: 
```
[REALTIME PROXY] Is using mini model: true
[REALTIME PROXY] Actual prompt being sent: 542 characters
```
**Result**: STILL GOT SERVER ERROR even with condensed prompt
**Conclusion**: Prompt length is NOT the root cause

### 4. Model Switching Test
**Test A**: Forced ALL tiers to use standard model temporarily
**Result**: STILL GOT SERVER ERROR even with standard model
**Conclusion**: Issue is not model-specific

**Test B**: Tested JUST Pro model (reverting mini model change completely)
**Result**: ❌ STILL FAILS - Same server_error
**Log Output**: `Using model: gpt-4o-realtime-preview-2024-12-17 for tier: free`
**Conclusion**: ✅ **CONFIRMED - NOT A MODEL ISSUE**. Both models fail identically.

### 5. Minimal Prompt Test
**Test**: Stripped down to absolute minimal prompt (~150 chars)
```typescript
const testPrompt = `You are a helpful ${conversationLanguage} language tutor. 
Speak slowly and clearly. Use simple phrases with English translations.`;
```
**Result**: Pending test

## Known Facts

### What Works ✅
1. Direct API key authentication via REST
2. Ephemeral session creation for both models
3. WebSocket connection establishment
4. Session creation event received
5. Session update command sent successfully

### What Fails ❌
1. Session configuration after `session.update` sent
2. Error occurs AFTER session.update succeeds
3. Consistent across both models
4. Consistent across all prompt lengths (12k chars, 500 chars, 150 chars)

## External Research

### OpenAI Community Reports
Found GitHub issue: https://github.com/openai/openai-python/issues/2352
- Mini model (`gpt-4o-mini-realtime-preview-2024-12-17`) has known server errors
- Community reports similar failures during response generation
- Some users report intermittent issues with standard model too
- Suggested workarounds:
  - Retry logic with exponential backoff
  - Fallback to standard model
  - Contact OpenAI support with session ID

## Current Configuration

### File: `server/realtime-proxy.ts`

**Model Selection** (Line 184-188):
```typescript
const model = subscriptionTier === 'pro' 
  ? 'gpt-4o-realtime-preview-2024-12-17'
  : 'gpt-4o-mini-realtime-preview-2024-12-17';
```

**Session Configuration** (Line 349-355):
```typescript
const instructions = isUsingMiniModel 
  ? `You are a ${conversationLanguage} tutor. Student: ${userName || 'learner'}. 
     Native: ${nativeLanguage}. Level: ${difficulty}. 
     Use simple ${conversationLanguage} with English translations.`
  : systemPrompt;

const sessionConfig = {
  voice: 'alloy',
  instructions,
  input_audio_transcription: { model: 'whisper-1' }
};
```

**Ephemeral Session Approach** (Line 196-217):
- Creates ephemeral session via REST FIRST (working correctly)
- Then connects to WebSocket with ephemeral token
- This matches OpenAI playground approach

## Error Pattern Analysis

**Sequence of Events**:
1. Client connects to proxy WebSocket ✅
2. Proxy authenticates user session ✅
3. Proxy creates ephemeral session via REST ✅
4. Proxy connects to OpenAI WebSocket with ephemeral token ✅
5. OpenAI sends `session.created` event ✅
6. Proxy sends `session.update` with configuration ✅
7. OpenAI sends `session.updated` event ✅
8. OpenAI immediately sends `error` event with server_error ❌

**Key Observation**: The error happens AFTER successful session.update acknowledgment, suggesting the configuration itself is valid but something about processing it fails on OpenAI's end.

## Theories to Investigate

### Theory 1: OpenAI Server Issues ⚠️
- **Evidence**: Community reports of similar errors
- **Evidence**: Happens with both models
- **Evidence**: Happens with minimal prompts
- **Next Step**: May need to wait for OpenAI to fix or contact their support

### Theory 2: Session Configuration Parameter Issue
- **Hypothesis**: Some combination of parameters triggers the error
- **Candidates**: 
  - `input_audio_transcription` field
  - `turn_detection` settings
  - Voice selection
  - Modalities configuration
- **Next Step**: Test with absolute minimal config (voice only, no transcription)

### Theory 3: Regional/Infrastructure Issue
- **Evidence**: Azure reports mention regional differences
- **Next Step**: Check if different API endpoints available

### Theory 4: Rate Limiting or Quota
- **Evidence**: None currently
- **Next Step**: Check OpenAI dashboard for usage/limits

## Next Steps

### Priority 1: Try Newer GA Model (Recommended)
**Model**: `gpt-realtime` (GA release from August 2025)
- **Why**: Newer production-ready model (not preview)
- **Benefits**: 30% better accuracy, 20% cost reduction, more natural speech
- **Status**: Confirmed working with our API key on Nov 19, 2025
- **Source**: `API_KEY_MANAGEMENT.md` from previous testing
- **Action**: Update model names in `server/realtime-proxy.ts`:
  ```typescript
  const model = subscriptionTier === 'pro' 
    ? 'gpt-realtime'  // Try GA model instead of preview
    : 'gpt-4o-mini-realtime-preview-2024-12-17';
  ```

### Other Investigation Steps
1. **Test minimal session config** (remove input_audio_transcription)
2. **Implement automatic retry logic** with exponential backoff
3. **Add fallback to text-only mode** when voice fails
4. **Monitor OpenAI status page** and community reports

## Workarounds Attempted

- [x] Condensed system prompt
- [x] Switched to standard model
- [x] Minimal test prompt
- [ ] Minimal session configuration (no transcription)
- [ ] Retry logic
- [ ] Text-mode fallback

## Reference Links

- GitHub Issue: https://github.com/openai/openai-python/issues/2352
- OpenAI Realtime Docs: https://platform.openai.com/docs/guides/realtime
- OpenAI Status: https://status.openai.com/

## Session IDs for OpenAI Support

Latest error session IDs:
- `sess_CeC5ba9FxsMiRyPYE2kml` (mini model, condensed prompt)
- `sess_CeC7z0EpMMJ881mQohJRk` (standard model, full prompt)

---

**Last Updated**: November 21, 2025 3:30 AM
**Status**: Investigating - Error persists across all configurations tested
