# Multi-Stage Production Dockerfile for SPU Agro-Retail Backend
# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools for native addons (e.g. argon2)
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY . .

# Run type check verification
RUN npm run typecheck

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install lightweight process supervisor & postgres client tools
RUN apk add --no-cache dumb-init postgresql-client

# Copy application files and installed dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/config ./config
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/models ./models
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/src ./src
COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Prepare uploads folder with appropriate non-root permissions
RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
