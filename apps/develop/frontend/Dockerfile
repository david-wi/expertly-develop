# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL=/api/v1
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com
ARG VITE_GIT_COMMIT

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy develop frontend package files
COPY apps/develop/frontend/package*.json ./apps/develop/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky, then rebuild native modules
RUN npm install --workspace=apps/develop/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code
COPY apps/develop/frontend ./apps/develop/frontend

# Set environment variables for Vite build
# UI components loaded via Module Federation from VITE_UI_REMOTE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL
ENV VITE_GIT_COMMIT=$VITE_GIT_COMMIT

# Build the application with timestamp
WORKDIR /app/apps/develop/frontend
RUN if [ -z "$VITE_BUILD_TIMESTAMP" ]; then \
      export VITE_BUILD_TIMESTAMP=$(date +%s); \
    else \
      export VITE_BUILD_TIMESTAMP=$VITE_BUILD_TIMESTAMP; \
    fi && \
    echo "Build timestamp: $VITE_BUILD_TIMESTAMP" && \
    echo "UI Remote URL: $VITE_UI_REMOTE_URL" && \
    echo "Git commit: $VITE_GIT_COMMIT" && \
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
