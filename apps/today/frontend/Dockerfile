# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Install curl and bind-tools (for nslookup) for backend discovery
RUN apk add --no-cache curl bind-tools

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy and setup entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default backend host
ENV BACKEND_HOST=backend

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
