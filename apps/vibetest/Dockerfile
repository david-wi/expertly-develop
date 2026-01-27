# Multi-stage build for Vibe QA
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM python:3.12-slim AS backend

WORKDIR /app

# Install system dependencies for Playwright and nginx
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    fonts-unifont \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser only (deps already installed above)
RUN playwright install chromium

# Copy backend code
COPY backend/ .

# Copy frontend build
COPY --from=frontend-build /frontend/dist /app/static

# Create data directories
RUN mkdir -p /app/data/artifacts

# Copy nginx config for serving static files
RUN echo 'server { \
    listen 80; \
    root /app/static; \
    location /api { \
        proxy_pass http://127.0.0.1:8000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/sites-available/default

# Create startup script
RUN echo '#!/bin/bash\n\
nginx\n\
exec uvicorn app.main:app --host 0.0.0.0 --port 8000\n\
' > /start.sh && chmod +x /start.sh

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV ARTIFACTS_PATH=/app/data/artifacts

EXPOSE 80

CMD ["/start.sh"]
