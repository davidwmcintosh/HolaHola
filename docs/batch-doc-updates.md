# Batch Documentation Updates

Pending documentation updates to be applied together.

---

## Phase 3c: Asian Language Whiteboard Tools (Dec 4, 2025)

### New Whiteboard Tools

**READING - Pronunciation Guides**
- Format: `[READING]character|pronunciation|language[/READING]`
- Supports: furigana (Japanese), pinyin (Mandarin), romanization (Korean)
- Uses HTML ruby elements for proper annotation display
- Language parameter is optional (auto-detected from characters)

**STROKE - Stroke Order Display**
- Format: `[STROKE]character|language[/STROKE]`
- Large character display for writing practice
- Static display (animated strokes planned for Phase 5)
- Language parameter optional for context hints

### Files Changed
- `shared/whiteboard-types.ts` - ReadingItem, StrokeItem types + parsing
- `client/src/components/Whiteboard.tsx` - UI components for both tools
- `server/system-prompt.ts` - Asian language tools documentation
- `future-features.md` - Phase 3c completion record

### Documentation To Update
- [ ] User-facing help docs for Asian language learners
- [ ] Teacher guide for using whiteboard with Asian languages
- [ ] API documentation for whiteboard markup formats

---

## Pending Items

(Add new batch items here as work progresses)
