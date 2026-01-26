# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Accept build args
ARG VITE_BUILD_TIMESTAMP
ARG VITE_UI_REMOTE_URL=https://ui.ai.devintensive.com
ENV VITE_UI_REMOTE_URL=$VITE_UI_REMOTE_URL

# Copy package files
COPY apps/qa/frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY apps/qa/frontend .

# Build the application with timestamp
RUN VITE_BUILD_TIMESTAMP=${VITE_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/qa/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
