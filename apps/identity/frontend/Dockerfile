# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com

# Copy frontend package files and install deps
COPY apps/identity/frontend/package.json apps/identity/frontend/package-lock.json* ./
RUN npm install

# Copy frontend source code
COPY apps/identity/frontend ./

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY apps/identity/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
