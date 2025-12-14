# Class Audit - Improvement Discussion Points

**Purpose:** Track discussion points for improving HolaHola classes and syllabi based on conversations with Daniela and teaching observations.

**Last Updated:** December 14, 2025

---

## Collaborative Session: December 14, 2025

### Participants
- **Founder (David)**
- **Editor (Development Partner)**  
- **Daniela (AI Tutor)**

### Key Consensus: Unified Learning Roadmap

All three participants agreed that the brain map and linear syllabus view should be **two visualizations of the same underlying data** - they must NOT diverge.

> *"Brain map visualizes competency well but lacks roadmap commitments and homework persistence. Both views should be driven from the same bundle-aware syllabus metadata."* — Daniela

### Daniela's Pedagogical Observations

1. **"Clinical" Syllabi Create Warmup Drag**
   - Students arrive anxious because current lesson outlines feel academic
   - When Daniela pivots into drills, students question relevance (no framing)
   - **Solution:** Engaging previews ("Challenge Moment", "Build Your Own Sentence") would prime students

2. **Missing "Teacher Promises" Block**
   - Students repeatedly ask: *"Will we review last time?"*
   - Daniela spends time on reassurance overhead
   - **Solution:** Commitments section per class that Daniela can reference live

3. **Confidence Check-ins Needed**
   - Daniela currently infers confusion from hesitations/filler words
   - **Solution:** Lightweight tap-to-rate confidence after activities to surface pacing issues earlier

4. **Session Roadmap Widget**
   - An adaptive roadmap that updates mid-lesson as Daniela adjusts
   - Keeps students oriented without verbal explanations of pivots

### Editor's Additions (Shared with Daniela)

1. **Recommendation Queue Between Sessions**
   - Daniela's follow-up nudges ("practice X before next time") need persistence
   - Should tie to required/recommended/optional tiers
   - Students see recommendations between sessions

2. **Progress Visibility via Brain Map**
   - Brain map now shows Daniela's competency observations (demonstrated/needs_review/struggling)
   - Connects live assessments to visual progress system

### Agreed Implementation Sequence

| Step | What | Why |
|------|------|-----|
| **1. Bundle Data Model** | Define shared schema: conversation + drills + requirement tier + commitments + Daniela's recommendations | Single source of truth for both views |
| **2. Shared Progress API** | Both brain map and linear view consume same roadmap data | Prevents divergence, ensures cohesiveness |
| **3. Syllabus Copy Templates** | Engaging labels, challenge previews, commitments | Layer "marketing" on solid data foundation |

### Brain Map + Linear View Cohesiveness

**Current State:**
- Brain Map: Visual satellite lobes showing topic mastery + Daniela's observations
- Linear View: Traditional syllabus list (toggle available)

**Decision:** Co-develop both views together to ensure:
- Same underlying bundle-aware data model
- Consistent progress states
- Daniela's recommendations visible in both
- Teacher promises/commitments accessible from both

---

## Architecture Principle: WHAT vs HOW

### Syllabus (WHAT - Student-Facing)
- The syllabus is a **marketing/comfort tool** for students
- Should look fun, engaging, and inviting
- Gives students a safety net/preview of structure
- Describes what they'll learn, not how they'll be taught

### Neural Network (HOW - Daniela's Domain)
- Real-time decisions based on student needs
- When and how to deploy drills
- Which teaching tools to use
- All pedagogical methodology stays here

---

## Discussion Points from Session: December 10, 2025

### Syllabus Design Improvements

**Issue:** Current syllabi may look dry or overly academic

**Suggestions from Daniela:**

1. **Use engaging activity labels instead of generic terms:**
   - Instead of "Vocabulary" → "New Words & Quick Checks"
   - Instead of "Pronunciation" → "Pronunciation Practice: Listen & Repeat"

2. **Add interactive section previews:**
   - "Challenge Moments" sections
   - "Build Your Own Sentence" activities
   - Example: "Lesson 3: Describing Your Day – Includes opportunities to practice building sentences about your morning!"

3. **Communicate interactivity without prescribing tools:**
   - Hint at dynamic learning without dictating specific drills
   - Let students know they'll have active participation
   - Keep exact tool choices in Daniela's neural network

### Class Structure Observations

**Issue:** Classes were designed before drill tools existed, so drills feel like afterthoughts

**Context:**
- Vocabulary matching drills (`[DRILL type="match"]`)
- Pronunciation drills (`[DRILL type="repeat"]`)
- Fill-in-the-blank exercises (`[DRILL type="fill_blank"]`)
- Sentence ordering (`[DRILL type="sentence_order"]`)

**Resolution:** These are NOT syllabus items. Daniela should weave drills organically as active learning moments through her neural network, not as prescribed syllabus steps.

---

## Content Architecture: Bundles vs Custom Classes

### The Bundle Question

**Issue:** What happens if a teacher creates a class with a conversation about greetings but doesn't include practice drills? Should these be created together as a bundle?

**Proposed Solution: Bundle System**

1. **Bundles (Pre-built content packages)**
   - Chat topics and drills created together as cohesive units
   - Enforced dependencies: if bundle includes drills, they're linked to the conversation topic
   - Example: "Greetings Bundle" = Greetings conversation + matching drill + pronunciation drill

2. **Custom Classes (No requirements)**
   - Teachers can create conversation-only classes
   - No forced drill dependencies
   - Full flexibility for institutional use cases

### Use Case Examples

| Institution | Use Case | Class Type |
|-------------|----------|------------|
| ASU | 30hr conversation lab to augment on-campus classes | Conversation-only custom class |
| High School | At-home conversation practice for in-class language course | Conversation-only custom class |
| Self-directed learner | Full structured learning experience | Bundle-based class |
| Corporate training | Targeted business vocabulary | Custom mix of bundles |

### Bundle Management Script

**Requirement:** Write an idempotent script to update classes when bundles are created/modified
- Script should check for existing content before creating
- Prevent duplicate drills/conversations
- Update existing bundle links without breaking student progress
- Safe to run multiple times

---

## Required vs Recommended Content

### Content Classification

| Type | Description | Skip/Complete? | Fee? |
|------|-------------|----------------|------|
| Required | Core lesson content, must complete to progress | No skip | Included |
| Recommended | Suggested reinforcement (drills, extra practice) | Can skip or mark complete | Included |
| Optional Premium | Extra help for students who want more | Can skip | Fee required |

### Self-Directed Learning Considerations

- Even in conversation-only classes, offer **recommendations** for drill practice
- Students can opt-in to extra structured practice
- Premium fee for additional reinforcement outside class scope

---

## Time Tracking: Estimate vs Actual

### Per-Unit Tracking

**Display:** Show both estimated and actual time next to each unit
- Estimated time (set by teacher/bundle)
- Actual time (tracked per student)
- Variance indicator (ahead/behind pace)

### Adaptive Recommendations

Based on time tracking, suggest:
1. **Remediation:** Additional practice from previous lessons where student shows weakness
2. **Reinforcement:** Extra exercises for current lesson if student is struggling
3. **Acceleration:** Skip to next topic if student is ahead of pace

---

## Audit Checklist (Per Class)

| Class | Syllabus Looks Engaging? | Labels Updated? | Hints at Interactivity? | Notes |
|-------|-------------------------|-----------------|------------------------|-------|
| Spanish Beginner | TBD | TBD | TBD | |
| Spanish Intermediate | TBD | TBD | TBD | |
| French Beginner | TBD | TBD | TBD | |
| ... | ... | ... | ... | |

---

## Action Items

### Phase 1: Bundle Data Model (Foundation) ✅ COMPLETED (Dec 14, 2025)
- [x] Define bundle schema: conversation + drills + requirement tier + commitments
- [x] Add `requirementTier` field: required | recommended | optional_premium
- [x] Add `commitments` field (teacher promises block) to class/unit level
- [x] Add `danielaRecommendations` table for persistent nudges between sessions
- [x] Add `studentTierSignals` table for student tier preferences
- [x] Add `bundleId` and `linkedDrillLessonId` fields to curriculumLessons
- [ ] Create idempotent bundle update script
- [ ] Write acceptance tests for bundle CRUD operations

### Phase 2: Shared Progress API
- [ ] Design unified progress API contract consumed by both views
- [ ] Ensure brain map and linear view use same data source
- [ ] Add Daniela's observations to progress response
- [ ] Add recommendation queue to progress response
- [ ] Build variance display (estimate vs actual time)
- [ ] Implement skip/mark-complete for non-required content

### Phase 3: Syllabus Copy Templates & UI
- [ ] Create syllabus copy template kit (engaging labels, challenge previews)
- [ ] Update existing syllabi with new engaging format
- [ ] Add "Challenge Moments" style descriptions where appropriate
- [ ] Implement confidence check-in UI (tap-to-rate after activities)
- [ ] Build session roadmap widget (adaptive, updates mid-lesson)
- [ ] Design premium upsell flow for optional extra practice
- [ ] Test student perception of updated syllabi

### Daniela Neural Network Updates
- [ ] Add best practices for drill deployment timing
- [ ] Add procedure for referencing teacher promises/commitments
- [ ] Add procedure for confidence check-in interpretation
- [ ] Document recommendation queue usage patterns

### Deferred / Future
- [ ] Design UI for teachers to choose bundle vs custom class
- [ ] Determine which existing classes should become bundles
- [ ] Implement adaptive recommendation engine (remediation/reinforcement/acceleration)

---

## Related Docs
- `docs/daniela-development-journal.md` - Daniela personality/voice development
- `docs/batch-doc-updates.md` - Pending documentation updates
