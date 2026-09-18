# Production Image Intent and Luca Presence Repair

Date: 2026-09-16  
Status: Approved for implementation

## Problem

The first post-Render-cutover production session confirmed that Gemini Live's
same-response audio replay suppression works. It also exposed two remaining
defects:

1. Cindy requested a Madrid street image as a city background, but the result
   included Daniela and another person.
2. Luca remained offline in the Team Room after the founder joined.

The audio path is out of scope and must remain unchanged.

## Production evidence

The production `gl_tool_success` event recorded Cindy's actual image call:

- tool: `show_image`
- word: `Madrid`
- scene: `a beautiful watercolor painting of a sun-drenched street in Madrid,
  with historic buildings and sidewalk cafes`
- no `slot`
- no tutor identity
- no request for people

The generated image was cached as a generic Spanish Madrid vocabulary image.
The subsequent transcript confirms that the intended result was a landscape
and that the visible result contained Daniela and another person.

This evidence disproves the initial assumption that preserving
`slot="scene"` alone would repair the incident. Layout placement and image
content intent must be separate decisions.

The Luca presence path currently performs one active-room lookup shortly after
server startup. If no active room exists then, Luca does not retry. The
late-browser-join replay correctly reports Luca online only when Luca is
connected to that exact room, so it cannot compensate for the missing room
join.

## Invariants

### Image invariants

1. Layout placement is independent from generated content:
   - `slot` controls where an image appears.
   - content kind controls which generator is used.
   - people policy controls whether human figures are allowed.
2. A city, street, landscape, building, room, or other setting description
   without an explicit person requirement is an environment.
3. Environment images contain no people, tutors, or other characters unless
   the request explicitly asks for them or the described concept necessarily
   requires them.
4. Character identity for live freeform generation comes from the active
   tutor session. Language alone never selects Daniela or another tutor.
5. Isolated object vocabulary continues to use the prop path.
6. Cache identity includes the content kind and custom scene meaning. A cached
   character scene must never satisfy an environment request for the same
   displayed word.
7. Existing canonical pinned style and normalized language selection remain
   authoritative. No direct reference-image prompting or automatic quality
   loop is added.

### Presence invariants

1. Luca is online in a browser only when the server-side Luca client is
   connected and joined to that exact active room.
2. Starting without an active room is recoverable; it is not a terminal state.
3. Creating or activating a room causes Luca to revalidate the current active
   room and join it.
4. A rapid room switch cannot leave Luca attached to an obsolete room.
5. Browser access continues to require a valid signed production session,
   canonical founder identity, and an existing room.
6. The Luca coordination token path remains separate from browser
   authorization.
7. Missing or invalid production credentials produce explicit diagnostics,
   not a silent permanent offline state.

## Design

### 1. Image request classification

Introduce an explicit internal image intent carried through the live handler
and vocabulary resolver:

- `contentKind`: `environment | character | prop`
- `peoplePolicy`: `excluded | explicit`
- active tutor identity, only when `contentKind` is `character`
- layout `slot`, unchanged and independently optional

Classification uses the complete request:

1. Explicit setting terms and sufficiently descriptive location scenes become
   `environment` when no people requirement is present. The recorded Madrid
   request must take this branch.
2. Explicit person terms, named tutors/characters, relationships, crowds, or
   human actions become `character`.
3. Isolated concrete objects remain `prop`.
4. `slot="scene"` is a strong environment signal but is not required.
5. Unknown or ambiguous setting requests fail safe toward an empty
   environment rather than injecting a tutor.

The classifier must be deterministic and independently testable. Prompt prose
reinforces its result but does not make the routing decision.

### 2. Generator routing

- `environment` calls the environment generator with the canonical
  language-pinned style profile and an explicit no-people composition rule
  when `peoplePolicy` is `excluded`.
- `character` calls the character generator and may receive the active tutor
  identity. No live freeform request derives character identity from the
  target language.
- `prop` keeps the current isolated-object path.

The environment and character paths must return truthful metadata describing
which profile and content kind were used so tests and diagnostics can verify
the route.

### 3. Cache separation

Custom scene cache identity includes:

- normalized displayed word
- normalized language
- content kind
- a deterministic digest of the effective scene/meaning

Generic vocabulary fallback keys remain available only for compatible prop
requests. Environment and character requests do not fall back to a generic
cache record that lacks matching intent metadata.

The existing people-filled Madrid row does not need destructive deletion. It
will no longer match the new environment-scene cache identity.

### 4. Tool guidance and telemetry

Keep `show_image` as the public tool. Clarify that `slot` controls placement,
not whether the image contains people, and that city/background descriptions
should use `slot="scene"` when large scene placement is intended.

Persist bounded, non-secret image-resolution telemetry sufficient to prove:

- raw semantic image fields needed for diagnosis
- derived content kind and people policy
- active tutor name when relevant
- generator route
- cache hit/miss and compatible cache identity

Do not persist credentials or unrelated conversational context.

Any Daniela-facing tool-description change requires Alden review followed by
Gemini wording review before implementation.

### 5. Luca room lifecycle

Replace the one-shot active-room lookup with two coordinated triggers:

1. Bounded startup retry with backoff while no active room exists.
2. An explicit room-lifecycle hook after room creation or activation.

Every attempt re-reads the authoritative active room before joining. Joining
is idempotent for the current room. If the active room changes during an
attempt, the stale attempt cannot overwrite the newer room binding.

Existing socket disconnect behavior, exact-room late-join replay, and founder
browser authorization remain unchanged.

### 6. Production configuration diagnostics

At startup, validate only the presence and structural validity of the Luca
coordination token. Never log its value. Log distinct states for:

- token absent or structurally invalid
- transport connection failure
- connected with no active room
- joined exact active room
- retry scheduled or exhausted

Production verification must also confirm that Render has the expected
session, shared-database, and Luca-token configuration without exposing any
secret value.

## Error handling

- Image intent classification must not silently fall back from environment to
  character generation.
- A failed environment generation returns the existing explicit generation
  failure behavior; it does not retry through the character path.
- Cache records without compatible intent metadata are treated as misses.
- Luca room lookup or join failures retain the last truthful offline/room
  state and schedule only bounded retry.
- Credential failure is non-retryable until process restart or configuration
  correction; room absence and transport interruption are retryable.

## Verification

### Image regression tests

1. The recorded Madrid arguments classify as environment, people excluded.
2. A city request with no slot still uses the environment generator.
3. A city request with explicit shoppers or a named tutor allows people and
   uses the character-capable route.
4. Character identity uses Cindy in a Cindy session and never Daniela merely
   because the language is Spanish.
5. Environment and character requests for the same word have distinct cache
   identities.
6. The existing generic Madrid cache row cannot satisfy the new environment
   request.
7. Language-pinned style metadata remains truthful.

### Presence regression tests

1. Existing active room at startup is joined.
2. No room at startup, followed by room creation/activation, joins without a
   restart.
3. Rapid active-room changes leave Luca in only the authoritative room.
4. A late authorized browser receives online for the same room.
5. A browser in another room receives offline.
6. Invalid browser session, non-founder identity, and invalid Luca token remain
   rejected.

### Release verification

1. Run focused image, presence, and unchanged audio replay tests.
2. Run typecheck, system health, and the registered validation suite.
3. Obtain unconditional Gemini post-review approval for the final image/tool
   behavior.
4. Promote only through the guarded GitHub-main path.
5. Let Render auto-deploy and verify `/health/release` reports the exact
   promoted commit.
6. Repeat the focused production checks:
   - no duplicate audio
   - Madrid background contains no people
   - active tutor identity is correct when explicitly requested
   - Luca is online for a late browser join

## Out of scope

- Changes to Gemini Live audio replay suppression
- A general image-quality review loop
- Direct use of tutor reference images in live prompts
- Destructive cleanup of historical image cache rows
- Relaxing Team Room browser authorization
- Replit Publish or Replit deployment configuration