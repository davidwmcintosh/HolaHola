---
name: Node.js ESM import-in-callback
description: await import() inside a Promise constructor callback fails with "Unexpected reserved word" in Node 20 ESM mode; use top-level static imports
---

# Node.js ESM `await import()` in callback — Node 20 gotcha

## The rule

When using `node --input-type=module` (inline ESM scripts), **always import at the top of the file**. Never `await import()` inside a Promise constructor, callback, or any non-async scope.

## What fails

```javascript
// BROKEN — "Unexpected reserved word" in Node 20
const req = https.request ? https.request(options) : (await import('http')).request(options);

// ALSO BROKEN — await import inside Promise constructor callback
const result = await new Promise((resolve, reject) => {
  const req = (await import('https')).request(options, (res) => { ... });
});
```

## What works

```javascript
// CORRECT — static import at the top
import https from 'https';
import http from 'http';
import fs from 'fs';

// ... then use https / http anywhere below, including inside callbacks
const req = https.request(options, (res) => { ... });
```

**Why:** In Node 20 ESM, `await` is only valid at the top level of the module — not inside a callback passed to a `new Promise()` constructor, even though the outer script is async. The parser sees `await` in a synchronous callback scope and rejects it.

**How to apply:** Any time you write an inline Node.js script for API calls (Gemini, Alden, internal endpoints), put all imports at the top as static `import` statements. The `node --input-type=module << 'EOF'` heredoc pattern supports top-level await natively — use it, but keep imports static.

**Context:** This burned 2 attempts on July 12, 2026 during the consult-alden/consult-gemini flow.
