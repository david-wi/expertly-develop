# Build stage
FROM node:20-alpine AS builder

# Cache buster - change this to force rebuild: 2026-01-26-v2
ARG CACHE_BUST=1

# Install git for version script
RUN apk add --no-cache git

WORKDIR /app

# Accept build args for version info
ARG GIT_COMMIT
ARG GIT_BRANCH=main

# Set environment variables for version script fallback
ENV GIT_COMMIT=${GIT_COMMIT}
ENV GIT_BRANCH=${GIT_BRANCH}

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the federation remote (prebuild generates version.json)
RUN npm run build && echo "=== Build output ===" && ls -la dist/ && ls -la dist/assets/ | head -20

# Production stage - serve static files
FROM nginx:alpine

# Copy built files to nginx (vite copies public/* to dist/ automatically)
COPY --from=builder /app/dist /usr/share/nginx/html

# Configure nginx for SPA and CORS
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Serve remoteEntry.js from assets folder at root URL \
    location = /remoteEntry.js { \
        alias /usr/share/nginx/html/assets/remoteEntry.js; \
        add_header Access-Control-Allow-Origin * always; \
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always; \
        add_header Cache-Control "no-cache" always; \
    } \
    \
    location / { \
        # Handle OPTIONS preflight requests \
        if ($request_method = OPTIONS) { \
            add_header Access-Control-Allow-Origin * always; \
            add_header Access-Control-Allow-Methods "GET, OPTIONS" always; \
            add_header Access-Control-Allow-Headers "*" always; \
            add_header Content-Length 0; \
            add_header Content-Type text/plain; \
            return 204; \
        } \
        \
        add_header Access-Control-Allow-Origin * always; \
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always; \
        add_header Access-Control-Allow-Headers "*" always; \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # No cache for version.json - always get latest \
    location = /version.json { \
        add_header Cache-Control "no-cache, no-store, must-revalidate" always; \
        add_header Access-Control-Allow-Origin * always; \
    } \
    \
    # Cache static assets with CORS \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        if ($request_method = OPTIONS) { \
            add_header Access-Control-Allow-Origin * always; \
            add_header Access-Control-Allow-Methods "GET, OPTIONS" always; \
            add_header Access-Control-Allow-Headers "*" always; \
            add_header Content-Length 0; \
            add_header Content-Type text/plain; \
            return 204; \
        } \
        \
        expires 1y; \
        add_header Cache-Control "public, immutable" always; \
        add_header Access-Control-Allow-Origin * always; \
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
