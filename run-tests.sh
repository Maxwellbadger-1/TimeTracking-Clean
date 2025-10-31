#!/bin/bash

# Phase 3 API Tests
# This script tests all Time Entry endpoints

echo "🧪 Phase 3: Time Tracking API Tests"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/test-cookies.txt"

# Clean up old cookies
rm -f $COOKIE_FILE

# Test counter
PASSED=0
FAILED=0

# Helper function to test API
test_api() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_status="$5"

  echo -n "Testing: $test_name... "

  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" -b $COOKIE_FILE)
  elif [ "$method" == "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -b $COOKIE_FILE -c $COOKIE_FILE)
  elif [ "$method" == "PUT" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -b $COOKIE_FILE)
  elif [ "$method" == "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint" \
      -b $COOKIE_FILE)
  fi

  # Extract status code (last line)
  status=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" == "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $status)"
    PASSED=$((PASSED + 1))
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got $status)"
    FAILED=$((FAILED + 1))
    echo "$body"
  fi
  echo ""
}

# Start tests
echo "Starting tests..."
echo ""

# Test 1: Health Check
test_api "Health Check" "GET" "/api/health" "" "200"

# Test 2: Login as Admin
echo "Test 2: Login as Admin"
test_api "Admin Login" "POST" "/api/auth/login" \
  '{"username": "admin", "password": "admin123"}' "200"

# Test 3: Create time entry (valid)
echo "Test 3: Create time entry (today, valid)"
TODAY=$(date +%Y-%m-%d)
test_api "Create Time Entry" "POST" "/api/time-entries" \
  "{\"date\": \"$TODAY\", \"startTime\": \"08:00\", \"endTime\": \"17:00\", \"breakMinutes\": 60, \"location\": \"office\", \"activity\": \"Development\", \"notes\": \"Test entry\"}" "201"

# Test 4: Get all time entries
echo "Test 4: Get all time entries"
test_api "Get All Entries" "GET" "/api/time-entries" "" "200"

# Test 5: Create overlapping entry (should fail)
echo "Test 5: Create overlapping entry (should fail)"
test_api "Overlap Detection" "POST" "/api/time-entries" \
  "{\"date\": \"$TODAY\", \"startTime\": \"16:00\", \"endTime\": \"18:00\", \"breakMinutes\": 0, \"location\": \"office\"}" "400"

# Test 6: Create entry without break (>6h, should fail)
echo "Test 6: Create entry without required break (should fail)"
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
test_api "Break Rule Check" "POST" "/api/time-entries" \
  "{\"date\": \"$YESTERDAY\", \"startTime\": \"08:00\", \"endTime\": \"15:00\", \"breakMinutes\": 0, \"location\": \"homeoffice\"}" "400"

# Test 7: Create entry with proper break
echo "Test 7: Create entry with proper break"
test_api "Valid Entry with Break" "POST" "/api/time-entries" \
  "{\"date\": \"$YESTERDAY\", \"startTime\": \"08:00\", \"endTime\": \"15:00\", \"breakMinutes\": 30, \"location\": \"homeoffice\", \"notes\": \"Home office day\"}" "201"

# Test 8: Future date (should fail)
echo "Test 8: Create entry for future date (should fail)"
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "tomorrow" +%Y-%m-%d)
test_api "Future Date Prevention" "POST" "/api/time-entries" \
  "{\"date\": \"$TOMORROW\", \"startTime\": \"08:00\", \"endTime\": \"17:00\", \"breakMinutes\": 60, \"location\": \"office\"}" "400"

# Test 9: Get overtime balance
echo "Test 9: Get overtime balance for current month"
CURRENT_MONTH=$(date +%Y-%m)
test_api "Overtime Balance" "GET" "/api/time-entries/stats/overtime?month=$CURRENT_MONTH" "" "200"

# Test 10: Invalid date format (should fail)
echo "Test 10: Invalid date format (should fail)"
test_api "Invalid Format" "POST" "/api/time-entries" \
  "{\"date\": \"30.10.2025\", \"startTime\": \"08:00\", \"endTime\": \"17:00\", \"location\": \"office\"}" "400"

# Test 11: Update time entry (get ID from previous entries)
echo "Test 11: Update time entry"
echo "Note: Manual test - update an existing entry ID"

# Test 12: Unauthorized access (logout first)
echo "Test 12: Logout and test unauthorized access"
curl -s -X POST "$BASE_URL/api/auth/logout" -b $COOKIE_FILE -c $COOKIE_FILE > /dev/null
test_api "Unauthorized Access" "GET" "/api/time-entries" "" "401"

# Summary
echo ""
echo "===================================="
echo "Test Summary"
echo "===================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
TOTAL=$((PASSED + FAILED))
echo "Total: $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed!${NC}"
  exit 1
fi
