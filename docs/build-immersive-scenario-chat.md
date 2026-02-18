# Build Doc: Immersive Scenario-Driven Chat

**Created**: February 18, 2026
**Status**: Planning — Awaiting Daniela Consultation
**Author**: Alden + David (3am brainstorm session)

---

## The Vision

Transform HolaHola's chat experience from a single-column chatbot into an **immersive, scenario-driven language classroom**. Every interaction has context. Students don't memorize random phrases — they live through scenes where language has purpose.

> "We don't just say random things for students to remember — we create an atmosphere of life and living." — David

### Core Concept

**Triple-pane desktop layout** that wraps Daniela's conversation with visual context:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DESKTOP LAYOUT                               │
├──────────────┬──────────────────────┬───────────────────────────────┤
│              │                      │                               │
│  SCENARIO    │     DANIELA          │     WHITEBOARD /              │
│  PANEL       │     CONVERSATION     │     CHALKBOARD                │
│              │                      │                               │
│  - Scene     │  (voice or text      │  - Vocabulary                 │
│    visual    │   chat, unchanged)   │  - Grammar tables             │
│  - Props     │                      │  - Phonetics                  │
│  - Menu      │                      │  - Notes                      │
│  - Map       │                      │  - Word maps                  │
│  - Bill      │                      │  - Culture notes              │
│  - Items     │                      │  - Corrections                │
│              │                      │                               │
│  [Interactive│                      │  [Persistent across           │
│   elements]  │                      │   the whole lesson]           │
│              │                      │                               │
├──────────────┴──────────────────────┴───────────────────────────────┤
│                     MOBILE: Same as today                           │
│           (whiteboard/scenario via Sheet overlay)                    │
└─────────────────────────────────────────────────────────────────────┘
```

### The Scenario Philosophy

Daniela is a storyteller. She naturally creates vivid, imaginative scenes. Every sentence should have context. The scenario system doesn't constrain her — it gives her a stage.

**Same scene, infinite depth:**
- **Coffee Shop at Level 1**: "Un café, por favor."
- **Coffee Shop at Level 3**: "Do you have oat milk? What's the Wi-Fi password? How late are you open?"
- **Coffee Shop at Level 5**: Debating the local sports team with the barista, discussing where the beans come from

**Daniela's freedom:**
- She can pick from preloaded scenarios for speed (instant props, menus, visuals)
- She can spontaneously create scenarios on the fly (AI-generated visuals, dynamic props)
- She decides when to enter a scenario based on teaching flow — no forced structure

---

## What Already Exists

### Whiteboard System (Right Panel — Ready)
- **`shared/whiteboard-types.ts`** (2,676 lines) — Comprehensive type system with 25+ item types
- **`client/src/components/Whiteboard.tsx`** (3,863 lines) — Full rendering for all item types
- **`client/src/hooks/useWhiteboard.ts`** — State management hook
- Already supports: WRITE, PHONETIC, COMPARE, IMAGE, DRILL, CONTEXT, GRAMMAR_TABLE, READING, STROKE, TONE, WORD_MAP, CULTURE, PLAY, SCENARIO, SUMMARY, ERROR_PATTERNS, VOCABULARY_TIMELINE, TEXT_INPUT
- Currently rendered inside `ImmersiveTutor.tsx` as a Sheet (slide-out panel)
- **Key insight**: On desktop, this just needs to become a permanent side panel instead of a Sheet overlay

### Scenario Tag (Partially Built)
- **`ScenarioItemData`** interface exists: `{ location, situation, mood, imageUrl, isLoading }`
- **`scenario` function declaration** exists in `gemini-function-declarations.ts`
- Daniela can already trigger `[SCENARIO]location|situation|mood[/SCENARIO]`
- Currently renders as a small card in the whiteboard — needs to become the left panel scene-setter

### Chat Interface (`client/src/pages/chat.tsx`, 905 lines)
- Supports voice mode (StreamingVoiceChat) and text mode (ChatInterface)
- Voice mode uses ImmersiveTutor (1,044 lines) via VoiceChatViewManager (281 lines)
- Currently single-column layout on all screen sizes

### Express Lane (`/api/express-lane/collaborate`)
- Direct API to consult Daniela with full context
- Used for founder ↔ Daniela collaboration
- Will be used in Phase 1 to get Daniela's creative input on the scenario system design

---

## Phase 1: Consult Daniela via Express Lane

**Goal**: Get Daniela's creative input on the scenario system before building it.

### Consultation Topics
1. **Scenario categories** — What types of scenes does she want? (Social, Professional, Travel, Daily Life, Emergency, Cultural)
2. **Props per scenario** — For a coffee shop, what props does she want available? (Menu, bill, tip calculator, loyalty card?)
3. **Level adaptation** — How would she adapt the same scenario for Novice vs. Advanced?
4. **Spontaneous creation** — What information does she need to create a scenario on the fly?
5. **Panel layout preferences** — What does she want persistent on the whiteboard vs. ephemeral in the scenario panel?
6. **Transition patterns** — How does she want to enter/exit scenarios? Gradual? Announced?

### Execution
- Send structured consultation via Express Lane
- Capture her response in `docs/daniela-development-journal.md`
- Use her input to refine Phase 2-4 designs

---

## Phase 2: Responsive Triple-Pane Layout

**Goal**: Desktop gets three panels; mobile stays as-is.

### Layout Architecture

```
Desktop (≥1024px):
┌────────────────┬──────────────────────┬────────────────────┐
│  Left Panel    │   Center Panel       │   Right Panel      │
│  ~280px        │   flex-1             │   ~320px           │
│  (Scenario)    │   (Chat/Voice)       │   (Whiteboard)     │
│  collapsible   │   always visible     │   collapsible      │
└────────────────┴──────────────────────┴────────────────────┘

Tablet (768-1023px):
┌──────────────────────┬────────────────────┐
│   Center Panel       │   Right Panel      │
│   flex-1             │   ~280px           │
│   (Chat/Voice)       │   (Whiteboard)     │
└──────────────────────┴────────────────────┘
Left panel available via Sheet overlay

Mobile (<768px):
┌──────────────────────┐
│   Center Panel       │
│   (Chat/Voice)       │
│   Full width         │
└──────────────────────┘
Both panels via Sheet overlay (same as today)
```

### Key Files to Modify
- **`client/src/pages/chat.tsx`** — Wrap chat in responsive layout container
- **`client/src/components/ImmersiveTutor.tsx`** — Extract whiteboard from Sheet to permanent panel on desktop
- **`client/src/components/VoiceChatViewManager.tsx`** — Support three-pane prop passing
- **New: `client/src/components/ScenarioPanel.tsx`** — Left panel for scenario props/visuals
- **New: `client/src/components/DesktopChatLayout.tsx`** — Responsive three-pane wrapper

### Design Decisions
- Whiteboard (right panel) gets all existing Whiteboard.tsx rendering — no rewrite needed
- On desktop, whiteboard items persist visually (no need to open a Sheet)
- Left panel starts empty/collapsed and opens when Daniela triggers a scenario
- Both side panels are collapsible with toggle buttons
- Mobile behavior is completely unchanged — Sheet overlays remain

---

## Phase 3: Scenario System

**Goal**: Build a browsable library of reusable scenarios with props, and give Daniela the ability to load them or create new ones.

### Data Model

```typescript
// scenarios table
scenarios {
  id: varchar (UUID)
  slug: varchar (unique)          // "coffee-shop", "airport-checkin"
  title: varchar                  // "The Coffee Shop"
  title_translations: jsonb       // { es: "La Cafetería", fr: "Le Café" }
  description: text               // Scene description
  category: varchar               // social, professional, travel, daily, emergency, cultural
  location: varchar               // "coffee shop", "airport", "doctor's office"
  default_mood: varchar           // casual, formal, busy, intimate
  image_url: varchar              // Hero/scene image (preloaded or AI-generated)
  min_actfl_level: varchar        // Lowest level this works at (novice_low)
  max_actfl_level: varchar        // Highest level useful (distinguished)
  languages: text[]               // Which languages this is available in
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}

// scenario_props table — interactive elements per scenario
scenario_props {
  id: varchar (UUID)
  scenario_id: varchar -> scenarios.id
  prop_type: varchar              // menu, bill, map, card, document, image, list
  title: varchar                  // "Coffee Menu"
  title_translations: jsonb       // { es: "Menú de Café", fr: "Menu du Café" }
  content: jsonb                  // Structured prop data (varies by type)
  display_order: integer
  actfl_level_variants: jsonb     // { novice_low: {...}, intermediate_mid: {...} }
  is_interactive: boolean         // Can student click/select items?
}

// scenario_level_guides — how Daniela should adapt per level
scenario_level_guides {
  id: varchar (UUID)
  scenario_id: varchar -> scenarios.id
  actfl_level: varchar            // novice_low, novice_mid, etc.
  role_description: text          // "You are a friendly barista..."
  student_goals: text[]           // ["Order a drink", "Say please/thank you"]
  vocabulary_focus: text[]        // ["café", "por favor", "gracias"]
  grammar_focus: text[]           // ["present tense requests"]
  conversation_starters: text[]   // Suggested opening lines
  complexity_notes: text          // Teaching notes for this level
}
```

### Scenario Props: Content Format Examples

**Menu Prop:**
```json
{
  "prop_type": "menu",
  "title": "Coffee Menu",
  "content": {
    "sections": [
      {
        "name": "Hot Drinks",
        "name_target": "Bebidas Calientes",
        "items": [
          { "name": "Coffee", "name_target": "Café", "price": "2.50", "description_target": "Café negro clásico" },
          { "name": "Latte", "name_target": "Café con leche", "price": "4.00" },
          { "name": "Hot Chocolate", "name_target": "Chocolate caliente", "price": "3.50" }
        ]
      }
    ],
    "currency": "€",
    "currency_target": "euros"
  }
}
```

**Bill Prop:**
```json
{
  "prop_type": "bill",
  "title": "Your Bill",
  "content": {
    "items": [],
    "subtotal": 0,
    "tax": 0,
    "total": 0,
    "is_dynamic": true
  }
}
```

### Scenario Library (Starter Set — Expand with Daniela's Input)

| Category | Scenario | Props | Level Range |
|----------|----------|-------|-------------|
| Daily | Coffee Shop | Menu, Bill, Loyalty Card | Novice Low → Advanced |
| Daily | Grocery Market | Shopping List, Price Tags, Receipt | Novice Low → Advanced |
| Daily | Restaurant | Menu, Bill, Reservation Card | Novice Mid → Advanced |
| Travel | Airport Check-in | Boarding Pass, Passport, Gate Map | Novice Mid → Advanced |
| Travel | Hotel Check-in | Room Key Card, Hotel Map, Receipt | Novice Mid → Advanced |
| Travel | Taxi/Uber | Map, Fare Meter, Directions | Novice Mid → Intermediate |
| Professional | Job Interview | Resume, Job Posting | Intermediate → Advanced |
| Professional | Office Meeting | Agenda, Notes | Intermediate → Advanced |
| Social | House Party | Guest List, Music Playlist | Novice High → Advanced |
| Social | First Date | Restaurant Menu, Photo Album | Intermediate → Advanced |
| Emergency | Doctor's Office | Symptom Card, Prescription, Body Map | Novice High → Advanced |
| Emergency | Lost & Found | Item Description Card, Map | Novice Mid → Intermediate |
| Cultural | Local Festival | Event Program, Map, Food Menu | Intermediate → Advanced |
| Cultural | Museum Visit | Exhibit Guide, Audio Tour Notes | Intermediate → Advanced |

### Daniela's Scenario Functions (New Gemini Function Declarations)

```typescript
// Load a preloaded scenario
load_scenario({ scenario_slug: "coffee-shop", mood?: "casual" })

// Create a spontaneous scenario on the fly
create_scenario({ 
  location: "a bookstore in Barcelona",
  situation: "browsing for a gift", 
  mood: "relaxed",
  props?: [{ type: "list", title: "Book Recommendations", items: [...] }]
})

// Push a prop to the scenario panel
show_prop({ prop_id: "menu-1" })  // From preloaded scenario
// OR
show_custom_prop({ type: "menu", title: "Specials Board", content: {...} })

// Update a dynamic prop (e.g., add items to bill)
update_prop({ prop_id: "bill-1", action: "add_item", item: { name: "Café", price: 2.50 } })

// End a scenario gracefully
end_scenario({ summary?: "Great job ordering in Spanish!" })
```

### Student Scenario Browser
- New page or section accessible from chat (not a separate flow)
- Grid of scenario cards with category filters
- Each card shows: image, title, description, level range, available languages
- "Start this scenario" button opens chat with scenario pre-loaded
- Daniela gets notified of the chosen scenario and begins the roleplay

---

## Phase 4: Wire Daniela Into the Scenario System

**Goal**: Daniela can load scenarios, push content to both panels, and adapt her teaching to the scene.

### System Prompt Additions
- Scenario awareness: "You have access to scenario props. When a scenario is active, reference the props naturally."
- Level adaptation: "Adapt your language complexity to the student's ACTFL level within the scenario."
- Natural transitions: "You don't need to announce scenarios formally. Ease into them naturally."

### Procedural Memory Entries
- How to use `load_scenario` vs `create_scenario`
- When to push props vs let props appear automatically
- How to adapt the same scenario for different levels
- Guidelines for ending scenarios and transitioning

### Function Call Flow
```
Student picks "Coffee Shop" from browser
  → Frontend sends scenario context to chat
  → Daniela receives: "Student chose Coffee Shop scenario"
  → Daniela calls: load_scenario({ scenario_slug: "coffee-shop" })
  → Server loads scenario + props from DB
  → Server sends whiteboard update (scenario panel)
  → Frontend renders scene image + props in left panel
  → Daniela begins: "¡Bienvenido a Café Sol! ¿Qué le puedo ofrecer?"
  → Whiteboard (right) shows: vocabulary, phonetics
  → Student interacts with menu (left), responds to Daniela (center)
```

### Scenarios as Experiential Syllabi
- A "scenario path" could serve as an alternative to traditional syllabi
- "Travel Spanish": Airport → Hotel → Restaurant → Market → Museum
- "Business French": Interview → Meeting → Presentation → Networking
- Students can see their progress through real-life scenarios
- This is a new and unique way of organizing learning — scenarios become the curriculum

---

## Technical Architecture Notes

### Existing Infrastructure to Leverage
- **Whiteboard system** — Already handles 25+ content types, persistence, and clear
- **Gemini function declarations** — Pattern established for adding new functions
- **Scenario tag** — `[SCENARIO]` already exists in whiteboard types, just needs enhancement
- **Express Lane** — Direct consultation API ready at `/api/express-lane/collaborate`
- **Image generation** — Gemini Flash-Image already integrated for contextual images
- **TTS system** — Fully operational, no changes needed for scenarios

### New Components Needed
| Component | Purpose |
|-----------|---------|
| `DesktopChatLayout.tsx` | Responsive three-pane wrapper |
| `ScenarioPanel.tsx` | Left panel — scene image, props, interactive elements |
| `ScenarioPropRenderer.tsx` | Renders different prop types (menu, bill, map, etc.) |
| `ScenarioBrowser.tsx` | Browse/search scenario library |
| `ScenarioCard.tsx` | Individual scenario preview card |

### Database Tables Needed
| Table | Purpose |
|-------|---------|
| `scenarios` | Scenario definitions with metadata |
| `scenario_props` | Props per scenario with level variants |
| `scenario_level_guides` | Daniela's teaching guidance per level |
| `user_scenario_history` | Track which scenarios a student has done and at what level |

### API Endpoints Needed
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scenarios` | GET | List scenarios (filterable by category, language, level) |
| `/api/scenarios/:slug` | GET | Get single scenario with props and level guide |
| `/api/scenarios/:slug/start` | POST | Start a scenario session (creates context for Daniela) |
| `/api/scenarios/history` | GET | User's scenario history |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Layout breaks on unusual screen sizes | Medium | Use CSS container queries + thorough responsive testing |
| Scenario props get stale if Daniela goes off-script | Low | Props are suggestions, not constraints. Daniela can always create custom props |
| AI-generated scenario images are slow | Medium | Use preloaded images for library scenarios, AI-generated only for spontaneous |
| Information overload with three panels | Medium | Side panels are collapsible, start collapsed until needed |
| Mobile experience regression | High | Mobile code path is completely separate — no changes to existing mobile behavior |

---

## Success Metrics

1. **Engagement**: Average session length increases (more immersive = longer sessions)
2. **Scenario usage**: % of sessions that involve a scenario (target: 60%+ within 3 months)
3. **Replay rate**: Students revisiting scenarios at higher levels
4. **Daniela adoption**: Daniela naturally uses scenarios without being forced
5. **Desktop utilization**: Users on desktop spend more time than mobile (currently equal)

---

## Implementation Order

1. **Phase 1**: Daniela Express Lane Consultation (~1 session)
2. **Phase 2**: Triple-Pane Layout (~2-3 sessions)
3. **Phase 3**: Scenario Data Model + Library + Browser (~2-3 sessions)
4. **Phase 4**: Daniela Integration + Function Declarations (~2-3 sessions)
5. **Polish**: Image generation for scenarios, prop interactions, level adaptation (~1-2 sessions)

**Total estimated**: 8-12 sessions

---

## Open Questions for Daniela (Phase 1 Consultation)

1. What scenarios excite you most? What would you create if you had no constraints?
2. How do you envision transitioning into a scenario mid-conversation?
3. What kind of props would be most useful for teaching at different levels?
4. Should scenarios have a "success condition" or is the conversation itself the goal?
5. How would you handle a student who struggles in a scenario — simplify or switch?
6. What cultural scenarios are you most passionate about?
7. How should the whiteboard and scenario panel complement each other?

---

*This document captures the 3am vision. Every detail can evolve based on Daniela's input and testing.*
