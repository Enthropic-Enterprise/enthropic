
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/dashboard/package*.json ./apps/dashboard/
RUN npm ci --omit=dev
COPY apps/dashboard ./apps/dashboard
RUN npm run build --workspace=dashboard

FROM nginx:stable-alpine
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
