# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Accept build args
ARG VITE_API_URL
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy command frontend package files
COPY apps/command/frontend/package*.json ./apps/command/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky, then rebuild native modules
RUN npm install --workspace=apps/command/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code
COPY apps/command/frontend ./apps/command/frontend

# Build the application with timestamp
WORKDIR /app/apps/command/frontend
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date -u +%y%m%d.%H%M%S)} npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/apps/command/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/command/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
