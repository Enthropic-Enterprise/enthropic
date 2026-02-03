FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/nats-gateway/package*.json ./apps/nats-gateway/
RUN npm ci
COPY apps/nats-gateway ./apps/nats-gateway
RUN cd apps/nats-gateway && npm run build

FROM node:20-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/nats-gateway/dist ./apps/nats-gateway/dist
COPY --from=builder /app/apps/nats-gateway/package.json ./apps/nats-gateway/
USER node
EXPOSE 8080 8081
CMD ["dumb-init", "node", "apps/nats-gateway/dist/main"]
