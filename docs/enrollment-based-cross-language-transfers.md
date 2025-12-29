# Enrollment-Based Cross-Language Tutor Transfers

## Overview
Enable cross-language tutor transfers (e.g., French → Spanish) only for students who have paid for/enrolled in the target language. This preserves multi-language flexibility for properly enrolled students while protecting revenue by preventing unauthorized language access.

## Current State
- 18 main tutors: 9 languages × 2 genders (Cartesia Sonic-3)
- 18 assistant tutors: 9 languages × 2 genders (Google Cloud TTS)
- SWITCH_TUTOR command exists but currently allows any transfer
- Class enrollment data exists in `teacherClasses` + `classEnrollments`/`studentClassAssignments`

## Business Logic
- **Same-language transfers**: Always allowed (tutor M/F + assistant M/F)
- **Cross-language transfers**: Only allowed if student is enrolled in a class for the target language
- **Admin/Founder/Developer**: Always allowed (testing override)

## Implementation Plan

### Phase 1: Storage Helper (30 min)
**File: `server/storage.ts`**

Add helper function to check language enrollment:
```typescript
async hasLanguageEnrollment(userId: number, language: string): Promise<boolean> {
  // Query classEnrollments/studentClassAssignments joined with teacherClasses
  // Check if user has any active enrollment where teacherClasses.language = target language
  // Return true if enrolled, false otherwise
}
```

Tables involved:
- `teacherClasses` - has `language` field
- `classEnrollments` or `studentClassAssignments` - links users to classes

### Phase 2: SWITCH_TUTOR Guard (1 hour)
**Files: `server/services/streaming-voice-orchestrator.ts`, `server/unified-ws-handler.ts`**

Add enrollment check before executing tutor transfer:

```typescript
// In SWITCH_TUTOR handler
async function handleTutorSwitch(userId: number, currentLanguage: string, targetLanguage: string, isPrivileged: boolean) {
  // 1. Same language? → Allow
  if (normalizeLanguageKey(currentLanguage) === normalizeLanguageKey(targetLanguage)) {
    return { allowed: true };
  }
  
  // 2. Admin/Founder/Developer? → Allow (testing override)
  if (isPrivileged) {
    return { allowed: true };
  }
  
  // 3. Check enrollment
  const hasEnrollment = await storage.hasLanguageEnrollment(userId, targetLanguage);
  if (hasEnrollment) {
    return { allowed: true };
  }
  
  // 4. Deny with friendly message
  return { 
    allowed: false, 
    reason: `You're not currently enrolled in ${targetLanguage} classes. Would you like to explore ${targetLanguage} courses?`
  };
}
```

### Phase 3: Denial Response Handling (30 min)
**Files: `server/services/streaming-voice-orchestrator.ts`**

When transfer is denied:
1. Don't execute the voice/tutor switch
2. Have current tutor acknowledge the limitation gracefully
3. Optionally suggest how to enroll

Example tutor response:
> "I'd love to introduce you to our Spanish tutors, but I see you're currently enrolled in French only. Would you like me to tell you about our Spanish program?"

### Phase 4: Update Tutor Directory in Prompts (30 min)
**File: `server/system-prompt.ts`**

Modify `buildTutorDirectorySection()` to:
- For class-assigned learning: Show only same-language tutors
- For self-directed (if enrolled in multiple): Show all enrolled languages
- For admin/founder: Show all tutors

### Phase 5: Voice Lab / Command Center UI (Optional, 30 min)
**Files: `client/src/components/VoiceLabPanel.tsx`, `client/src/pages/admin/VoiceConsole.tsx`**

- Disable voice selection dropdown options for non-enrolled languages
- Show visual indicator (lock icon?) for unavailable languages
- Admin override: show all options

### Phase 6: Documentation Updates (15 min)
**File: `server/system-prompt.ts` ACTION_TRIGGERS section**

Update examples to clarify:
- Same-language switches: Always available
- Cross-language switches: Only if enrolled
- Include example denial handling

## Database Schema Reference

```sql
-- teacherClasses (already exists)
- id
- language (e.g., 'french', 'spanish')
- teacherId
- ...

-- classEnrollments (already exists)  
- id
- classId → teacherClasses.id
- studentId → users.id
- status (active/inactive)
- ...
```

## Testing Checklist
- [ ] Same-language transfer works (French female → French male)
- [ ] Cross-language transfer blocked for non-enrolled user
- [ ] Cross-language transfer allowed for enrolled user
- [ ] Admin/founder can transfer to any language
- [ ] Denial message is friendly and helpful
- [ ] Voice Lab respects restrictions
- [ ] Tutor directory in prompts is filtered correctly

## Rollback Plan
If issues arise, revert to "same-language only" by:
1. Removing enrollment check
2. Denying all cross-language transfers regardless of enrollment

## Future Enhancements
- "Try a free lesson" flow for unenrolled languages
- Suggest enrollment when cross-language is requested
- Track attempted cross-language requests for analytics (interest signals)

## Estimated Effort
- **Minimal viable**: Phases 1-3 = ~2 hours
- **Complete with UI**: Phases 1-6 = ~3-4 hours

## Dependencies
- None - uses existing enrollment tables
- No external services needed
