# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy today frontend package files
COPY apps/today/frontend/package*.json ./apps/today/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky prepare script in Docker
RUN npm install --workspace=apps/today/frontend --ignore-scripts

# Copy source code
COPY apps/today/frontend ./apps/today/frontend

# Build the application with timestamp
WORKDIR /app/apps/today/frontend
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Install curl and bind-tools (for nslookup) for backend discovery
RUN apk add --no-cache curl bind-tools

# Copy built files
COPY --from=builder /app/apps/today/frontend/dist /usr/share/nginx/html

# Copy nginx config template
COPY apps/today/frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Copy and setup entrypoint script
COPY apps/today/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default backend host
ENV BACKEND_HOST=backend

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
