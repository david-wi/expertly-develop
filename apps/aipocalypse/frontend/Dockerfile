# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy aipocalypse frontend package files
COPY apps/aipocalypse/frontend/package*.json ./apps/aipocalypse/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
RUN npm install --workspace=apps/aipocalypse/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code
COPY apps/aipocalypse/frontend ./apps/aipocalypse/frontend

# Build the application
WORKDIR /app/apps/aipocalypse/frontend
ARG VITE_BUILD_TIMESTAMP
ARG VITE_GIT_COMMIT
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/apps/aipocalypse/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/aipocalypse/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
