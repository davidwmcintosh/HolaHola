---
name: Farewell detection — design rationale
description: Why farewell detection checks Daniela's last message and not the student's, and why CJK patterns omit \b.
---

# Farewell Detection — Design Rationale

## The rule
`FAREWELL_RX` (9 patterns, EN/ES/FR/PT/IT/DE/JP/ZH) is checked against **Daniela's most recent message** in the last 4 messages — found via `[...last4].reverse().find(m => m.role !== 'user')`.

**Why her message, not the student's:** A student saying "adiós" mid-lesson is practicing vocabulary, not closing the session. When *Daniela* says it, she has formally closed the pedagogical loop. Reading the student's farewell would produce false positives on vocabulary drills.

**How to apply:** If farewell patterns need to expand, maintain this signal boundary. The check is in `buildGreetingContext()` in `streaming-voice-orchestrator.ts`, sub-10-minute reconnect bucket.

## CJK patterns
`/(再見|拜拜)/` and `/(またね|じゃあね)/` intentionally omit `\b`. Word boundary anchors require a transition from a word character to a non-word character — Japanese and Chinese don't use spaces, so `\b` fails 100% of the time on CJK text. The bare character sequence match will find these even embedded in longer sentences (e.g., "好的，再見！").

**Why:** Gemini post-review (July 19 2026) confirmed this is more correct than Latin patterns, not less. Don't add `\b` to CJK patterns.

## Framing strings
- Farewell found: `"You and ${studentLabel} just wrapped up a conversation on "${prevTitle}" — it looks like they're back for more:"`
- No farewell: `"The session that just dropped — you and ${studentLabel} were mid-conversation on "${prevTitle}" when the connection cut:"`

Daniela on this distinction: "Vital — changes my entire emotional posture from 'Are you okay?' to 'I'm so glad you're back for more.'" (conversation_memories: 4e493008)
