# nats-gateway.Dockerfile
# Multi-stage build for NestJS + WebSocket service (nats-gateway)
# Optimized for monorepo with root package-lock.json

# --------------------- Builder Stage ---------------------
FROM node:18-alpine AS builder

WORKDIR /app

# 1. Copy root lockfile & package.json
COPY package*.json ./

# 2. Copy only this service's package.json
COPY apps/nats-gateway/package*.json ./apps/nats-gateway/

# 3. Install ALL dependencies using root lockfile
RUN npm ci --omit=dev

# 4. Copy source code of this service
COPY apps/nats-gateway ./apps/nats-gateway

# 5. Build the NestJS service
RUN npm run build --workspace=nats-gateway

# --------------------- Production Stage ---------------------
FROM node:18-alpine

# Add dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built dist folder
COPY --from=builder /app/apps/nats-gateway/dist ./apps/nats-gateway/dist

# Copy package.json
COPY --from=builder /app/apps/nats-gateway/package.json ./apps/nats-gateway/

# Run as non-root user
USER node

EXPOSE 8080 8081

# Use dumb-init + production start script
CMD ["dumb-init", "node", "apps/nats-gateway/dist/main"]