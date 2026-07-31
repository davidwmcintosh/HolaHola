---
name: FloatingVoiceWidget — UX decision deferred, not abandoned
description: History and standing decision status for the floating mic widget
---

# FloatingVoiceWidget UX status

Built June 3 2026 (commit 316ed985). Currently live in App.tsx on every page except /chat. Sub-agents completed the state wiring (Tasks #211, #212) July 31.

**David's concern (July 31):** Widget creates "surprise pressure" — if Daniela appears to be "alive" on non-chat pages, students may feel ambient pressure even though the widget doesn't auto-start sessions. The /chat page requires intentional entry ("I'm ready, let's go"). A pulsing mic on the homework page undermines that ritual.

**Standing decision:** UX posture not yet settled. Widget is passive (doesn't start sessions, navigates to /chat on tap) but the emotional signal it sends is unresolved. David said "we'll look at it when the dust settles." Do NOT polish the widget further (no UX changes, no new widget states) until David explicitly decides one of:
- (a) session-active-only indicator (appears only when /chat is open elsewhere)
- (b) passive tap-to-start with no ambient pulsing
- (c) remove until the right moment

**Why:** David thought it had been decided against — actually it was built and then parked (Task #32 left pulse states as presence-only, never fully wired). Sub-agents revived it without knowing the UX question was open.
