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

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright install chromium

COPY --from=build /app/dist ./dist

# The app reads PORT itself (server/index.ts) and defaults to 5000; Render
# sets PORT automatically, so this EXPOSE is documentation, not a requirement.
EXPOSE 5000

CMD ["npm", "run", "start"]
