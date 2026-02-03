# dashboard.Dockerfile
# Production-ready Vite/React dashboard with nginx

# --------------------- Builder Stage ---------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root lockfile (monorepo requirement)
COPY package*.json ./

# Copy this service's package.json
COPY apps/dashboard/package*.json ./apps/dashboard/

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY apps/dashboard ./apps/dashboard

# Build Vite app
RUN npm run build --workspace=dashboard

# --------------------- Production Stage ---------------------
FROM nginx:stable-alpine

# Copy built static files
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
