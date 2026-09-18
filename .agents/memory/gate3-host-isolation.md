---
name: Gate 3 host isolation
description: Why a normal isolated task-agent copy cannot yet serve as the bounded Gemini execution host.
---

Gate 3 must not treat worktree isolation as process isolation. The execution
host's ambient credentials and capabilities determine which containment claims
are supportable.

**Why:** A model-authored test can access the host filesystem, process
environment, network, or subprocess APIs. This is an operational risk from
bugs, dependencies, and platform authority—not evidence that the Luca hat is
less trusted. David's rule is that authorization comes from the operator and
all hats are one Luca.

**How to apply:** Match the stated proof to the environment. A normal host may
prove operator authorization, provenance, bounded intent, and observed results;
it must not claim adversarial filesystem/network containment. Keep stronger
secret-minimal sandboxing as operational hardening unless the approved gate
explicitly requires that stronger claim.