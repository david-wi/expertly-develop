FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy identity-client package first
COPY packages/identity-client /tmp/identity-client

# Copy requirements and install dependencies
COPY apps/define/backend/requirements.txt .
RUN pip install --no-cache-dir /tmp/identity-client && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /tmp/identity-client

# Copy application code
COPY apps/define/backend/app/ app/

# Create data directory for SQLite
RUN mkdir -p /app/data /app/uploads

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:///./data/expertly-define.db
ENV UPLOADS_DIR=./uploads

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
