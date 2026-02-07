FROM python:3.12-slim

WORKDIR /app

# Copy identity-client package first
COPY packages/identity-client /tmp/identity-client

# Install dependencies
COPY apps/intake/backend/requirements.txt .
RUN pip install --no-cache-dir /tmp/identity-client && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /tmp/identity-client

# Copy application code
COPY apps/intake/backend/app ./app

# Validate app loads
RUN python -c "from app.main import app; print('FastAPI app validated successfully')"

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
