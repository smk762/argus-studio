# 22.23.4 rejects certificate chains that contain the compromised eMudhra
# intermediate keys and updates Node's bundled roots to NSS 3.131.1. A floating
# 22-alpine tag can stay cached on a pre-incident digest.
# https://discuss.python.org/t/information-for-python-users-regarding-emudhra-emsign-ca-certificate-security-incident/109576
FROM node:22.23.4-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM base AS builder
WORKDIR /app
# No NEXT_PUBLIC_* build args: the API endpoints and curator UI mode are read
# from the container's environment at request time (ARGUS_* — see
# src/lib/runtimeConfig.ts), so one published image deploys to any origin.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
