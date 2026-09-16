# Production Audio Replay, Image Pipeline, and Luca Presence Repair

## Scope

Repair three defects observed during the post-Render-cutover production smoke test:

1. Gemini Live repeated a substantial completed response inside one still-open model generation.
2. A generated `show_image` scene did not follow HolaHola’s established visual style closely enough.
3. The Team Room showed Luca offline even though the production Luca presence socket was connected and joined.

## Audio replay repair

### Evidence

The production session recorded one Gemini `generationComplete` and one sealed audio subturn for each user turn. The browser received no duplicate chunk keys, used one audio handler, and performed no mid-turn reset. The final persisted assistant message nevertheless contained the same full paragraph twice consecutively.

The failure is therefore semantic replay inside one model generation, not transport retransmission or a second completed generation.

### Design

Add a turn-local replay detector to the Gemini Live session:

- Build a normalized token stream from incremental output transcription.
- Do not arm replay suppression until the first passage is substantial enough that ordinary pedagogical repetition cannot trigger it.
- Detect only an immediate replay that starts again from the beginning of the same response and matches a substantial prefix.
- Preserve the first occurrence.
- Once confirmed, suppress subsequent transcript and audio belonging to the replay.
- Let the existing turn-seal and transcript-flush lifecycle complete normally.
- Emit dedicated telemetry with the turn ID and matched-prefix size.
- Reset all detector state at every genuine new user/model turn and on session reset.

The detector must not suppress short intentional repetitions such as “muy bien, muy bien,” vocabulary drills, corrections, or repeated single sentences below the conservative threshold.

### Verification

Focused tests must prove:

- a long paragraph repeated immediately is persisted and emitted once;
- short pedagogical repetition is preserved;
- a long response containing repeated words but not a replay from its beginning is preserved;
- replay state does not cross turn boundaries;
- the existing second-generation, transcript flush, and response-completion guards still pass.

## Image pipeline repair

### Evidence

The production `show_image` call requested a Spanish plaza scene. It reached the normal vocabulary-image resolver and generated successfully, but the result did not match HolaHola’s established style closely enough.

HolaHola already has a canonical image pipeline:

1. Resolve reviewed cached and shared-concept images first.
2. Apply canonical concept mapping and reviewed scene overrides.
3. Generate only on a cache miss, selecting the scene or prop engine contract.
4. For scenes, use the target language to load the DB-pinned style profile; fall back to the reviewed built-in scene style only when no profile is pinned.
5. Return the resulting image bytes to Daniela in the tool continuation so she can evaluate the image in the live teaching context.
6. If the image is wrong, Daniela uses the existing explicit regeneration path with a more specific description.

The active production data includes the pinned Spanish style profile. The resolver and generation interfaces accept language and style context, but not every scene-generation branch currently propagates that context through to `generateCharacterScene`.

The project previously rejected direct reference-image prompting for ordinary production scenes because it copied composition instead of reliably transferring style. It also intentionally rejected an automatic image-quality loop because Daniela is the in-context evaluator.

### Design

Restore the existing pipeline contract rather than adding a parallel generation path:

- Keep reviewed cache and shared-concept hits authoritative and generation-free.
- Keep canonical concept mapping, meaning-specific cache keys, scene overrides, and scene-versus-prop classification unchanged.
- Ensure every cache-miss scene path, including freeform `show_image` scenes, passes the normalized target language through `generateVisual` to `generateCharacterScene`.
- Let `generateCharacterScene` continue loading the DB-pinned style profile for that language, with the existing built-in scene style as its fallback.
- Preserve `PROP_STYLE` for isolated vocabulary objects; do not apply character-scene styling to props.
- Do not pass the anchor image itself into the production generator.
- Do not implement or activate an automatic image-quality scorer or regeneration loop.
- Preserve the existing inline image bytes in Daniela’s tool continuation and the explicit `regenerate_memory_image` correction path.
- Do not let a generation failure or generic placeholder become a reviewed canonical cache entry.
- Add telemetry identifying cache hit, concept hit, generated scene/prop, selected style-profile key, and explicit fallback without recording image bytes.

No Daniela-facing tool prose or teaching prompt should change as part of this repair. If implementation reveals that model-facing wording must change, stop and complete the established Alden-to-Gemini wording review before editing it.

### Verification

Focused tests must prove:

- a reviewed cache hit returns immediately without generation;
- shared canonical concepts still reuse the reviewed image across languages;
- a Spanish freeform scene reaches generation with the Spanish pinned style profile;
- another language selects its own profile or the documented shared fallback;
- isolated object vocabulary still uses the prop contract;
- direct reference-image input is not introduced;
- the generated image remains available to Daniela as inline image data;
- explicit regeneration still uses the existing correction path;
- a placeholder or failed generation is not cached as a reviewed canonical image.

## Luca presence repair

### Evidence

The authenticated production presence endpoint reported Luca connected, joined to the active room, and at zero reconnect attempts. The browser initializes `lucaOnline` to false and changes it only after receiving `luca_presence`. The initial online event can be broadcast before a browser joins, and `join_room` currently does not replay the current state.

### Design

Treat presence as current state plus live updates:

- When a browser joins a Team Room, send that socket the current Luca presence immediately.
- Report online only when the local Luca presence socket is connected and joined to the same room.
- Keep the existing room broadcasts for later online/offline transitions.
- Do not expose credentials or presence details outside the authenticated Team Room namespace.
- Avoid introducing polling or a second client-side source of truth.

### Verification

Focused tests must prove:

- Luca connects first and a later browser immediately receives online state;
- a browser joining while Luca is disconnected receives offline state;
- a browser joining a different room does not receive a false online state;
- subsequent disconnect/reconnect broadcasts continue to update already-joined clients;
- ordinary `join_room` behavior remains unchanged.

## Rollout

Run focused tests, typecheck, the project health verifier, and the relevant validation suite. After review, commit and sync the repair, wait for Render to serve the exact commit, and repeat the production voice, image, and Team Room smoke checks.