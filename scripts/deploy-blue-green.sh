#!/bin/bash
# Blue/Green Deployment Script for Expertly Platform
# This script manages blue/green deployments with zero-downtime switching

set -e

DEPLOY_PATH="/opt/expertly-develop"
STATE_FILE="/opt/deployment-state.json"
TRAEFIK_DYNAMIC="/opt/traefik/dynamic"

# Initialize state file if it doesn't exist
init_state() {
    if [ ! -f "$STATE_FILE" ]; then
        echo '{"active": "blue", "last_deploy": ""}' > "$STATE_FILE"
    fi
}

# Get current active deployment color
get_active_color() {
    jq -r '.active' "$STATE_FILE"
}

# Get inactive color
get_inactive_color() {
    local active=$(get_active_color)
    if [ "$active" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Set active deployment
set_active_color() {
    local color=$1
    local timestamp=$(date -Iseconds)
    jq --arg color "$color" --arg time "$timestamp" \
        '.active = $color | .last_deploy = $time' "$STATE_FILE" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"
}

# Build and start containers for a specific color
deploy_color() {
    local color=$1
    echo "=== Deploying to $color environment ==="

    cd "$DEPLOY_PATH"

    # Set environment variables for this deployment
    export DEPLOY_COLOR=$color
    export GIT_COMMIT=$(git rev-parse --short HEAD)
    export BUILD_TIMESTAMP=$(date -u +%y%m%d.%H%M%S)

    # Build and start with color suffix
    COMPOSE_PROJECT_NAME="expertly-${color}" \
        docker compose -f docker-compose.prod.yml build --parallel

    COMPOSE_PROJECT_NAME="expertly-${color}" \
        docker compose -f docker-compose.prod.yml up -d

    echo "=== $color deployment started ==="
}

# Stop containers for a specific color
stop_color() {
    local color=$1
    echo "=== Stopping $color environment ==="

    cd "$DEPLOY_PATH"

    COMPOSE_PROJECT_NAME="expertly-${color}" \
        docker compose -f docker-compose.prod.yml down --remove-orphans || true

    echo "=== $color environment stopped ==="
}

# Health check for a deployment
health_check() {
    local color=$1
    local max_attempts=30
    local attempt=0

    echo "=== Running health checks for $color ==="

    # List of services to check (container names follow pattern: expertly-{color}-{service}-1)
    local services=("define-backend" "develop-backend" "identity-backend" "manage-backend" "vibetest-backend" "salon-backend" "today-backend" "vibecode")

    for service in "${services[@]}"; do
        local container="expertly-${color}-${service}-1"
        echo "Checking $container..."

        attempt=0
        while [ $attempt -lt $max_attempts ]; do
            if docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null | grep -q "healthy"; then
                echo "  ✓ $container is healthy"
                break
            elif docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null | grep -q "running"; then
                # No health check defined, just check if running
                echo "  ✓ $container is running"
                break
            fi

            attempt=$((attempt + 1))
            sleep 2
        done

        if [ $attempt -eq $max_attempts ]; then
            echo "  ✗ $container failed health check"
            return 1
        fi
    done

    echo "=== All health checks passed for $color ==="
    return 0
}

# Switch Traefik routing to a specific color
switch_traffic() {
    local color=$1
    echo "=== Switching traffic to $color ==="

    # Generate Traefik dynamic config for the active color
    cat > "${TRAEFIK_DYNAMIC}/expertly-routing.yaml" << EOF
# Auto-generated routing config - Active: $color
# Generated at: $(date -Iseconds)

http:
  routers:
    # Route to $color deployment containers
    define-frontend:
      rule: Host(\`define.ai.devintensive.com\`)
      entrypoints: [https]
      service: define-frontend
      tls:
        certResolver: letsencrypt
    develop-frontend:
      rule: Host(\`develop.ai.devintensive.com\`)
      entrypoints: [https]
      service: develop-frontend
      tls:
        certResolver: letsencrypt
    identity-frontend:
      rule: Host(\`identity.ai.devintensive.com\`)
      entrypoints: [https]
      service: identity-frontend
      tls:
        certResolver: letsencrypt
    admin-frontend:
      rule: Host(\`admin.ai.devintensive.com\`)
      entrypoints: [https]
      service: admin-frontend
      tls:
        certResolver: letsencrypt
    manage-frontend:
      rule: Host(\`manage.ai.devintensive.com\`)
      entrypoints: [https]
      service: manage-frontend
      tls:
        certResolver: letsencrypt
    salon-frontend:
      rule: Host(\`salon.ai.devintensive.com\`)
      entrypoints: [https]
      service: salon-frontend
      tls:
        certResolver: letsencrypt
    today-frontend:
      rule: Host(\`today.ai.devintensive.com\`)
      entrypoints: [https]
      service: today-frontend
      tls:
        certResolver: letsencrypt
    vibetest-frontend:
      rule: Host(\`vibetest.ai.devintensive.com\`)
      entrypoints: [https]
      service: vibetest-frontend
      tls:
        certResolver: letsencrypt
    vibecode:
      rule: Host(\`vibecode.ai.devintensive.com\`)
      entrypoints: [https]
      service: vibecode
      tls:
        certResolver: letsencrypt

  services:
    define-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-define-frontend-1:80
    develop-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-develop-frontend-1:80
    identity-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-identity-frontend-1:80
    admin-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-admin-frontend-1:80
    manage-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-manage-frontend-1:80
    salon-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-salon-frontend-1:80
    today-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-today-frontend-1:80
    vibetest-frontend:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-vibetest-frontend-1:80
    vibecode:
      loadBalancer:
        servers:
          - url: http://expertly-${color}-vibecode-1:3001
EOF

    # Update state
    set_active_color "$color"

    # Traefik should auto-reload the config
    echo "=== Traffic switched to $color ==="
}

# Main deployment function
deploy() {
    init_state

    local current=$(get_active_color)
    local target=$(get_inactive_color)

    echo "Current active: $current"
    echo "Deploying to: $target"

    # Pull latest code
    cd "$DEPLOY_PATH"
    git pull origin main

    # Deploy to inactive color
    deploy_color "$target"

    # Wait for containers to be ready
    sleep 10

    # Run health checks
    if ! health_check "$target"; then
        echo "=== Health check failed! Rolling back ==="
        stop_color "$target"
        exit 1
    fi

    echo "=== Deployment to $target successful ==="
    echo "=== Run visual verification, then call: $0 switch ==="
}

# Switch traffic after verification
switch() {
    init_state

    local target=$(get_inactive_color)
    local old=$(get_active_color)

    echo "Switching from $old to $target"

    # Switch Traefik routing
    switch_traffic "$target"

    # Wait for traffic to drain from old deployment
    echo "Waiting for traffic to drain..."
    sleep 30

    # Stop old deployment
    stop_color "$old"

    # Clean up old images
    docker image prune -f

    echo "=== Blue/green switch complete ==="
    echo "Active deployment: $target"
}

# Rollback to previous deployment
rollback() {
    init_state

    local current=$(get_active_color)
    local target=$(get_inactive_color)

    echo "Rolling back from $current to $target"

    # Start the old deployment if not running
    deploy_color "$target"

    # Wait for it to be ready
    sleep 10

    if health_check "$target"; then
        switch_traffic "$target"
        sleep 30
        stop_color "$current"
        echo "=== Rollback complete ==="
    else
        echo "=== Rollback failed - old deployment unhealthy ==="
        exit 1
    fi
}

# Show current status
status() {
    init_state

    echo "=== Deployment Status ==="
    echo "Active color: $(get_active_color)"
    echo "Last deploy: $(jq -r '.last_deploy' "$STATE_FILE")"
    echo ""
    echo "Blue containers:"
    docker ps --filter "name=expertly-blue" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  None running"
    echo ""
    echo "Green containers:"
    docker ps --filter "name=expertly-green" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  None running"
}

# Parse command
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    switch)
        switch
        ;;
    rollback)
        rollback
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {deploy|switch|rollback|status}"
        exit 1
        ;;
esac
