# Claude Craft Server

A local web server that provides a Claude project and chat-like interface for developers to interact with Claude Code functionality locally.

## Features

🚀 **Modern Chat Interface**
- Real-time communication via WebSocket
- Chat-like interaction with AI assistant
- Support for slash commands and natural language

⚡ **Claude Code Integration**
- Execute slash commands (`/help`, `/status`, `/commands`, etc.)
- Load and execute prompt templates
- Integration with existing claude-craft tooling
- Agent and command discovery

📁 **Project Management**
- Real-time project structure display
- File change monitoring
- .claude folder management
- Git repository integration

🛡️ **Security Features**
- Local-only access by default
- Rate limiting and security headers
- Input validation and sanitization
- Secure WebSocket connections

🎨 **Developer Experience**
- Responsive design with dark/light theme
- Keyboard shortcuts and context menus
- Command history and auto-completion
- Live file watching and updates

## Quick Start

### Installation

```bash
# Clone the repository (if not already done)
git clone https://github.com/whichguy/claude-craft.git
cd claude-craft/server

# Install dependencies
npm install

# Start the server
npm start
```

### Alternative: Using the enhanced launcher

```bash
# Start with default settings
node start.js

# Start on a different port
node start.js --port 8080

# Start without auto-opening browser
node start.js --no-browser

# Start with custom host (for network access)
node start.js --host 0.0.0.0
```

### Development Mode

```bash
# Start with auto-reload (requires nodemon)
npm run dev

# Or manually with nodemon
npx nodemon server.js
```

## Usage

### Web Interface

1. **Open your browser** to `http://localhost:3000` (or your configured port)
2. **Start chatting** - Type messages or slash commands
3. **Use quick actions** in the sidebar for common tasks
4. **Explore commands** with `/help` or `/commands`

### Available Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands and help |
| `/status` | Display project status and information |
| `/commands` | List all available slash commands |
| `/agents` | List all available agents |
| `/prompt <template> [context...]` | Execute a prompt template |
| `/agent-sync [action]` | Synchronize with claude-craft repository |

### Chat Examples

```
User: /help
Assistant: [Shows comprehensive help with available commands]

User: /status  
Assistant: [Displays project status, git info, available commands/agents]

User: /prompt api-design Create REST endpoints for user management
Assistant: [Loads and executes the api-design prompt template with context]

User: What files are in my project?
Assistant: [Analyzes project structure and provides file listing]
```

## Configuration

### Environment Variables

```bash
# Server configuration
CLAUDE_CRAFT_PORT=3000           # Server port (default: 3000)
CLAUDE_CRAFT_HOST=localhost      # Server host (default: localhost)

# Feature toggles
CLAUDE_CRAFT_AUTO_OPEN=true      # Auto-open browser (default: true)
CLAUDE_CRAFT_CHECK_DEPS=true     # Check dependencies on start (default: true)
CLAUDE_CRAFT_LOG_LEVEL=info      # Log level (default: info)

# Development
NODE_ENV=development             # Environment mode
```

### Command Line Options

```bash
node start.js --help            # Show all available options

# Common options:
--port <number>     # Server port
--host <string>     # Server host  
--no-browser        # Don't auto-open browser
--no-deps-check     # Skip dependency checking
--log-level <level> # Set log level
```

## Integration with Claude Code

### Prerequisites

The server integrates with your existing Claude Code setup:

1. **Claude Directory**: `~/.claude/` (created by Claude Code)
   - Commands in `~/.claude/commands/`
   - Agents in `~/.claude/agents/`
   - Settings in `~/.claude/settings.json`

2. **Claude Craft Repository**: `~/claude-craft/` (optional but recommended)
   - Extended commands and agents
   - Prompt templates and workflows
   - Synchronization tools

3. **Project Structure**: `.claude/` in your project (optional)
   - Project-specific commands and agents
   - Team-shared configurations

### Command Discovery

The server automatically discovers commands from multiple locations:

1. **Project commands**: `.claude/commands/` (current project)
2. **User commands**: `~/.claude/commands/` (personal commands)  
3. **Claude Craft commands**: `~/claude-craft/commands/` (extended toolkit)

### Agent Discovery

Similarly, agents are discovered from:

1. **Project agents**: `.claude/agents/` 
2. **User agents**: `~/.claude/agents/`
3. **Claude Craft agents**: `~/claude-craft/agents/`

## API Endpoints

### REST API

```bash
GET /api/status          # Server and project status
GET /api/commands        # List available commands
GET /api/agents          # List available agents
GET /health             # Health check endpoint
```

### WebSocket API

Connect to `ws://localhost:3000` and send JSON messages:

```javascript
// Chat message
{
  "type": "chat",
  "data": {
    "message": "Your message or command here",
    "context": {}
  }
}

// Command execution
{
  "type": "command", 
  "data": {
    "command": "/status",
    "args": []
  }
}

// Project action
{
  "type": "project",
  "data": {
    "action": "scan",
    "params": {}
  }
}
```

## File Structure

```
server/
├── package.json          # Dependencies and scripts
├── server.js            # Main server application
├── start.js             # Enhanced launcher script
├── README.md           # This documentation
├── public/             # Client-side assets
│   ├── index.html      # Main HTML interface
│   ├── styles.css      # CSS styling (themes, responsive)
│   └── app.js          # Client-side JavaScript
└── test/               # Test files (if added)
    └── server.test.js  # Server tests
```

## Development

### Adding Features

1. **Server-side**: Modify `server.js` to add new WebSocket message handlers or API endpoints
2. **Client-side**: Update `public/app.js` for new UI features and interactions
3. **Styling**: Extend `public/styles.css` with new components or themes

### WebSocket Message Types

The server handles these message types:

- `chat` - Chat messages and slash commands
- `command` - Direct command execution  
- `project` - Project management actions

### Adding New Commands

Commands are loaded from markdown files. Create a new file:

```bash
# User command
echo "Your command prompt here" > ~/.claude/commands/my-command.md

# Project command  
mkdir -p .claude/commands
echo "Team command prompt" > .claude/commands/team-command.md
```

## Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check if port is in use
lsof -i :3000

# Try a different port
node start.js --port 3001
```

**Commands not showing:**
```bash
# Verify command directories exist
ls -la ~/.claude/commands/
ls -la .claude/commands/

# Check file permissions
chmod +r ~/.claude/commands/*.md
```

**WebSocket connection fails:**
```bash
# Check firewall settings
# Verify no proxy interference
# Try different browser
```

### Debug Mode

```bash
# Enable verbose logging
NODE_ENV=development node start.js --log-level debug

# Or set environment variable
export CLAUDE_CRAFT_LOG_LEVEL=debug
npm start
```

### Health Check

```bash
# Check server health
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z", 
  "connections": 1
}
```

## Security Considerations

### Local Development

- Server binds to `localhost` by default for security
- CORS restricted to same origin
- Rate limiting applied to API endpoints
- Input validation and sanitization

### Network Access

If you need network access (e.g., for team use):

```bash
# CAUTION: This exposes the server to your network
node start.js --host 0.0.0.0

# Consider using a reverse proxy with authentication
# Or VPN/SSH tunnel for remote access
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see the main claude-craft repository for details.

---

## Integration Examples

### With Existing Workflows

```bash
# Start server and sync with claude-craft
node start.js
# Then in browser: /agent-sync status

# Use with project-specific commands  
cd my-project
node /path/to/claude-craft/server/start.js
# Commands from .claude/commands/ will be available
```

### Custom Prompt Templates

Create templates in `~/.claude/prompts/`:

```markdown
# File: ~/.claude/prompts/debug-session.md

# Debug Session Template

## Error Description
$ARGUMENTS

## Investigation Steps
1. Reproduce the issue
2. Analyze logs and error messages  
3. Check recent changes
4. Form hypothesis
5. Test and validate fix

Begin systematic debugging based on the error description above.
```

Use in browser: `/prompt debug-session Login fails with 401 error`

### Team Collaboration

```bash
# Project setup
cd team-project
mkdir -p .claude/commands

# Add team command
cat > .claude/commands/deploy.md << 'EOF'
---
description: Deploy to staging environment
allowed-tools: Bash(npm run:*), Bash(git:*)
---

# Deployment Workflow

1. Run tests: `npm test`
2. Build application: `npm run build` 
3. Deploy to staging: `npm run deploy:staging`
4. Verify deployment health checks

Execute deployment with proper error handling.
EOF

# Commit to version control
git add .claude/
git commit -m "Add team deployment command"
```

Team members can now use `/deploy` command via the web interface.

This server provides a modern, web-based interface for Claude Code functionality, making it easier to interact with your development workflow through a familiar chat interface while leveraging all the power of your existing claude-craft setup.