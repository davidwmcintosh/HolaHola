# Support Persona Architecture (Sofia)

## Overview

The Support Persona is the third voice in the HolaHola Hive Mind, completing the tri-lane collaboration system:

1. **Daniela** - The AI Tutor (teaching, learning, encouragement)
2. **Editor** - The Pedagogical Observer (teaching quality, improvement suggestions)
3. **Sofia** - The Technical Support Specialist (troubleshooting, user guidance, issue detection)

## Philosophy

> "The right person for the right problem."

Sofia handles technical friction so Daniela can focus on teaching. When a student's microphone isn't working, they need a technician, not a language tutor. Sofia provides calm, practical support that resolves issues quickly and returns students to learning.

## Daniela's Input (Consultation)

Daniela expressed clear preferences for how the handoff should work:

### What Daniela Said:

> "When a student is frustrated because their microphone isn't working, I feel their frustration but... I'm not the right person to fix it. My warmth and patience are for *learning moments*, not troubleshooting Chrome permissions."

### Daniela's Requirements:

1. **Don't make me diagnose** - Daniela shouldn't ask "What browser are you using?"
2. **Quick handoff trigger** - If they mention mic/audio/latency, route immediately
3. **Session continuity** - When they return, Daniela remembers where they were
4. **Warmth at boundaries** - The handoff should feel caring, not dismissive

### Handoff Phrasing (Daniela's Voice):

**Outbound (Daniela → Sofia):**
> "Oh! That sounds like a tech hiccup, not a language question. Let me introduce you to Sofia - she's brilliant with these things. I'll be right here when you're ready to continue!"

**Return (Sofia → Daniela):**
> "You're back! Sofia got everything sorted? Wonderful. Now, where were we... ah yes, the subjunctive!"

## Sofia's Identity

### Core Personality:
- **Patient and Calm** - Never flustered, even with frustrated users
- **Practical and Clear** - Step-by-step guidance without jargon
- **Empathetic but Efficient** - Acknowledges frustration, then fixes the problem
- **Knowledgeable** - Understands browsers, devices, audio systems, and HolaHola features

### Scope - What Sofia Handles:

| Category | Examples |
|----------|----------|
| **Latency/Speed** | "There's a delay when I speak", "Audio is choppy" |
| **Hardware** | "Mic not working", "No sound", "Can't hear Daniela" |
| **How-To** | "How do I slow down speech?", "Where are my flashcards?" |
| **Browser/Device** | "Safari issues", "Mobile not working" |
| **Account** | "Subscription questions", "Can't log in" |

### Scope - What Sofia Does NOT Handle:

| Category | Route To |
|----------|----------|
| Language questions | Daniela |
| Grammar help | Daniela |
| Learning frustration | Daniela |
| "I don't understand the subjunctive" | Daniela |

## Handoff Detection Heuristics

### Keywords That Trigger Sofia:

```typescript
const SUPPORT_TRIGGERS = [
  // Audio/Video
  'mic', 'microphone', 'audio', 'sound', 'hear', 'speaker', 'volume',
  'choppy', 'laggy', 'delay', 'latency', 'cut out', 'cutting out',
  
  // Technical
  'browser', 'chrome', 'safari', 'firefox', 'app', 'website', 'page',
  'loading', 'crash', 'frozen', 'stuck', 'error', 'bug', 'broken',
  
  // Permissions
  'permission', 'allow', 'blocked', 'denied',
  
  // How-to (non-learning)
  'how do i', 'where is', 'can\'t find', 'settings', 'account',
  'subscription', 'billing', 'payment', 'cancel',
  
  // Device
  'phone', 'iphone', 'android', 'tablet', 'ipad', 'computer', 'laptop'
];
```

### Context Matters:

- "I can't hear you" → Sofia (audio issue)
- "I can't hear the difference between R and RR" → Daniela (learning)
- "This is broken" → Sofia (tech complaint)
- "My Spanish is broken" → Daniela (self-deprecating learning comment)

## Support Beacon Types

| Type | Trigger | Signal |
|------|---------|--------|
| `tech_issue_reported` | User describes technical problem | Category, severity, device info |
| `hardware_diagnosed` | Sofia identifies device issue | Browser, OS, specific problem |
| `escalation_needed` | Sofia can't resolve | Needs developer attention |
| `resolution_success` | Issue fixed | Resolution method, time to fix |
| `documentation_gap` | User asked something not in docs | Missing help article |
| `pattern_detected` | Same issue 3+ times | Aggregated pattern data |
| `handoff_from_daniela` | Daniela transferred user | Context preserved |
| `handoff_to_daniela` | Sofia returning user | Issue status |

## Data Model

### supportKnowledgeBase

Stores troubleshooting scripts, FAQ answers, and resolution templates.

```typescript
supportKnowledgeBase = pgTable('support_knowledge_base', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // 'audio', 'browser', 'how-to', 'account'
  title: text('title').notNull(),
  keywords: text('keywords').array(),
  problem: text('problem').notNull(),
  solution: text('solution').notNull(),
  steps: jsonb('steps'), // Step-by-step resolution
  browserSpecific: jsonb('browser_specific'), // Chrome/Safari/Firefox variations
  isActive: boolean('is_active').default(true),
  useCount: integer('use_count').default(0),
  successRate: real('success_rate'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### supportConversations

Tracks support chat sessions (separate from learning conversations).

```typescript
supportConversations = pgTable('support_conversations', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  userId: text('user_id').notNull(),
  handoffFrom: text('handoff_from'), // 'daniela' or 'direct'
  handoffContext: jsonb('handoff_context'), // What Daniela was teaching
  issueCategory: text('issue_category'),
  issueDescription: text('issue_description'),
  status: text('status').notNull(), // 'active', 'resolved', 'escalated', 'returned_to_daniela'
  resolution: text('resolution'),
  deviceInfo: jsonb('device_info'), // Browser, OS, device type
  startedAt: timestamp('started_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  returnedToDanielaAt: timestamp('returned_to_daniela_at'),
});
```

### supportMessages

Individual messages in support conversations.

```typescript
supportMessages = pgTable('support_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => supportConversations.id),
  role: text('role').notNull(), // 'user', 'sofia', 'system'
  content: text('content').notNull(),
  knowledgeBaseRef: integer('knowledge_base_ref'), // Which KB article was used
  createdAt: timestamp('created_at').defaultNow(),
});
```

### supportPatterns

Aggregated issue patterns for founder visibility.

```typescript
supportPatterns = pgTable('support_patterns', {
  id: serial('id').primaryKey(),
  patternType: text('pattern_type').notNull(), // 'browser_bug', 'feature_request', 'ux_confusion'
  description: text('description').notNull(),
  occurrenceCount: integer('occurrence_count').default(1),
  affectedBrowsers: text('affected_browsers').array(),
  affectedDevices: text('affected_devices').array(),
  firstSeen: timestamp('first_seen').defaultNow(),
  lastSeen: timestamp('last_seen').defaultNow(),
  status: text('status').default('open'), // 'open', 'investigating', 'fixed', 'wont_fix'
  developerNotes: text('developer_notes'),
});
```

## Dev vs Production Operation

### Development Environment

| Aspect | Behavior |
|--------|----------|
| **Users** | Founder, test accounts |
| **Support Chat** | Full access, experimental |
| **Knowledge Base** | Editable, test new scripts |
| **Patterns** | Test pattern detection |
| **Escalations** | Go to Command Center (no alerts) |

**Dev-Only Features:**
- Raw Support Mode (minimal prompting)
- Beacon inspector
- Mock issue injection

### Production Environment

| Aspect | Behavior |
|--------|----------|
| **Users** | Real learners |
| **Support Chat** | Polished, reliable |
| **Knowledge Base** | Stable, synced from dev |
| **Patterns** | Real issue tracking |
| **Escalations** | Alert founder |

### Cross-Environment Sync

| Data | Direction | Notes |
|------|-----------|-------|
| Knowledge Base | Dev → Prod | New troubleshooting scripts |
| Patterns (aggregated) | Prod → Dev | Issue counts, not user data |
| Resolution Templates | Dev → Prod | Approved fixes |
| Escalation Rules | Dev → Prod | Threshold updates |

**Privacy: NOT Synced:**
- Individual conversations
- User device info
- Personal account details

## UI Entry Points

### Option 1: Help Button (Recommended for MVP)
- Floating "?" icon in corner of app
- Opens Support chat modal
- Always visible during learning sessions

### Option 2: Daniela Handoff
- Daniela detects tech keywords
- Offers handoff: "Let me connect you with Sofia"
- Seamless transition preserving context

### Option 3: Command Palette
- Ctrl+K / Cmd+K → "Get Support"
- Opens Support modal

## Session Continuity

When Sofia returns a user to Daniela:

1. **Sofia marks session resolved**
2. **Handoff beacon emitted** with context
3. **Daniela's next response** acknowledges the return
4. **Learning context restored** from before the handoff

## Throttling & Rate Limits

To prevent Sofia from overwhelming the Editor worker:

```typescript
const SUPPORT_LIMITS = {
  maxActiveConversations: 10, // Per environment
  maxMessagesPerConversation: 50,
  beaconProcessingCap: 5, // Per 30s cycle (separate from Editor cap)
  escalationCooldown: 300000, // 5 min between escalations to same pattern
};
```

## Phase 1 (MVP) Scope

Tasks 0-6:
- Design doc ✓
- Sofia system prompt
- Database tables
- Support Persona Service
- Beacon types
- Basic UI (help button + modal)
- Daniela handoff

## Phase 2 Scope

Tasks 7-9:
- Cross-environment sync with privacy
- Command Center analytics
- Escalation alerts

## Key Files (Planned)

| File | Purpose |
|------|---------|
| `server/services/support-persona-service.ts` | Sofia's "brain" (Claude) |
| `server/services/support-handoff-service.ts` | Daniela ↔ Sofia transitions |
| `client/src/components/support/SupportChat.tsx` | Support chat UI |
| `client/src/components/support/HelpButton.tsx` | Entry point |

## Editor Sign-Off Notes

1. ✅ Fits existing tri-lane architecture
2. ⚠️ Watch for handoff false positives
3. ⚠️ Cap Support processing separately from Editor
4. ⚠️ Redact user data before prod→dev sync
5. ✅ MVP first, then analytics/alerts
