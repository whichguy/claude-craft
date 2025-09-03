#!/bin/bash

# Claude Craft Web Server Setup Script
# Installs and configures the local development web server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_CRAFT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$CLAUDE_CRAFT_DIR/server"
MIN_NODE_VERSION=16

echo -e "${BLUE}🚀 Claude Craft Web Server Setup${NC}"
echo "========================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to compare version numbers
version_compare() {
    printf '%s\n%s\n' "$1" "$2" | sort -V -C
}

# Check Node.js
echo -e "${BLUE}Checking Node.js installation...${NC}"
if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo ""
    echo "Please install Node.js $MIN_NODE_VERSION or higher:"
    echo "  - Download from: https://nodejs.org/"
    echo "  - Or use a version manager like nvm, fnm, or n"
    echo ""
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt "$MIN_NODE_VERSION" ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION found, but $MIN_NODE_VERSION+ required${NC}"
    echo ""
    echo "Please upgrade Node.js:"
    echo "  - Download latest from: https://nodejs.org/"
    echo "  - Or use: nvm install --lts"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"

# Check npm
if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    echo "npm should be included with Node.js. Please reinstall Node.js."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm $NPM_VERSION found${NC}"
echo ""

# Check server directory
echo -e "${BLUE}Checking server directory...${NC}"
if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}❌ Server directory not found: $SERVER_DIR${NC}"
    echo "This script should be run from the claude-craft repository."
    exit 1
fi

echo -e "${GREEN}✅ Server directory found: $SERVER_DIR${NC}"

# Check for required files
REQUIRED_FILES=("package.json" "server.js" "start.js" "public/index.html" "public/styles.css" "public/app.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$SERVER_DIR/$file" ]; then
        echo -e "${RED}❌ Missing required file: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required server files found${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}Installing server dependencies...${NC}"
cd "$SERVER_DIR"

# Check if node_modules exists and is recent
SHOULD_INSTALL=true
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    # Check if package.json is newer than node_modules
    if [ "package.json" -ot "node_modules" ]; then
        echo -e "${GREEN}✅ Dependencies appear to be up to date${NC}"
        SHOULD_INSTALL=false
    else
        echo -e "${YELLOW}⚠️  package.json is newer than node_modules, reinstalling...${NC}"
    fi
fi

if [ "$SHOULD_INSTALL" = true ]; then
    echo "Running: npm install"
    npm install --only=production --no-audit --no-fund
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi
echo ""

# Verify installation
echo -e "${BLUE}Verifying installation...${NC}"

# Check if main dependencies are available
MAIN_DEPS=("express" "ws" "cors" "helmet")
for dep in "${MAIN_DEPS[@]}"; do
    if [ ! -d "node_modules/$dep" ]; then
        echo -e "${RED}❌ Missing dependency: $dep${NC}"
        echo "Please run: npm install"
        exit 1
    fi
done

echo -e "${GREEN}✅ All dependencies verified${NC}"
echo ""

# Test server startup (dry run)
echo -e "${BLUE}Testing server startup...${NC}"
timeout 5s node start.js --help >/dev/null 2>&1 || {
    if [ $? -eq 124 ]; then
        echo -e "${GREEN}✅ Server startup test passed${NC}"
    else
        echo -e "${RED}❌ Server startup test failed${NC}"
        echo "Please check the server configuration."
        exit 1
    fi
}

echo ""

# Check for available port
echo -e "${BLUE}Checking default port availability...${NC}"
DEFAULT_PORT=3000
if command_exists netstat; then
    if netstat -ln 2>/dev/null | grep -q ":$DEFAULT_PORT "; then
        echo -e "${YELLOW}⚠️  Port $DEFAULT_PORT appears to be in use${NC}"
        echo "The server will automatically find an available port."
    else
        echo -e "${GREEN}✅ Port $DEFAULT_PORT is available${NC}"
    fi
elif command_exists lsof; then
    if lsof -i ":$DEFAULT_PORT" 2>/dev/null | grep -q LISTEN; then
        echo -e "${YELLOW}⚠️  Port $DEFAULT_PORT appears to be in use${NC}"
        echo "The server will automatically find an available port."
    else
        echo -e "${GREEN}✅ Port $DEFAULT_PORT is available${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot check port availability (netstat/lsof not found)${NC}"
    echo "The server will handle port conflicts automatically."
fi

echo ""

# Create a convenient launcher script
LAUNCHER_SCRIPT="$CLAUDE_CRAFT_DIR/web-server"
echo -e "${BLUE}Creating launcher script...${NC}"

cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
# Claude Craft Web Server Launcher
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/server/start.js" "$@"
EOF

chmod +x "$LAUNCHER_SCRIPT"
echo -e "${GREEN}✅ Launcher created: $LAUNCHER_SCRIPT${NC}"

# Success message
echo ""
echo -e "${GREEN}🎉 Claude Craft Web Server setup complete!${NC}"
echo ""
echo -e "${BLUE}Quick Start:${NC}"
echo "  1. Launch server:        $LAUNCHER_SCRIPT"
echo "  2. Or with options:      $LAUNCHER_SCRIPT --port 8080 --no-browser"
echo "  3. Or from claude-craft: /web-server"
echo ""
echo -e "${BLUE}Features:${NC}"
echo "  • Modern chat-like interface for Claude Code"
echo "  • Real-time WebSocket communication"
echo "  • Integration with existing commands and agents"
echo "  • Project management and file watching"
echo "  • Responsive design with themes"
echo ""
echo -e "${BLUE}Usage Examples:${NC}"
echo "  ./web-server                    # Start with defaults (port 3000)"
echo "  ./web-server --port 8080        # Use custom port"
echo "  ./web-server --no-browser       # Don't auto-open browser"
echo "  ./web-server --host 0.0.0.0     # Network access (use with caution)"
echo ""
echo -e "${YELLOW}💡 Tip: Use the /web-server command from Claude Code for integrated launching!${NC}"
echo ""
echo "Server will be available at: http://localhost:3000"
echo ""

# Optional: Test run
if [ "${1:-}" = "--test" ]; then
    echo -e "${BLUE}Running test server (10 seconds)...${NC}"
    timeout 10s "$LAUNCHER_SCRIPT" --no-browser --port 3001 &
    PID=$!
    
    sleep 3
    if curl -s http://localhost:3001/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Test server responded successfully${NC}"
        kill $PID 2>/dev/null || true
        wait $PID 2>/dev/null || true
    else
        echo -e "${RED}❌ Test server did not respond${NC}"
        kill $PID 2>/dev/null || true
        wait $PID 2>/dev/null || true
        exit 1
    fi
fi

echo "Setup complete! 🚀"