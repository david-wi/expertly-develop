# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com
ARG VITE_GIT_COMMIT

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy identity frontend package files
COPY apps/identity/frontend/package*.json ./apps/identity/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky prepare script in Docker
RUN npm install --workspace=apps/identity/frontend --ignore-scripts

# Copy source code
COPY apps/identity/frontend ./apps/identity/frontend

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL
ENV VITE_GIT_COMMIT=$VITE_GIT_COMMIT

# Build the application
WORKDIR /app/apps/identity/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/identity/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/identity/frontend/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
