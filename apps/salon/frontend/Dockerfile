# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments
ARG VITE_API_URL=http://localhost:8000/api/v1
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy salon frontend (full source, not just package.json)
COPY apps/salon/frontend ./apps/salon/frontend

# Install dependencies
RUN npm ci --ignore-scripts

# Explicitly install the vite build dependencies with specific versions
# (npm ci doesn't always hoist devDependencies correctly in monorepo Docker builds)
RUN npm install "@vitejs/plugin-react@^4.3.4" "autoprefixer@^10.4.20" "postcss@^8.4.49" "tailwindcss@^3.4.17" "@rollup/rollup-linux-x64-musl" --save-optional

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Build the application with timestamp
WORKDIR /app/apps/salon/frontend
RUN if [ -z "$VITE_BUILD_TIMESTAMP" ]; then \
      export VITE_BUILD_TIMESTAMP=$(date +%s); \
    else \
      export VITE_BUILD_TIMESTAMP=$VITE_BUILD_TIMESTAMP; \
    fi && \
    VITE_BUILD_TIMESTAMP=$VITE_BUILD_TIMESTAMP npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/salon/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/salon/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
