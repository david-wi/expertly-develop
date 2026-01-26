# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy the shared UI package first
COPY packages/ui ./packages/ui

# Copy package files
COPY apps/qa/frontend/package*.json ./

# Add @expertly/ui as local dependency
RUN npm pkg set dependencies.@expertly/ui=file:./packages/ui

# Install dependencies
RUN npm install

# Copy source code
COPY apps/qa/frontend .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/qa/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
