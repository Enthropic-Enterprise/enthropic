FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/auth-service/package*.json ./apps/auth-service/
RUN npm ci
COPY apps/auth-service ./apps/auth-service
RUN cd apps/auth-service && npm run build

FROM node:20-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/
USER node
EXPOSE 3000
CMD ["dumb-init", "node", "apps/auth-service/dist/main"]
