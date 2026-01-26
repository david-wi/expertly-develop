# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy the shared UI package first
COPY packages/ui ./packages/ui

# Build argument for API URL
ARG VITE_API_URL=http://localhost:8000/api/v1
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY apps/salon/frontend/package*.json ./

# Add @expertly/ui as local dependency
RUN npm pkg set dependencies.@expertly/ui=file:./packages/ui

# Install dependencies
RUN npm install

# Copy source and build
COPY apps/salon/frontend .
RUN npm run build

# Production image
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/salon/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
