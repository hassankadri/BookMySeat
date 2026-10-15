
# =====================================================
# STAGE 1 — INSTALL PRODUCTION DEPENDENCIES
# =====================================================

FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi


# =====================================================
# STAGE 2 — PRODUCTION SERVER
# =====================================================

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Use the existing non-root "node" user.
# Only the writable memory directory needs ownership.
RUN mkdir -p /memory && \
    chown node:node /memory

# App files and dependencies only need read access.
COPY --from=dependencies /app/node_modules ./node_modules

COPY . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/ || exit 1

CMD ["node", "server.js"]
