---
name: textbook_page whiteboard item — Daniela-centered session architecture baby step 1
description: How start_textbook_page sends the lesson visual to the right pane.
---

`TextbookPageItem` (type: 'textbook_page') in `shared/whiteboard-types.ts` carries:
- lessonId, actflLevel, focus
- vocabulary: [{word, translation?}]
- grammarPattern: string
- examples: [{target, translation?, note?}]
- sentencePatterns: string

Server: `processStartTextbookPage` in `native-fc-handlers.ts` — after building `session.textbookPageResult`, also parses the DB row (vocabularyList, grammarExamples, microCycleData) and calls `this.sendMessage(session.ws, { type: 'whiteboard_update', items: [{ type: 'textbook_page', ... }] })`.

Client: `TextbookPageItemDisplay` in `Whiteboard.tsx` renders it. `WhiteboardPanel.tsx` detects `item.type === 'textbook_page'`, auto-expands, and shows "Lesson Page" header + BookOpen icon.

`set_right_pane(mode: 'whiteboard')` → sends `{ type: 'clear' }` whiteboard update. Registered in `daniela-function-registry.ts` (legacyType: SET_RIGHT_PANE). Tool auto-indexed at next server start via daniela-tool-indexer.

**Why:** Design goal — student sees what Daniela teaches from. "You never leave her." The right pane mode follows Daniela's tool calls, not route config.
