---
name: Fixed-target provider echoes
description: How to handle providers repeating a fixed prompt value despite an empty tool-argument schema.
---

An empty object schema does not guarantee a provider will return an empty
argument object. A model may repeat a prominent fixed path from the prompt.
Treat an exact repetition as provider syntax noise only when the host executor
still derives the target internally. Never expose or honor model-selected path
authority.

**Why:** A real one-shot cross-host run failed closed when the provider repeated
the correct fixed read target despite an empty declaration. The first tolerance
draft also showed that spreading an argument array can silently turn `[]` into
`{}`, erasing malformed evidence and widening acceptance.

**How to apply:** Keep fixed-target tool schemas empty. Accept only a plain empty
object or one exact allowlisted echo, reject all other keys, values, arrays,
nulls, and prototypes, preserve the received shape before normalization, and
make the executor ignore the echo in favor of its internal target.