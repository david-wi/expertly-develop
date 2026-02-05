# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_GIT_COMMIT

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy hear frontend package files
COPY apps/hear/frontend/package*.json ./apps/hear/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky, then rebuild native modules
RUN npm install --workspace=apps/hear/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code
COPY apps/hear/frontend ./apps/hear/frontend

# Set environment variables for Vite build
ENV VITE_GIT_COMMIT=$VITE_GIT_COMMIT

# Build the application
WORKDIR /app/apps/hear/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/hear/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/hear/frontend/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
