FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/risk-service/package*.json ./apps/risk-service/
RUN npm ci
COPY apps/risk-service ./apps/risk-service
RUN cd apps/risk-service && npm run build

FROM node:18-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/risk-service/dist ./apps/risk-service/dist
COPY --from=builder /app/apps/risk-service/package.json ./apps/risk-service/
USER node
EXPOSE 3003
CMD ["dumb-init", "node", "apps/risk-service/dist/main"]
