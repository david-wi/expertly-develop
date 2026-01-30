# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy admin frontend package files
COPY apps/admin/frontend/package*.json ./apps/admin/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky, then install native modules for Alpine/musl
RUN npm install --workspace=apps/admin/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl lightningcss-linux-x64-musl --save-optional

# Copy source code
COPY apps/admin/frontend ./apps/admin/frontend

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Build the application
WORKDIR /app/apps/admin/frontend
RUN npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Copy nginx config
COPY apps/admin/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/admin/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
