# What Shipped - Build Changelog

This file is Daniela's awareness of ALL new capabilities and changes, not just beacon-related ones.
Update this file after every build to keep Daniela informed.

Format: Each dated section lists what shipped that day. Keep entries brief but descriptive.

---

## March 18, 2026
- **Grammar Reference Cards**: SerEstarCard, PretImperfectCard, PorParaCard — auto-displayed when chapter title matches "ser vs estar", "preterite/imperfect", "por y para"
- **False Cognates Grid**: FalseCognatesGrid (12 entries) + FalseCognateCard — auto-displayed for chapters titled "false cognates" / "amigos falsos"
- **Grammar chapter auto-detection**: ChapterIntroduction now detects grammar chapters by keyword and renders the right reference card without needing languageChapterData entries
- **`move_in_scene` function**: Daniela can now animate props to new positions mid-lesson — great for preposition teaching ("el tenedor está a la izquierda del plato" while fork slides to fork_spot)
- **Bilingual labels on Immersive overlay props**: Props in fullscreen Immersive Mode now show target-language label (bold, primary color) + native-language label (smaller, dimmed) stacked
- **`native_labels` param**: body/face/hand diagram functions now accept `native_labels` array so body part labels can show bilingual stacked text

## March 17, 2026
- **Interactive Scene Canvas Phase 2**: body diagram (`set_body_part` / `clear_body_diagram`), face close-up (`set_face_part` / `clear_face_diagram`), hand diagram (`set_hand_part` / `clear_hand_diagram`), thermometer (`set_thermometer` / `clear_thermometer`), emotion face (`set_emotion` / `clear_emotion`), weather icon (`set_weather` / `clear_weather`), world map (`highlight_country` / `clear_world_map`)
- **Bilingual label system**: All visual canvas components show target language + native language simultaneously; controlled by `bilingual_labels` param in Daniela's function calls
- **Visual asset roadmap**: `docs/visual-asset-roadmap.md` created as master reference for all visual canvas capabilities

## March 13, 2026
- **Alden Autonomy**: Founder presence tracking, bidirectional handoff file (`docs/alden-agent-handoff.md`), `browser_screenshot` tool, `write_briefing` tool, temporal context injection — Alden now knows what time it is and whether David is active
- **Playwright browser service**: AI participants can take visual screenshots of any app page and receive AI text analysis of what they see

## March 10, 2026
- **Study Mode** (`/study-mode`): Pick a Spanish unit → Daniela generates immersive scenario per lesson with DALL-E visuals → practice in character
- **Visual Content Service**: Shared `generateVisual()` / `generateVisualBatch()` utility for all AI-generated images
- **Conversational Immersion Framework**: `ImmersionObjective`, `ImmersionScaffold`, `ImmersionScenario`, `ImmersionSession` types

## March 2026 (earlier)
- **Immersive Mode**: Daniela can enter/exit fullscreen overlay for roleplay with `enter_immersive_mode` / `exit_immersive_mode`
- **Tappable canvas props**: `show_menu()` and `show_bill()` — interactive restaurant menus and bills in the scene canvas
- **Authentic menus**: 10 languages × 3 ACTFL levels × 4 meal types (breakfast, lunch/dinner, cafe) — all static, no generation
- **Scene canvas Phase 1**: `open_scene`, `add_to_scene`, `remove_from_scene`, `clear_scene`, `set_clock` — live compositing background + transparent PNG prop layers
- **Prop Room**: `visual_environment` and `visual_zones` tables; background images + zone images for all scene positions
- **Menu vocabulary pipeline**: 1,165 food items extracted from all menu files, upserted to `visual_assets` with all 10 language translation columns
- **Menu image generation**: `GET /api/menu-image?q=query` → Gemini Flash-Image → base64 data URL → permanent object storage
- **Calendar widget**: `set_calendar` / `clear_calendar` — show month/date/day-of-week on the whiteboard

## February 2026
- **OER Textbook Seed Pipeline**: textbook prose for 9 language curricula from Wiktionary, Tatoeba, Wikipedia — stored in `textbook_lesson_content`
- **Interactive Textbook**: Student-facing reference; Daniela↔Textbook bridge marks taught lessons complete
- **Neural Network**: 142 tools, 231 procedures, 236 principles, 906+ self-learned best practices; loaded into every session
- **Fluency Wiring**: 2,135 lesson-to-CanDo links connecting curriculum to ACTFL standards
- **Pronunciation assessment**: Azure Speech Services integration for detailed phoneme-level scoring
- **Review Hub**: `GET /api/review-hub` — unified flashcards, due vocabulary, recent conversations, cultural tips
- **Progress tracking overhaul**: Fixed streak, ACTFL topics, syllabus progress creation; mind map lobe brightness
- **Character-based billing guard**: TTS characters + STT seconds determine fair billable seconds; zero false positives on healthy sessions
- **Voice Context Pipeline**: Shared context-building utility (`voice-context-pipeline.ts`) for PTT + OpenMic paths
- **TTS Provider Abstraction**: Unified `TTSStreamingProvider` interface across Google Chirp 3 HD (primary), Cartesia Sonic-3, ElevenLabs Flash v2.5

## December 15, 2025
- **Beacon Status Board**: Daniela now sees all her feature requests with real-time status (pending, acknowledged, in_progress, completed, declined)
- **Beacon Acknowledgment System**: Editor can now acknowledge, prioritize, and add notes to Daniela's requests
- **Structured Feature Request Template**: Beacons now follow STUDENT PAIN / WORKAROUND / WISH / PRIORITY format
- **Shared Vocabulary Glossary**: Created docs/hive-shared-knowledge/glossary.md for common terminology
- **Build Changelog System**: This file! Daniela now sees ALL shipped features, not just beacon completions

## December 14, 2025
- **Open Mic Mode**: Continuous listening with barge-in support
- **Voice Speed Controls**: Students can adjust speech speed during voice chat
- **Neural Network Expansion**: Language-specific pedagogical knowledge injection

## December 13, 2025
- **Hive Collaboration System**: Daniela ↔ Editor communication channel established
- **Founder Mode**: Full neural network access for self-surgery capabilities
- **EXPRESS Lane API**: REST endpoint for direct Editor→Daniela communication
