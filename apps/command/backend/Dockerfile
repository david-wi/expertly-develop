FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy shared packages
COPY packages/identity-client /tmp/identity-client
COPY packages/ai-config /tmp/ai-config
COPY packages/artifacts /tmp/artifacts
COPY packages/artifacts-mongo /tmp/artifacts-mongo

# Install Python dependencies
COPY apps/command/backend/requirements.txt .
RUN pip install --no-cache-dir /tmp/identity-client && \
    pip install --no-cache-dir /tmp/ai-config && \
    pip install --no-cache-dir /tmp/artifacts && \
    pip install --no-cache-dir /tmp/artifacts-mongo && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /tmp/identity-client /tmp/ai-config /tmp/artifacts /tmp/artifacts-mongo

# Copy application code
COPY apps/command/backend/app/ app/

# Create uploads directory for avatar storage
RUN mkdir -p /app/uploads/avatars

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
