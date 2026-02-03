# Multi-stage build for Auth Service
FROM node:18-alpine AS builder

WORKDIR /app

COPY apps/auth-service/package*.json ./
COPY apps/auth-service/tsconfig.json ./

RUN npm ci --only=production && \
    npm cache clean --force

COPY apps/auth-service/src ./src
COPY apps/auth-service/prisma ./prisma

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:18-alpine

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]
