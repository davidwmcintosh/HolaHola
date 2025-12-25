# Teacher/Institution Pricing

## Overview

This document tracks the pricing model for teachers and institutions using HolaHola's class management features.

**Status**: PLANNING - Needs full specification

---

## Pricing Dimensions to Track

### 1. Class Creation Limits

**What to track**: How many classes a teacher can create

**Current state**: No limits implemented

**Questions to answer**:
- Free tier limit? (e.g., 1-2 classes)
- Paid tier limits? (e.g., 5, 10, unlimited)
- What happens when limit reached? (soft block with upgrade prompt)

**Potential implementation ideas**:
- Add `maxClasses` field to user/subscription
- Add `classCount` query on teacher dashboard
- Show "X of Y classes used" indicator
- Block creation API when limit reached

### 2. Student Enrollment Limits

**What to track**: How many students a teacher can enroll across all classes

**Current state**: No limits implemented

**Questions to answer**:
- Free tier limit? (e.g., 5-10 students total)
- Paid tier limits? (e.g., 30, 100, unlimited)
- Per-class limits vs. total across all classes?
- What happens when limit reached?

**Potential implementation ideas**:
- Add `maxStudents` field to user/subscription
- Add `totalEnrollmentCount` query for teacher
- Show "X of Y students enrolled" indicator
- Block enrollment API when limit reached

---

## Tier Ideas (Draft)

| Tier | Price | Max Classes | Max Students | Notes |
|------|-------|-------------|--------------|-------|
| Free Teacher | $0 | 1 | 5 | Trial experience |
| Starter | $19/mo | 3 | 25 | Individual tutors |
| Professional | $49/mo | 10 | 100 | Small language schools |
| Institution | Custom | Unlimited | Unlimited | Schools, universities |

---

## Implementation Checklist

- [ ] Define final tier structure
- [ ] Add limit fields to subscription/user schema
- [ ] Build limit enforcement in API routes
- [ ] Create teacher dashboard usage indicators
- [ ] Design upgrade prompts when limits reached
- [ ] Stripe product setup for teacher tiers
- [ ] Admin override for special cases

---

## Related Files

- `shared/schema.ts` - `teacherClasses`, `classEnrollments` tables
- `server/routes.ts` - Class creation and enrollment endpoints
- `client/src/pages/teacher/` - Teacher dashboard pages

---

## Notes

*Add ongoing decisions and discussions here*

- December 25, 2025: Document created to track pricing requirements
