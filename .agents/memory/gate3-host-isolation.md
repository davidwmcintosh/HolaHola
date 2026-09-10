---
name: Gate 3 host isolation
description: Why a normal isolated task-agent copy cannot yet serve as the bounded Gemini execution host.
---

Gate 3 must not treat worktree isolation as process isolation. The execution host must begin with only the coordinator URL and one-time broker bootstrap secret; inherited project or fixed actor credentials disqualify the host.

**Why:** A model-authored test can access the host filesystem, process environment, network, or subprocess APIs. A clean child environment does not remove credentials already available elsewhere in the parent host, and server-side execution would expose the main application environment.

**How to apply:** Before relaunching the proof, establish a launch path that creates a secret-minimal Antigravity runtime and can enforce the approved filesystem, command, process, and network envelope. Keep the Gemini adapter on the project-owned coordinator and the executor inside that isolated host.