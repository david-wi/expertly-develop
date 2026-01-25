# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept API URL as build arg
ARG VITE_API_URL=/api/v1

# Copy root package files for workspaces
COPY package.json package-lock.json* ./

# Copy packages directory
COPY packages/ ./packages/

# Copy frontend package.json
COPY apps/develop/frontend/package.json ./apps/develop/frontend/

# Install all dependencies from root (handles workspaces)
RUN npm install --workspaces --include-workspace-root

# Copy frontend source code
COPY apps/develop/frontend/ ./apps/develop/frontend/

# Set environment variable for Vite build
ENV VITE_API_URL=$VITE_API_URL

# Build the application
WORKDIR /app/apps/develop/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/develop/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/develop/frontend/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
