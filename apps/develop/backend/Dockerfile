FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy identity-client package first
COPY packages/identity-client /tmp/identity-client

# Copy requirements first for better caching
COPY apps/develop/backend/requirements.txt .
RUN pip install --no-cache-dir /tmp/identity-client && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /tmp/identity-client

# Copy application code
COPY apps/develop/backend/app/ app/

# Validate FastAPI app loads (fail fast on syntax errors or missing imports)
RUN python -c "from app.main import app; print('FastAPI app validated successfully')"

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
