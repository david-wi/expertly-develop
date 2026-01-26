#!/bin/sh
set -e

echo "Starting backend discovery..."

discover_backend() {
    # Get all IPv4 addresses for 'today-backend'
    BACKEND_IPS=$(nslookup today-backend 127.0.0.11 2>/dev/null | grep "Address:" | grep -v "127.0.0.11" | grep -E "^Address: [0-9]" | awk '{print $2}')

    echo "Found backend IPs: $BACKEND_IPS" >&2

    # Look for a backend that responds with "Expertly Today API"
    for host in $BACKEND_IPS; do
        echo "Testing $host..." >&2
        response=$(curl -s --connect-timeout 2 "http://$host:8000/" 2>/dev/null || echo "")
        if [ -n "$response" ]; then
            echo "Response from $host: $response" >&2
            if echo "$response" | grep -q "Expertly Today API"; then
                echo "*** MATCH: Found Expertly Today API at $host ***" >&2
                echo "$host"
                return 0
            fi
        fi
    done
    return 1
}

# Try to discover backend with retries
FOUND_BACKEND=""
MAX_RETRIES=10
RETRY_DELAY=3

for i in $(seq 1 $MAX_RETRIES); do
    echo "Discovery attempt $i of $MAX_RETRIES..."
    FOUND_BACKEND=$(discover_backend)
    if [ -n "$FOUND_BACKEND" ]; then
        break
    fi
    echo "Backend not ready yet, waiting ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
done

if [ -n "$FOUND_BACKEND" ]; then
    BACKEND_HOST="$FOUND_BACKEND"
    echo "Setting BACKEND_HOST=$BACKEND_HOST"
else
    echo "WARNING: Could not discover Expertly Today backend after $MAX_RETRIES attempts, using default 'today-backend'"
    BACKEND_HOST="today-backend"
fi

export BACKEND_HOST

# Process nginx template
envsubst '${BACKEND_HOST}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting nginx with BACKEND_HOST=$BACKEND_HOST"

# Start nginx
exec nginx -g 'daemon off;'
