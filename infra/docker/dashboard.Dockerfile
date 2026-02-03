FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/dashboard/package*.json ./apps/dashboard/
RUN npm ci
COPY apps/dashboard ./apps/dashboard
RUN cd apps/dashboard && npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
