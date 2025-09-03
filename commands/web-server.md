---
description: Launch Claude Craft local web server with chat interface
argument-hint: [port] [--options]
allowed-tools: Bash(node:*), Bash(npm:*), Read
---

# Claude Craft Web Server Launcher

Launch a local web server that provides a modern chat-like interface for Claude Code functionality.

## Quick Start

!`# Check if we're in the claude-craft directory or need to find it
CLAUDE_CRAFT_DIR=""
if [ -f "server/package.json" ] && grep -q "claude-craft-server" server/package.json; then
    CLAUDE_CRAFT_DIR="$(pwd)"
    echo "✅ Found claude-craft server in current directory"
elif [ -d "$HOME/claude-craft/server" ] && [ -f "$HOME/claude-craft/server/package.json" ]; then
    CLAUDE_CRAFT_DIR="$HOME/claude-craft"
    echo "✅ Found claude-craft server at $HOME/claude-craft"
else
    echo "❌ Claude Craft server not found!"
    echo ""
    echo "Please ensure the server is installed:"
    echo "  1. Clone: git clone https://github.com/whichguy/claude-craft.git ~/claude-craft"
    echo "  2. Setup: cd ~/claude-craft && ./install.sh"
    echo ""
    echo "Or run this command from the claude-craft directory."
    exit 1
fi

SERVER_DIR="$CLAUDE_CRAFT_DIR/server"
cd "$SERVER_DIR"`

## Server Status Check

!`# Check if server dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install
    echo ""
fi

# Parse arguments
PORT="${1:-3000}"
ARGS=""

# Handle additional arguments
shift
for arg in "$@"; do
    case "$arg" in
        --no-browser)
            ARGS="$ARGS --no-browser"
            ;;
        --host)
            ARGS="$ARGS --host $2"
            shift
            ;;
        --help)
            ARGS="$ARGS --help"
            ;;
        *)
            ARGS="$ARGS $arg"
            ;;
    esac
done`

## Launching Server

Starting Claude Craft web server on port **$PORT**...

!`echo "🚀 Starting Claude Craft Server..."
echo "   Port: $PORT"
echo "   Directory: $SERVER_DIR"
echo ""

# Start the server with enhanced launcher
if [ -f "start.js" ]; then
    echo "Using enhanced launcher..."
    node start.js --port "$PORT" $ARGS
else
    echo "Using basic launcher..."  
    PORT="$PORT" node server.js
fi`

## Features Available

Once the server starts, you'll have access to:

**💬 Chat Interface**
- Natural language interaction with AI assistant
- Real-time WebSocket communication
- Slash command support (`/help`, `/status`, `/commands`)

**⚡ Claude Code Integration** 
- Execute your existing slash commands
- Load and run prompt templates with `/prompt <template> [context]`
- Agent discovery and execution
- Project structure analysis

**📁 Project Management**
- Real-time file watching and updates
- .claude folder integration
- Git repository status
- Command and agent discovery

**🛠️ Developer Tools**
- Command history and auto-completion
- Keyboard shortcuts (Ctrl/Cmd+K to focus input)
- Context menus and settings
- Dark/light theme support

## Quick Commands to Try

Once the web interface opens, try these commands:

- `/help` - Show all available commands and features
- `/status` - Display current project status and info
- `/commands` - List all discoverable slash commands  
- `/agents` - Show available AI agents
- `/agent-sync status` - Check claude-craft sync status
- `/prompt api-design Create user authentication system` - Execute prompt template

## Troubleshooting

**Port already in use:**
The server will automatically find an available port if the default is busy.

**Commands not showing:**
Ensure your `.claude/commands/` directories exist and contain `.md` files.

**WebSocket connection issues:**
Check firewall settings and try refreshing the browser.

**Server won't start:**
- Verify Node.js 16+ is installed
- Check that dependencies are installed: `npm install`
- Try a different port: `/web-server 8080`

## Access Information

The server will automatically open your default browser, or you can manually visit:
- **Local access:** http://localhost:$PORT
- **Network access:** http://[your-ip]:$PORT (if using --host 0.0.0.0)

## Advanced Usage

```bash
# Start on different port
/web-server 8080

# Start without auto-opening browser  
/web-server 3000 --no-browser

# Start with network access (caution: security implications)
/web-server 3000 --host 0.0.0.0

# Start with debug logging
/web-server 3000 --log-level debug
```

---

**Enjoy your enhanced Claude Code development experience! 🚀**

The web interface provides a modern, chat-based way to interact with all your Claude Code functionality, making development workflows more intuitive and accessible.