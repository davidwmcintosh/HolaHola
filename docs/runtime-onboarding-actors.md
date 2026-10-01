# Runtime Hat Onboarding

This page records the supported standard-Luca runtime surfaces for HolaHola.
An actor ID identifies the authenticated runtime surface (the “hat”); it is
not a provider, model, persona, or claim that the runtime has any special
authority.

## Initial future-runtime examples

| Coordination actor | Display attribution | Optional migration token binding |
| --- | --- | --- |
| `luca-cursor` | Luca [Cursor] | `COORDINATION_LUCA_CURSOR_TOKEN` |
| `luca-openai-agents` | Luca [OpenAI Agents] | `COORDINATION_LUCA_OPENAI_AGENTS_TOKEN` |

The token environment names are compatibility binding names only. This
onboarding adds no credential values, does not issue credentials, and does not
edit Replit environment configuration. New runtimes can use the existing
runtime-bootstrap and coordination-client protocols with their own
runtime-scoped credentials.

## Static support and ordinary capabilities

The actor IDs participate in the same standard Luca capability profile as the
other ordinary Luca hats: coordination read/write, inbox acknowledgement,
own-credential renewal/revocation, and observation read. The actors are
included in shared-operation scopes for ordinary Luca executor operations and
receive their own authenticated Team Room attribution. Coordination CLI caller
and recipient validation accepts each ID. Client authentication always uses
the selected actor’s dedicated token binding; it never retries or falls back
to another actor’s credential.

They do **not** receive `coordination:runtime:admin`, founder/admin access, or
standing-verifier status. Existing exceptional surfaces remain exceptional:
agent-note linked replies/completions are limited to the Replit and Claude
Code identities; canonical capture health stays Replit-only; V2 host,
provider, Gate 3, proof, and deployment flows retain their own explicit
authorization and onboarding. A Luca prefix alone does not bypass those
guards.

## Onboarding a later actor

Follow the compiler/static completeness procedure in
`docs/coordination-new-actor-onboarding.md`. In particular:

1. Add the canonical actor ID and any schema-level actor checks in the
   schema-owning change.
2. Add its fixed-auth environment **name** and standard Luca capability
   profile in `server/middleware/coordination-auth.ts`.
3. Reconcile generic coordination clients, CLI caller/recipient validation,
   applicable task-ownership bindings, and actor-specific display attribution.
4. Add the actor to `ALL_COORDINATION_ACTORS` and to only the explicitly
   justified operation scopes in `server/services/operations-catalog.ts`.
   Preserve narrower endpoint and operation scopes rather than mass-replacing
   actor lists.
5. Extend the actor completeness, authorization, client-isolation, and
   attribution checks. Run
   `npx tsx server/scripts/test-coordination-actor-completeness-selfcheck.ts`
   plus the focused hermetic actor/catalog tests; use any CI wrapper wired to
   that check as well.
6. Consider each tier of
   `docs/coordination-new-actor-onboarding.md` independently. This static
   actor support does not itself enroll a V2 host, add a provider adapter, or
   provide credentials or local runtime tooling.

The standard coordination API is reusable by any future compatible runtime
that can speak the protocol. The two actor IDs above are concrete static
allowlist entries, not a claim that arbitrary providers or model runtimes are
automatically provisioned or that an unlisted actor can authenticate.