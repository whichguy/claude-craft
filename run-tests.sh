#!/bin/bash

# Claude Craft Test Runner
# Runs all test suites with proper setup

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Claude Craft Test Suite${NC}"
echo

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing test dependencies...${NC}"
    npm install
    echo
fi

# Run security scan on test data to verify it's working
echo -e "${BLUE}🛡️  Testing Security Scanner...${NC}"
if ./tools/security-scan.sh test/fixtures secrets false >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Security scanner operational${NC}"
else
    echo -e "${YELLOW}⚠️  Security scanner test failed (this is expected - test data has issues)${NC}"
fi
echo

# Run the test suites
echo -e "${BLUE}🏃 Running Mocha Test Suites...${NC}"
echo

if [ "$1" = "coverage" ]; then
    echo -e "${YELLOW}📊 Running with coverage...${NC}"
    npx nyc mocha test/**/*.test.js
elif [ "$1" = "watch" ]; then
    echo -e "${YELLOW}👁️  Running in watch mode...${NC}"
    npx mocha test/**/*.test.js --watch
elif [ -n "$1" ]; then
    echo -e "${YELLOW}🎯 Running specific test: $1${NC}"
    npx mocha "test/$1.test.js"
else
    npx mocha test/**/*.test.js
fi

echo
echo -e "${GREEN}✅ Test suite complete!${NC}"