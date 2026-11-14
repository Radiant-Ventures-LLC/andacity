# Andacity dev/demo image (dev.andacity.com).
# Build context is the repo root:  docker build -f deploy/dev/Dockerfile .
#
# Targets:
#   tools   — full source + dev deps; runs migrations and the seed scripts
#   runtime — slim production server (Fastify SSR)

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS tools
COPY . .
ARG APP_ORIGIN=https://dev.andacity.com
ENV ORIGIN=${APP_ORIGIN}
RUN pnpm run build && pnpm run build.server

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --chown=node:node package.json ./
# Full deps: the SSR bundle imports packages listed as devDependencies (e.g. undici).
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=tools --chown=node:node /app/dist ./dist
COPY --from=tools --chown=node:node /app/server ./server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/entry.fastify"]
