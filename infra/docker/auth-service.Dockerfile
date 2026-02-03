# auth-service.Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/auth-service/package*.json ./apps/auth-service/

RUN npm ci --omit=dev

COPY apps/auth-service ./apps/auth-service
RUN npm run build --workspace=auth-service

FROM node:18-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/

USER node
EXPOSE 3000
CMD ["dumb-init", "node", "apps/auth-service/dist/main"]