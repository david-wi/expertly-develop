# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy the shared UI package first
COPY packages/ui ./packages/ui

# Accept build args
ARG VITE_BUILD_TIMESTAMP

# Copy package files
COPY apps/today/frontend/package*.json ./

# Add @expertly/ui as local dependency
RUN npm pkg set dependencies.@expertly/ui=file:./packages/ui

# Install dependencies
RUN npm install

# Copy source and build with timestamp
COPY apps/today/frontend .
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Install curl and bind-tools (for nslookup) for backend discovery
RUN apk add --no-cache curl bind-tools

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY apps/today/frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Copy and setup entrypoint script
COPY apps/today/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default backend host
ENV BACKEND_HOST=backend

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
