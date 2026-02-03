# Stage 1: build frontend
FROM node:20-alpine AS build
WORKDIR /app

# Copy only dashboard package files (avoid requiring root package-lock)
COPY apps/dashboard/package*.json ./

# Install dependencies (safe: if package-lock exists, npm will use it)
RUN npm install --omit=dev

# Copy dashboard source and build
COPY apps/dashboard ./
# If your frontend build script differs, update `npm run build`
RUN npm run build --if-present

# Stage 2: serve with nginx
FROM nginx:alpine
# Remove default content
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files (assumes build output -> /app/dist)
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
