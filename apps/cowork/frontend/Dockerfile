# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_GIT_COMMIT

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy cowork frontend package files
COPY apps/cowork/frontend/package*.json ./apps/cowork/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky, then rebuild native modules
RUN npm install --workspace=apps/cowork/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code
COPY apps/cowork/frontend ./apps/cowork/frontend

# Set environment variables for Vite build
ENV VITE_GIT_COMMIT=$VITE_GIT_COMMIT

# Build the application
WORKDIR /app/apps/cowork/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/cowork/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/cowork/frontend/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
