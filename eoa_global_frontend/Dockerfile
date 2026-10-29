# ==========================================
# EOA Global Frontend - Production Dockerfile
# ==========================================

# Stage 1: Build React 18 + Vite SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for Docker caching
COPY package.json ./
RUN npm install

# Copy source code and build
COPY . ./
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:1.25-alpine AS runner

# Remove default nginx configs
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom reverse-proxy and WebSocket configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
