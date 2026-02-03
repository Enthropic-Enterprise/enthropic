# dashboard.Dockerfile
# Production build for Vite + React frontend (dashboard)
# Uses nginx to serve static files (best practice for frontend)

# --------------------- Builder Stage ---------------------
FROM node:18-alpine AS builder

WORKDIR /app

# 1. Copy root lockfile & package.json (monorepo requirement)
COPY package*.json ./

# 2. Copy dashboard package.json
COPY apps/dashboard/package*.json ./apps/dashboard/

# 3. Install dependencies
RUN npm ci --omit=dev

# 4. Copy dashboard source code
COPY apps/dashboard ./apps/dashboard

# 5. Build Vite app (outputs to dist folder)
RUN npm run build --workspace=dashboard

# --------------------- Production Stage ---------------------
FROM nginx:stable-alpine

# Copy built static files from builder stage
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]