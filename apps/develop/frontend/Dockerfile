# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL=/api/v1
ARG VITE_BUILD_TIMESTAMP

# Copy shared UI package
COPY packages/ui ./packages/ui

# Install UI package dependencies
WORKDIR /app/packages/ui
RUN npm install

# Copy frontend package files and install deps
WORKDIR /app/apps/develop/frontend
COPY apps/develop/frontend/package.json apps/develop/frontend/package-lock.json* ./
RUN npm install

# Copy frontend source code
COPY apps/develop/frontend ./

# Set environment variables for Vite build
# If VITE_BUILD_TIMESTAMP is not provided, generate it at build time
ENV VITE_API_URL=$VITE_API_URL
RUN if [ -z "$VITE_BUILD_TIMESTAMP" ]; then \
      export VITE_BUILD_TIMESTAMP=$(date +%s); \
    else \
      export VITE_BUILD_TIMESTAMP=$VITE_BUILD_TIMESTAMP; \
    fi && \
    echo "Build timestamp: $VITE_BUILD_TIMESTAMP" && \
    VITE_BUILD_TIMESTAMP=$VITE_BUILD_TIMESTAMP npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/develop/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/develop/frontend/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
