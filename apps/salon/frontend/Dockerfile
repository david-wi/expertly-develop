# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Build arguments
ARG VITE_API_URL=http://localhost:8000/api/v1
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy salon frontend package files
COPY apps/salon/frontend/package*.json ./apps/salon/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky prepare script in Docker
RUN npm install --workspace=apps/salon/frontend --ignore-scripts

# Copy source code
COPY apps/salon/frontend ./apps/salon/frontend

# Build the application with timestamp
WORKDIR /app/apps/salon/frontend
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production image
FROM nginx:alpine

# Copy built files
COPY --from=build /app/apps/salon/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/salon/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
