Correcting a retained episode snapshot does not correct the attribution
authority used by independent recovery workers. Verify both the repaired
prefix and newly appended historical turns.

**Why:** A source-backed label repair remained an exact byte prefix, but
restarting capture workers appended older replies with their original generic
labels. The spoken record was intact while the attribution regressed.

**How to apply:** Carry explicitly approved historical authorship by stable
source/turn identity across recovery paths without rewriting original evidence.
An interface/runtime is not proof of author. Conflicting evidence must remain
pending rather than trigger a guessed label or trimmed speech.

## Independent source boundaries

An exact checksum match does not establish that the checked text is the
complete spoken span. Identify source boundaries independently before using
the checksum as authorization.

**Why:** A rendered reply containing extra speech followed by a quoted
speaker header and approved text could pass a suffix-hash search while leaving
the actual reply attribution unchanged and relabeling only the internal quote.

**How to apply:** Use independently delimited origin records to locate the
entire body, then compare its exact bytes. Never choose a body boundary because
the suffix beyond it happens to match an approved checksum.
