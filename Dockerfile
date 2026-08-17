# syntax=docker/dockerfile:1.7

FROM node:24.19.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY config ./config
COPY src ./src
COPY web ./web
RUN npm run build


FROM node:24.19.0-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:24.19.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY=/var/lib/mockd/draft-tools

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist/src ./dist/src
COPY --from=build --chown=node:node /app/dist/config ./dist/config
COPY --from=build --chown=node:node /app/dist/web ./dist/web
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node data/raw/espn-projections-2026-weeks-1-4.json ./data/raw/espn-projections-2026-weeks-1-4.json
COPY --chown=node:node data/raw/player-evidence-2026-initial.csv ./data/raw/player-evidence-2026-initial.csv
COPY --chown=node:node data/raw/season-long-projections-2026.json ./data/raw/season-long-projections-2026.json
COPY --chown=node:node data/raw/fantasy-draft-rankings-2026 ./data/raw/fantasy-draft-rankings-2026

RUN install -d -o node -g node /var/lib/mockd/draft-tools

VOLUME ["/var/lib/mockd/draft-tools"]
EXPOSE 3000

USER node

STOPSIGNAL SIGTERM
CMD ["/bin/sh", "-c", "node dist/src/platform/checkPlatformProductionReadiness.js && exec node dist/src/platform/startPlatformWeb.js"]
