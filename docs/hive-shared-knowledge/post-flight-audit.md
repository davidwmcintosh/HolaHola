# Post-Flight Audit Loop

> **Purpose**: Mandatory self-review after completing significant work. The backward-looking counterpart to Pre-Flight.

---

## When to Trigger

**Always trigger Post-Flight when:**
- Completing a new feature or capability
- Work touches multiple subsystems
- Pre-Flight flagged medium/high impact
- About to return control to the founder

**Skip for:**
- Trivial fixes (typos, single-line changes)
- Documentation-only updates
- Explicit "ship immediately" requests

---

## The Three Stages

### Stage 1: Verification Pass

*Does it actually work?*

| Check | Question | Status |
|-------|----------|--------|
| **Tests** | Do all relevant tests pass? | |
| **Core Flow** | Can I complete the main user journey? | |
| **Scope Match** | Does this match what Pre-Flight/user requested? | |
| **No Regressions** | Did I break anything that was working? | |

**If any fail → Required Fix before proceeding**

---

### Stage 2: Gap & Edge Review

*What's missing or fragile?*

| Category | Questions | Findings |
|----------|-----------|----------|
| **Error Paths** | What happens when things go wrong? API errors? Empty states? Invalid input? | |
| **RBAC** | Are permissions correctly enforced? Can unauthorized users access this? | |
| **Data Validation** | Is input validated on both frontend and backend? | |
| **Edge Cases** | What about empty lists? Long text? Special characters? | |
| **Related Beacons** | Were any pending beacons related to this work addressed? | |
| **Dependencies** | Did this change affect any dependent systems? | |

**Issues found here become "Should Address" items**

---

### Stage 3: Polish Assessment

*How ready is this for the user?*

| Dimension | MVP (Minimum) | Polished | Current State |
|-----------|---------------|----------|---------------|
| **UX** | Works | Delightful | |
| **Performance** | Acceptable | Optimized | |
| **Documentation** | replit.md updated | Full docs + examples | |
| **Observability** | Errors logged | Metrics + alerts | |
| **Edge Cases** | Common covered | Comprehensive | |

**Rate: MVP Ready / Needs Polish / Polished**

---

## Output Report Template

After completing the audit, produce this structured output:

```markdown
## Post-Flight Report: [Feature Name]

### Verdict: [MVP Ready | Needs Polish | Polished]

### Required Fixes (Blocking)
- [ ] Issue 1
- [ ] Issue 2

### Should Address (High Priority Improvements)
- [ ] Improvement 1
- [ ] Improvement 2

### Opportunities (Nice-to-Have)
- Idea 1
- Idea 2

### Test Evidence
- [What was tested, how]

### Documentation Updates
- [What was updated in replit.md, system-map, etc.]
```

---

## Integration with Pre-Flight

Post-Flight should reference the Pre-Flight context:

1. **System Tags** - Verify each flagged subsystem was properly addressed
2. **Related Beacons** - Confirm beacons were resolved or deferred with reason
3. **Suggested Questions** - Answer questions that Pre-Flight raised
4. **Express Lane Context** - Did we incorporate relevant Founder↔Daniela insights?

---

## Decision Flow

```
┌─────────────────┐
│   BUILD DONE    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 1: Verify│──── Fail ──── Required Fix ──── Iterate
└────────┬────────┘
         │ Pass
         ▼
┌─────────────────┐
│  Stage 2: Gaps  │──── Issues ──── Should Address list
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 3: Polish│──── Rate MVP/Polished
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  PRESENT REPORT TO FOUNDER              │
│                                         │
│  "Here's what I built, here's what's    │
│   ready, here are my suggestions for    │
│   improvements. Your call on next step."│
└─────────────────────────────────────────┘
```

---

## Example Post-Flight

```markdown
## Post-Flight Report: Beacon Management UI

### Verdict: MVP Ready

### Required Fixes (Blocking)
- None

### Should Address (High Priority Improvements)
- [ ] Add bulk status update for multiple beacons
- [ ] Include conversation link for context on each beacon
- [ ] Add beacon age indicator (how long pending?)
- [ ] Export beacons to CSV for tracking

### Opportunities (Nice-to-Have)
- Chart showing beacon trends over time
- Slack notification when critical beacon emitted
- Auto-assign based on beacon type

### Test Evidence
- Verified beacon list renders with 5+ beacons
- Tested status filter toggles
- Confirmed PATCH updates status correctly

### Documentation Updates
- Added BeaconsTab to system-map.md
- Added Beacon Management UI section to replit.md
```

---

## Key Mindset Shift

**Old pattern:**
> "Task done. Ready for review."

**New pattern:**
> "Task done. Here's my Post-Flight audit: works correctly, found 3 improvements we should consider, rated MVP Ready. Recommend we address X before shipping. Your call."

The goal is **proactive collaboration**, not reactive order-following.

---

*Last updated: December 15, 2025*
