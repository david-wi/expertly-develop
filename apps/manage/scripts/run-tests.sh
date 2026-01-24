#!/bin/bash
set -e

echo "========================================"
echo "Expertly Manage - Test Suite Runner"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[+]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[-]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
print_status "Project directory: $PROJECT_DIR"

# Check if services are running
check_services() {
    echo ""
    echo "----------------------------------------"
    print_status "Checking services..."

    # Check backend
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        print_status "Backend: Running"
    else
        print_warning "Backend: Not running (some tests may fail)"
    fi

    # Check frontend
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_status "Frontend: Running"
    else
        print_warning "Frontend: Not running"
    fi

    # Check MongoDB
    if mongosh --eval "db.runCommand({ping:1})" > /dev/null 2>&1; then
        print_status "MongoDB: Running"
    else
        print_warning "MongoDB: Not accessible (may be in Docker)"
    fi
}

# Run backend tests
run_backend_tests() {
    echo ""
    echo "----------------------------------------"
    print_status "Running Backend API Tests..."
    echo "----------------------------------------"

    cd "$PROJECT_DIR/backend"

    if [ -f "requirements.txt" ]; then
        # Run pytest
        python -m pytest tests/ -v --tb=short 2>&1 || {
            print_error "Some backend tests failed"
            return 1
        }
        print_status "Backend tests completed successfully"
    else
        print_warning "No backend requirements.txt found"
    fi
}

# Run frontend tests
run_frontend_tests() {
    echo ""
    echo "----------------------------------------"
    print_status "Running Frontend Tests..."
    echo "----------------------------------------"

    cd "$PROJECT_DIR/frontend"

    if [ -f "package.json" ]; then
        npm test -- --run 2>&1 || {
            print_error "Some frontend tests failed"
            return 1
        }
        print_status "Frontend tests completed successfully"
    else
        print_warning "No frontend package.json found"
    fi
}

# Visual sanity check
run_visual_check() {
    echo ""
    echo "----------------------------------------"
    print_status "Running Visual Sanity Check..."
    echo "----------------------------------------"

    local BASE_URL="${1:-http://localhost:3000}"

    echo "Checking main pages are accessible..."

    # Check Dashboard
    if curl -s "$BASE_URL/" | grep -q "Dashboard\|Expertly"; then
        print_status "Dashboard page: OK"
    else
        print_warning "Dashboard page: May have issues"
    fi

    # Check Tasks page
    if curl -s "$BASE_URL/tasks" | grep -q "Tasks\|Expertly"; then
        print_status "Tasks page: OK"
    else
        print_warning "Tasks page: May have issues"
    fi

    # Check Queues page
    if curl -s "$BASE_URL/queues" | grep -q "Queues\|Expertly"; then
        print_status "Queues page: OK"
    else
        print_warning "Queues page: May have issues"
    fi

    # Check API health
    local API_BASE="${2:-http://localhost:8000}"
    if curl -s "$API_BASE/health" | grep -q "healthy"; then
        print_status "API Health: OK"
    else
        print_warning "API Health: Issues detected"
    fi

    print_status "Visual sanity check completed"
}

# Main test runner
main() {
    local run_all=true
    local run_backend=false
    local run_frontend=false
    local run_visual=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --backend)
                run_all=false
                run_backend=true
                shift
                ;;
            --frontend)
                run_all=false
                run_frontend=true
                shift
                ;;
            --visual)
                run_all=false
                run_visual=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--backend] [--frontend] [--visual]"
                echo ""
                echo "Options:"
                echo "  --backend   Run only backend tests"
                echo "  --frontend  Run only frontend tests"
                echo "  --visual    Run only visual sanity check"
                echo ""
                echo "Without options, runs all tests."
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    check_services

    local exit_code=0

    if $run_all || $run_backend; then
        run_backend_tests || exit_code=1
    fi

    if $run_all || $run_frontend; then
        run_frontend_tests || exit_code=1
    fi

    if $run_all || $run_visual; then
        run_visual_check
    fi

    echo ""
    echo "========================================"
    if [ $exit_code -eq 0 ]; then
        print_status "All tests completed successfully!"
    else
        print_error "Some tests failed. Check output above."
    fi
    echo "========================================"

    exit $exit_code
}

main "$@"
