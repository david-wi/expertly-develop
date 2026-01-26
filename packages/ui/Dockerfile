# Build stage
FROM node:20-alpine AS builder

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
RUN npm run build

# Production stage - serve static files
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy version.json from public folder (generated during build)
COPY --from=builder /app/public/version.json /usr/share/nginx/html/version.json

# Configure nginx for SPA and CORS
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # CORS headers for federation \
    add_header Access-Control-Allow-Origin *; \
    add_header Access-Control-Allow-Methods "GET, OPTIONS"; \
    add_header Access-Control-Allow-Headers "*"; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Serve remoteEntry.js from assets folder (vite-plugin-federation output) \
    location = /remoteEntry.js { \
        alias /usr/share/nginx/html/assets/remoteEntry.js; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
        add_header Access-Control-Allow-Origin *; \
    } \
    \
    # No cache for version.json - always get latest \
    location = /version.json { \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
        add_header Access-Control-Allow-Origin *; \
    } \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
        add_header Access-Control-Allow-Origin *; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
