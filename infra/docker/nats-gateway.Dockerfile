# =========================
# deps stage
# =========================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy workspace-level config (YANG MEMANG ADA)
COPY package.json ./
COPY nx.json tsconfig.base.json ./

# Copy app-level package.json (WAJIB ADA)
COPY apps/nats-gateway/package.json ./apps/nats-gateway/package.json

# Install dependencies (tanpa lockfile = VALID)
RUN npm install

# =========================
# builder stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules dari deps
COPY --from=deps /app/node_modules ./node_modules

# Copy full workspace source
COPY . .

# Build nats-gateway via Nx
RUN npx nx build nats-gateway

# =========================
# production stage
# =========================
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install minimal runtime deps
RUN apk add --no-cache dumb-init

# Copy built output
COPY --from=builder /app/dist/apps/nats-gateway ./dist

# Copy app package.json (untuk metadata)
COPY apps/nats-gateway/package.json ./package.json

# Expose port
EXPOSE 3002

# Run
CMD ["dumb-init", "node", "dist/main.js"]
