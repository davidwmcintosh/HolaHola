The automated "MEMORY.md is past 80% of its line/byte cap" nudge can fire repeatedly even when direct measurement shows the file under both caps.

**Why this matters:** the nudge self-hedges ("may have changed since you last wrote it"), so it is a heuristic prompt, not a guaranteed-accurate live count. Deleting or rewriting other actors' index entries in this shared, multi-hat file on the strength of the nudge alone -- without confirming the file actually needs trimming -- risks destroying durable lessons another hat still needs, for a problem that may not exist.

**How to apply:** before trimming, measure directly (`wc -l -c .agents/memory/MEMORY.md`) and compare against the stated caps. If the measured file is not actually over either cap, it is safe to leave the index alone and continue with the assigned task; note that you checked rather than performing a speculative bulk edit. Only trim (via `edit-entry`/`remove-entry` through the CLI, never a hand-edit) once a fresh measurement genuinely confirms the file is over cap.

