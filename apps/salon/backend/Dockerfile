FROM python:3.12-slim

WORKDIR /app

# Copy identity-client package first
COPY packages/identity-client /tmp/identity-client

# Install dependencies
COPY apps/salon/backend/requirements.txt .
RUN pip install --no-cache-dir /tmp/identity-client && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /tmp/identity-client

# Copy application code
COPY apps/salon/backend/app ./app
COPY apps/salon/backend/scripts ./scripts

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
