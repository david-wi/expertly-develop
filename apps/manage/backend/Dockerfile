FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy identity-client package first
COPY packages/identity-client /tmp/identity-client

# Install Python dependencies
COPY apps/manage/backend/requirements.txt .
RUN pip install --no-cache-dir /tmp/identity-client && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /tmp/identity-client

# Copy application code
COPY apps/manage/backend/app/ app/

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
