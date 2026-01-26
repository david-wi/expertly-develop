FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy package files
COPY apps/define/package.json apps/define/package-lock.json ./

# Copy the shared packages
COPY packages/ui ./packages/ui
COPY packages/auth ./packages/auth

# Update package.json to use local paths for shared packages
RUN sed -i 's|"@expertly/ui": "\*"|"@expertly/ui": "file:./packages/ui"|' package.json
RUN sed -i 's|"@expertly/auth": "workspace:\*"|"@expertly/auth": "file:./packages/auth"|' package.json

# Install dependencies
RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Accept build args
ARG NEXT_PUBLIC_BUILD_TIMESTAMP

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/define .

# Build the application with timestamp
RUN NEXT_PUBLIC_BUILD_TIMESTAMP=${NEXT_PUBLIC_BUILD_TIMESTAMP:-$(date +%s)} npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV IDENTITY_API_URL=https://identity-api.ai.devintensive.com
ENV IDENTITY_URL=https://identity.ai.devintensive.com
ENV NEXT_PUBLIC_IDENTITY_API_URL=https://identity-api.ai.devintensive.com

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
