# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/
COPY packages/agent/package*.json ./packages/agent/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build both packages
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install curl for healthcheck and bash/grep for tool execution
RUN apt-get update && apt-get install -y --no-install-recommends curl bash grep git && rm -rf /var/lib/apt/lists/*

# Create workspace directory for sessions
RUN mkdir -p /workspace && chmod 777 /workspace

# Copy package files for production install
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=@expertly-vibecode/server

# Copy built server
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Copy built client (served by Express)
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start server
CMD ["npm", "run", "start"]
