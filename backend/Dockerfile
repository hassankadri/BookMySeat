FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi


FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules

COPY . .

RUN addgroup -S bookmyseat && \
    adduser -S bookmyseat -G bookmyseat && \
    mkdir -p /memory && \
    chown -R bookmyseat:bookmyseat /app /memory

USER bookmyseat

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/ || exit 1

CMD ["node", "server.js"]q