# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Accept build args
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy vibetest frontend package files
COPY apps/vibetest/frontend/package*.json ./apps/vibetest/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
RUN npm install --workspace=apps/vibetest/frontend

# Copy source code
COPY apps/vibetest/frontend ./apps/vibetest/frontend

# Build the application with timestamp
WORKDIR /app/apps/vibetest/frontend
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/apps/vibetest/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/vibetest/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
