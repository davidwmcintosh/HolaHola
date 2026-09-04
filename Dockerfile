# Production image for running HolaHola outside Replit (Render, Fly.io, etc).
# Two stages: build with devDependencies, then a slimmer runtime image.
# esbuild bundles server/index.ts with `--packages=external`, so node_modules
# must still be present at runtime — this is NOT a fully self-contained bundle.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# bcrypt/sharp/esbuild have native bindings; build tools cover the case where
# no prebuilt binary matches this platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# System libraries Playwright's Chromium needs (server/services/playwright-browser-service.ts,
# used by Alden's browser-automation tool). Drop this block and the
# `npx playwright install` line below if that tool isn't needed in this environment.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# The real source tree, not just the built dist/ output -- .dockerignore
# keeps node_modules/dist out of this, both are layered in from the build
# stage below instead. This is required, not cosmetic: on import,
# server/services/workspace-root.ts eagerly asserts that package.json,
# drizzle.config.ts, server/, and shared/schema.ts exist at the resolved
# workspace root and crashes the whole process otherwise -- the canonical
# conversation-capture system's project-root guard, deliberately strict by
# design (see docs/shared-agent-instructions.md's Canonical Conversation
# Record section: "a typo must stop capture rather than silently redirect").
# A dist-only image is not a real project root, so it never passed that
# check. Shipping the actual source tree here also matches how Replit itself
# runs the app (source always co-located with the process), rather than
# weakening a deliberately strict guard to work around a packaging shortcut.
COPY . .

# Carry over the build stage's full node_modules rather than reinstalling
# with --omit=dev. server/vite.ts statically imports the real `vite` package
# (for local-dev HMR) at module load time -- ESM imports aren't lazy, so
# server/index.ts pulls it in even in production even though setupVite() is
# never called there. `vite` and its plugin chain are devDependencies; a
# --omit=dev install throws ERR_MODULE_NOT_FOUND at boot. Reusing the proven
# build-stage node_modules sidesteps chasing each transitively-missing
# devDependency one at a time.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN npx playwright install chromium

# The app reads PORT itself (server/index.ts) and defaults to 5000; Render
# sets PORT automatically, so this EXPOSE is documentation, not a requirement.
EXPOSE 5000

# Not `npm run start`: that script shells out to `cross-env` (Windows-only
# dev convenience), which is a devDependency the runtime stage deliberately
# omits. NODE_ENV=production is already set at the image level above, so
# invoking node directly is both correct and one less process layer.
CMD ["node", "dist/index.js"]
