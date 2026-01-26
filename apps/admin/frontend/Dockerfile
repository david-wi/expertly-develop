# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL

# Copy shared UI package
COPY packages/ui ./packages/ui

# Install UI package dependencies
WORKDIR /app/packages/ui
RUN npm install

# Copy frontend package files and install deps
WORKDIR /app/apps/admin/frontend
COPY apps/admin/frontend/package.json apps/admin/frontend/package-lock.json* ./
RUN npm install

# Copy frontend source code
COPY apps/admin/frontend ./

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Copy nginx config
COPY apps/admin/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/apps/admin/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
