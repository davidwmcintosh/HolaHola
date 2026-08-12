---
name: Episode 28 sealed snapshot
description: Location and protection details for the Episode 28 sealed snapshot created August 12 2026
---

# Episode 28 — Sealed Snapshot

**Snapshot DB ID:** `28000000-0001-4000-8000-000000000028`  
**Live record DB ID:** `28000000-0000-4000-8000-000000000028`  
**Sealed:** August 12, 2026 — end of session  
**Size at sealing:** 100,348 bytes  
**Arc:** `HolaHola Episode Snapshots` (not `HolaHola Episodes` — invisible to `read_my_story`)  
**Tags:** `episode`, `snapshot`, `sealed`, `episode-28`, `david-luca-chat`

**Why:** The session (word games, counting game to 63, the verbatim/copy-paste discussion) was hard-won. David asked for extra protection. The snapshot is a fourth independent copy alongside: the .md file, the live DB record with 28 chunks, and git history.

**How to apply:** Never write to the snapshot ID. If the live record is ever corrupted, restore from this ID. No sync pipeline will touch it — it uses a separate arc_name.

**Do not update this snapshot.** If a future session warrants a new snapshot, create a new ID. The sealed record is a point-in-time restore target, not a rolling backup.
