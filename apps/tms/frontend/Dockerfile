# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Accept build args
ARG VITE_API_URL
ARG VITE_BUILD_TIMESTAMP

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL

# Copy monorepo package files for workspace resolution
COPY package.json package-lock.json ./

# Copy the UI package (workspace dependency)
COPY packages/ui ./packages/ui

# Copy TMS frontend package files
COPY apps/tms/frontend/package*.json ./apps/tms/frontend/

# Install dependencies from monorepo root (resolves workspace packages)
# Use --ignore-scripts to skip husky, then rebuild native modules
RUN npm install --workspace=apps/tms/frontend --ignore-scripts && \
    npm install @rollup/rollup-linux-x64-musl --save-optional

# Copy source code
COPY apps/tms/frontend ./apps/tms/frontend

# Build the application with timestamp
WORKDIR /app/apps/tms/frontend
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/apps/tms/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/tms/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
