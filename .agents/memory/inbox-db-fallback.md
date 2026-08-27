---
name: Inbox DB fallback
description: How to retrieve project-backed agent inbox messages when the platform inbox surface is unavailable
---

The platform-level inbox listing can report that the inbox is not enabled even when the project’s own `agent_notes` table contains valid Luca handoffs. Read those records directly through the application’s Neon database using the HTTP read path, and leave status fields unchanged unless the user explicitly asks for an acknowledgement or action.

**Why:** The inbox surface and the application-backed agent-notes store are separate layers; a disabled platform surface does not prove that a project message is absent.

**How to apply:** Query the requested `agent_notes` ID and any linked `conversation_memories` ID directly, report the current status, and do not mutate either record during a read-only review.