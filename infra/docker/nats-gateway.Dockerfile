# nats-gateway.Dockerfile
# Multi-stage build for NestJS + WebSocket service (nats-gateway)
# Optimized for monorepo with root package-lock.json

# --------------------- Builder Stage ---------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root lockfile (WAJIB untuk monorepo)
COPY package*.json ./

# Copy service package.json
COPY apps/nats-gateway/package*.json ./apps/nats-gateway/

# Install dependencies using root lockfile
RUN npm ci --omit=dev

# Copy source code
COPY apps/nats-gateway ./apps/nats-gateway

# Build
RUN npm run build --workspace=nats-gateway

# --------------------- Production Stage ---------------------
FROM node:18-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/nats-gateway/dist ./apps/nats-gateway/dist
COPY --from=builder /app/apps/nats-gateway/package.json ./apps/nats-gateway/

USER node

EXPOSE 8080 8081

CMD ["dumb-init", "node", "apps/nats-gateway/dist/main"]