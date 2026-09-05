---
name: Live voice route ownership
description: Durable routing rule for mutually exclusive live and legacy voice engines.
---

A selected live voice provider owns every response-producing path for the
connection. Never infer permission to use the legacy pipeline from the temporary
absence of a live session object.

**Why:** A live engine can be starting, fail to connect, or close unexpectedly.
Object-presence routing turns those lifecycle states into silent provider
fallback and can create duplicate or wrong-provider responses.

**How to apply:** Resolve the provider route once before accepting session input.
Gate audio, push-to-talk completion, greetings, and interaction events with that
stable route. Report live-engine failure explicitly; only a new connection with
a newly resolved provider may change routes.