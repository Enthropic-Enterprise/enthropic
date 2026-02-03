# auth-service.Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root files (lockfile + package.json)
COPY package*.json ./

# Copy this service's package.json
COPY apps/auth-service/package*.json ./apps/auth-service/

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY apps/auth-service ./apps/auth-service

# Build (gunakan cd agar tidak bergantung pada --workspace flag)
RUN cd apps/auth-service && npm run build

# --------------------- Production Stage ---------------------
FROM node:18-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/

USER node

EXPOSE 3000

CMD ["dumb-init", "node", "apps/auth-service/dist/main"]