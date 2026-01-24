#!/bin/bash
# API Test Suite for Expertly Develop
# Run with: bash run_api_tests.sh

API_BASE="${API_BASE:-http://expertly-develop-api.152.42.152.243.sslip.io/api/v1}"
TESTS_PASSED=0
TESTS_FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "  ${YELLOW}Details:${NC} $2"
    ((TESTS_FAILED++))
}

section() {
    echo ""
    echo -e "${YELLOW}=== $1 ===${NC}"
}

# HTTP request helper - returns body and sets HTTP_STATUS
http_get() {
    local url="$1"
    local tmpfile=$(mktemp)
    HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$tmpfile" "$url")
    HTTP_BODY=$(cat "$tmpfile")
    rm -f "$tmpfile"
}

http_post() {
    local url="$1"
    local data="$2"
    local tmpfile=$(mktemp)
    HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$tmpfile" -X POST -H "Content-Type: application/json" -d "$data" "$url")
    HTTP_BODY=$(cat "$tmpfile")
    rm -f "$tmpfile"
}

http_put() {
    local url="$1"
    local data="$2"
    local tmpfile=$(mktemp)
    HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$tmpfile" -X PUT -H "Content-Type: application/json" -d "$data" "$url")
    HTTP_BODY=$(cat "$tmpfile")
    rm -f "$tmpfile"
}

http_delete() {
    local url="$1"
    local tmpfile=$(mktemp)
    HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$tmpfile" -X DELETE "$url")
    HTTP_BODY=$(cat "$tmpfile")
    rm -f "$tmpfile"
}

# Store test data for cleanup
TEST_PROJECT_ID=""
TEST_PROJECT_WITH_URL_ID=""
TEST_PERSONA_ID=""
TEST_JOB_ID=""

# Health Tests
section "Health API Tests"

http_get "$API_BASE/health"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"status":"healthy"'; then
        pass "GET /health returns healthy status"
    else
        fail "GET /health status field" "Expected 'healthy', got: $HTTP_BODY"
    fi
else
    fail "GET /health" "Expected 200, got $HTTP_STATUS"
fi

# Projects Tests
section "Projects API Tests"

# List projects
http_get "$API_BASE/projects"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"items"'; then
        pass "GET /projects returns list"
    else
        fail "GET /projects response format" "Missing 'items' field. Got: $HTTP_BODY"
    fi
else
    fail "GET /projects" "Expected 200, got $HTTP_STATUS. Body: $HTTP_BODY"
fi

# Create project (minimal)
http_post "$API_BASE/projects" '{"name":"API Test Project '"$(date +%s)"'"}'
if [ "$HTTP_STATUS" = "201" ]; then
    TEST_PROJECT_ID=$(echo "$HTTP_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    pass "POST /projects creates project (minimal)"
else
    fail "POST /projects (minimal)" "Expected 201, got $HTTP_STATUS. Response: $HTTP_BODY"
fi

# Create project (full)
http_post "$API_BASE/projects" '{
    "name":"API Test Project with URL '"$(date +%s)"'",
    "description":"Full test project",
    "visibility":"team",
    "site_url":"https://example.com"
}'
if [ "$HTTP_STATUS" = "201" ]; then
    TEST_PROJECT_WITH_URL_ID=$(echo "$HTTP_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if echo "$HTTP_BODY" | grep -q '"visibility":"team"'; then
        pass "POST /projects creates project (full)"
    else
        fail "POST /projects visibility" "Expected 'team' visibility. Got: $HTTP_BODY"
    fi
else
    fail "POST /projects (full)" "Expected 201, got $HTTP_STATUS"
fi

# Create project - validation error (no name)
http_post "$API_BASE/projects" '{}'
if [ "$HTTP_STATUS" = "422" ]; then
    pass "POST /projects rejects missing name (422)"
else
    fail "POST /projects validation" "Expected 422, got $HTTP_STATUS"
fi

# Get project
if [ -n "$TEST_PROJECT_ID" ]; then
    http_get "$API_BASE/projects/$TEST_PROJECT_ID"
    if [ "$HTTP_STATUS" = "200" ]; then
        if echo "$HTTP_BODY" | grep -q "\"id\":\"$TEST_PROJECT_ID\""; then
            pass "GET /projects/{id} returns correct project"
        else
            fail "GET /projects/{id} response" "ID mismatch"
        fi
    else
        fail "GET /projects/{id}" "Expected 200, got $HTTP_STATUS"
    fi
fi

# Get non-existent project
http_get "$API_BASE/projects/000000000000000000000000"
if [ "$HTTP_STATUS" = "404" ]; then
    pass "GET /projects/{id} returns 404 for non-existent"
else
    fail "GET /projects/{id} not found" "Expected 404, got $HTTP_STATUS"
fi

# Update project
if [ -n "$TEST_PROJECT_ID" ]; then
    http_put "$API_BASE/projects/$TEST_PROJECT_ID" '{"name":"Updated API Test Project","description":"Updated description"}'
    if [ "$HTTP_STATUS" = "200" ]; then
        if echo "$HTTP_BODY" | grep -q '"name":"Updated API Test Project"'; then
            pass "PUT /projects/{id} updates project"
        else
            fail "PUT /projects/{id} update" "Name not updated"
        fi
    else
        fail "PUT /projects/{id}" "Expected 200, got $HTTP_STATUS"
    fi
fi

# Jobs Tests
section "Jobs API Tests"

# List jobs
http_get "$API_BASE/jobs"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"items"' && echo "$HTTP_BODY" | grep -q '"stats"'; then
        pass "GET /jobs returns list with stats"
    else
        fail "GET /jobs response format" "Missing 'items' or 'stats'. Got: $HTTP_BODY"
    fi
else
    fail "GET /jobs" "Expected 200, got $HTTP_STATUS"
fi

# List jobs with status filter
http_get "$API_BASE/jobs?status=completed"
if [ "$HTTP_STATUS" = "200" ]; then
    pass "GET /jobs with status filter"
else
    fail "GET /jobs?status=completed" "Expected 200, got $HTTP_STATUS"
fi

# Get non-existent job
http_get "$API_BASE/jobs/000000000000000000000000"
if [ "$HTTP_STATUS" = "404" ]; then
    pass "GET /jobs/{id} returns 404 for non-existent"
else
    fail "GET /jobs/{id} not found" "Expected 404, got $HTTP_STATUS"
fi

# Artifacts Tests
section "Artifacts API Tests"

# List artifacts
http_get "$API_BASE/artifacts"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"items"'; then
        pass "GET /artifacts returns list"
    else
        fail "GET /artifacts response format" "Missing 'items'. Got: $HTTP_BODY"
    fi
else
    fail "GET /artifacts" "Expected 200, got $HTTP_STATUS"
fi

# Get non-existent artifact
http_get "$API_BASE/artifacts/000000000000000000000000"
if [ "$HTTP_STATUS" = "404" ]; then
    pass "GET /artifacts/{id} returns 404 for non-existent"
else
    fail "GET /artifacts/{id} not found" "Expected 404, got $HTTP_STATUS"
fi

# Download existing artifact (if any)
artifacts_response="$HTTP_BODY"
artifact_id=$(echo "$artifacts_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$artifact_id" ]; then
    http_get "$API_BASE/artifacts/$artifact_id/download"
    if [ "$HTTP_STATUS" = "200" ]; then
        pass "GET /artifacts/{id}/download works"
    else
        fail "GET /artifacts/{id}/download" "Expected 200, got $HTTP_STATUS"
    fi
fi

# Scenarios Tests
section "Scenarios API Tests"

# List scenarios
http_get "$API_BASE/scenarios"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"items"'; then
        items_count=$(echo "$HTTP_BODY" | grep -o '"code"' | wc -l | tr -d ' ')
        if [ "$items_count" -ge 2 ]; then
            pass "GET /scenarios returns seeded scenarios ($items_count found)"
        else
            fail "GET /scenarios count" "Expected at least 2 scenarios, found $items_count"
        fi
    else
        fail "GET /scenarios response format" "Missing 'items'. Got: $HTTP_BODY"
    fi
else
    fail "GET /scenarios" "Expected 200, got $HTTP_STATUS"
fi

# Get specific scenario
http_get "$API_BASE/scenarios/basic_visual_walkthrough"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"code":"basic_visual_walkthrough"'; then
        pass "GET /scenarios/{code} returns correct scenario"
    else
        fail "GET /scenarios/{code}" "Wrong scenario returned. Got: $HTTP_BODY"
    fi
else
    fail "GET /scenarios/{code}" "Expected 200, got $HTTP_STATUS"
fi

# Get non-existent scenario
http_get "$API_BASE/scenarios/nonexistent_scenario"
if [ "$HTTP_STATUS" = "404" ]; then
    pass "GET /scenarios/{code} returns 404 for non-existent"
else
    fail "GET /scenarios/{code} not found" "Expected 404, got $HTTP_STATUS"
fi

# Personas Tests
section "Personas API Tests"

# List personas
http_get "$API_BASE/personas"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"items"'; then
        pass "GET /personas returns list"
    else
        fail "GET /personas response format" "Missing 'items'. Got: $HTTP_BODY"
    fi
else
    fail "GET /personas" "Expected 200, got $HTTP_STATUS"
fi

# Create persona
if [ -n "$TEST_PROJECT_ID" ]; then
    http_post "$API_BASE/personas" '{
        "project_id":"'"$TEST_PROJECT_ID"'",
        "name":"Test Persona '"$(date +%s)"'",
        "role_description":"A test persona",
        "goals":["Test the system"],
        "task_types":["testing"]
    }'
    if [ "$HTTP_STATUS" = "201" ]; then
        TEST_PERSONA_ID=$(echo "$HTTP_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        pass "POST /personas creates persona"
    else
        fail "POST /personas" "Expected 201, got $HTTP_STATUS. Response: $HTTP_BODY"
    fi
fi

# Walkthroughs Tests
section "Walkthroughs API Tests"

# Create walkthrough
if [ -n "$TEST_PROJECT_WITH_URL_ID" ]; then
    http_post "$API_BASE/walkthroughs" '{
        "project_id":"'"$TEST_PROJECT_WITH_URL_ID"'",
        "scenario_text":"Navigate to /\nCapture \"Homepage\"",
        "label":"API Test Walkthrough '"$(date +%s)"'"
    }'
    if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "202" ]; then
        TEST_JOB_ID=$(echo "$HTTP_BODY" | grep -o '"job_id":"[^"]*"' | head -1 | cut -d'"' -f4)
        if echo "$HTTP_BODY" | grep -q '"status":"pending"'; then
            pass "POST /walkthroughs creates job (status: $HTTP_STATUS)"
        else
            fail "POST /walkthroughs status" "Expected pending status. Got: $HTTP_BODY"
        fi
    else
        fail "POST /walkthroughs" "Expected 201/202, got $HTTP_STATUS. Response: $HTTP_BODY"
    fi

    # Verify job was created
    if [ -n "$TEST_JOB_ID" ]; then
        sleep 1
        http_get "$API_BASE/jobs/$TEST_JOB_ID"
        if [ "$HTTP_STATUS" = "200" ]; then
            pass "GET /jobs/{id} retrieves walkthrough job"
        else
            fail "GET /jobs/{id} for walkthrough" "Expected 200, got $HTTP_STATUS"
        fi
    fi
fi

# Create walkthrough - validation error (no project_id)
http_post "$API_BASE/walkthroughs" '{"scenario_text":"Navigate to /"}'
if [ "$HTTP_STATUS" = "422" ]; then
    pass "POST /walkthroughs rejects missing project_id (422)"
else
    fail "POST /walkthroughs validation" "Expected 422, got $HTTP_STATUS"
fi

# Documents Tests
section "Documents API Tests"

# Get non-existent document
http_get "$API_BASE/documents/nonexistent-key"
if [ "$HTTP_STATUS" = "404" ]; then
    pass "GET /documents/{key} returns 404 for non-existent"
else
    fail "GET /documents/{key} not found" "Expected 404, got $HTTP_STATUS"
fi

# Requirements Tests
section "Requirements API Tests"

# List requirements
http_get "$API_BASE/requirements"
if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$HTTP_BODY" | grep -q '"items"'; then
        pass "GET /requirements returns list"
    else
        fail "GET /requirements response format" "Missing 'items'. Got: $HTTP_BODY"
    fi
else
    fail "GET /requirements" "Expected 200, got $HTTP_STATUS"
fi

# Cleanup
section "Cleanup"

if [ -n "$TEST_PROJECT_ID" ]; then
    http_delete "$API_BASE/projects/$TEST_PROJECT_ID"
    if [ "$HTTP_STATUS" = "204" ]; then
        pass "DELETE /projects/{id} cleans up test project"
    else
        echo "  Note: Could not delete test project $TEST_PROJECT_ID (status: $HTTP_STATUS)"
    fi
fi

if [ -n "$TEST_PROJECT_WITH_URL_ID" ]; then
    http_delete "$API_BASE/projects/$TEST_PROJECT_WITH_URL_ID"
    if [ "$HTTP_STATUS" = "204" ]; then
        pass "DELETE /projects/{id} cleans up test project with URL"
    else
        echo "  Note: Could not delete test project $TEST_PROJECT_WITH_URL_ID (status: $HTTP_STATUS)"
    fi
fi

# Summary
section "Test Results Summary"
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
echo ""
echo -e "Total: $TOTAL tests"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
