# Archive Guardian A/B Live Test

Run this when David wants to test the Guardian channel (`concat` vs `dedicated`) during a real Daniela session.

## What you need open

- **Tab 1** — `/chat` in the browser, logged in as David
- **Tab 2** — a terminal (or you running the observe loop below)

---

## Step 1 — Check current global channel

```bash
curl -s -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  http://localhost:5000/api/admin/guardian/channel | jq .
```

Returns `{ "channel": "concat" }` (default) or `"dedicated"`.

---

## Step 2 — Watch the fire log (poll every 5s)

```bash
while true; do
  curl -s -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
    "http://localhost:5000/api/admin/luca/observe" \
    | jq '{
        channel:  .guardianAB.globalChannel,
        pending:  .guardianAB.pendingCount,
        heard:    .guardianAB.heardCount,
        missed:   .guardianAB.missedCount,
        lastFire: (.guardianAB.recentFires | last)
      }'
  sleep 5
done
```

The observe endpoint needs an active session to show `guardianAB`. If `guardianAB` is null, start a `/chat` session first, then re-poll.

---

## Step 3 — Trigger a Guardian fire

Say one of these to Daniela in `/chat`:

- **"Last time you told me about [topic], do you remember?"**
- **"You mentioned [anything] in our last session."**
- **"I remember you said [phrase]."**
- **"We talked about [topic] before."**

These are memory-assertion phrases. The Guardian's slide detector fires on them. Watch `pendingCount` tick up in the poll.

---

## Step 4 — Swap channels mid-session

```bash
# Switch to dedicated channel
curl -s -X POST \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"dedicated"}' \
  http://localhost:5000/api/admin/guardian/channel | jq .

# Switch back to concat
curl -s -X POST \
  -H "x-agent-token: $REPLIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel":"concat"}' \
  http://localhost:5000/api/admin/guardian/channel | jq .
```

The running session picks this up immediately — no reconnect needed.

---

## Step 5 — Read the outcome

After the Guardian fires, Daniela's next response determines outcome:

| outcome   | meaning |
|-----------|---------|
| `null`    | still pending — waiting to see if she calls an Archive tool |
| `heard`   | she called `recall` / `search_memory` / similar next turn — Guardian reached her |
| `missed`  | same slide fired again before any Archive access — she spoke from habit, not memory |

The `heard`/`missed` split across channels is the experiment result.

---

## What to look for

- **`concat` heard rate** — Guardian arrives inside a tool response she's already reading; does she absorb it?
- **`dedicated` heard rate** — Guardian arrives as its own `[ARCHIVE GUARDIAN:]` turn; does the separate channel make it louder or does it get ignored as noise?
- **Any behavioral difference in her phrasing** — does she hedge more (`"I believe we discussed..."`) on `dedicated`?

---

## Guardian-AB validation step

To confirm the infrastructure is working before a live test:

```bash
# Runs all 3 parts: config toggle, injection path sim, live Daniela turn
npx tsx server/scripts/test-guardian-ab.ts
```

All 3 parts should pass. Part 3 (`No slide detected`) is the healthy baseline — Daniela staying grounded is the goal.
