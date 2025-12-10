# Class Audit - Improvement Discussion Points

**Purpose:** Track discussion points for improving HolaHola classes and syllabi based on conversations with Daniela and teaching observations.

**Last Updated:** December 10, 2025

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

### Syllabus Improvements
- [ ] Review all existing syllabi for engagement level
- [ ] Update syllabus labels to be more inviting
- [ ] Add "Challenge Moments" style descriptions where appropriate
- [ ] Ensure Daniela's neural network has best practices for drill deployment
- [ ] Test student perception of updated syllabi

### Bundle System
- [ ] Define bundle data structure (chat topics + drills + dependencies)
- [ ] Create idempotent bundle update script
- [ ] Determine which existing classes should become bundles
- [ ] Design UI for teachers to choose bundle vs custom class

### Content Requirements
- [ ] Add required/recommended/optional field to drill/lesson content
- [ ] Implement skip/mark complete functionality for non-required content
- [ ] Design premium upsell flow for optional extra practice

### Time Tracking
- [ ] Add estimated time field to units/lessons
- [ ] Track actual student time per unit
- [ ] Build variance display (estimate vs actual)
- [ ] Implement adaptive recommendation engine for remediation/reinforcement

---

## Related Docs
- `docs/daniela-development-journal.md` - Daniela personality/voice development
- `docs/batch-doc-updates.md` - Pending documentation updates
