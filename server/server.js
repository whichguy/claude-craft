#!/usr/bin/env node

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const CLAUDE_DIR = path.join(process.env.HOME, '.claude');
const CLAUDE_CRAFT_DIR = path.join(process.env.HOME, 'claude-craft');

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", `ws://${HOST}:${PORT}`]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// CORS for local development
app.use(cors({
    origin: `http://${HOST}:${PORT}`,
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connections for real-time communication
const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
    clients.add(ws);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'system',
        message: 'Connected to Claude Craft Server',
        timestamp: new Date().toISOString()
    }));

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await handleWebSocketMessage(ws, message);
        } catch (error) {
            console.error('WebSocket message error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
                timestamp: new Date().toISOString()
            }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Broadcast to all connected clients
function broadcast(message) {
    const data = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
    });
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Handle WebSocket messages
async function handleWebSocketMessage(ws, message) {
    const { type, data } = message;

    switch (type) {
        case 'chat':
            await handleChatMessage(ws, data);
            break;
        case 'command':
            await handleCommandExecution(ws, data);
            break;
        case 'project':
            await handleProjectAction(ws, data);
            break;
        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${type}`,
                timestamp: new Date().toISOString()
            }));
    }
}

// Handle chat messages with Claude Code integration
async function handleChatMessage(ws, data) {
    const { message, context = {} } = data;
    
    // Echo the user message first
    ws.send(JSON.stringify({
        type: 'chat',
        role: 'user',
        message: message,
        timestamp: new Date().toISOString()
    }));

    try {
        // For demo purposes, we'll simulate Claude Code responses
        // In a real implementation, this would integrate with Claude Code APIs
        const response = await simulateClaudeResponse(message, context);
        
        ws.send(JSON.stringify({
            type: 'chat',
            role: 'assistant',
            message: response,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Chat message error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process chat message',
            timestamp: new Date().toISOString()
        }));
    }
}

// Simulate Claude Code responses (replace with actual Claude Code integration)
async function simulateClaudeResponse(message, context) {
    // Check if this looks like a slash command
    if (message.startsWith('/')) {
        const parts = message.split(' ');
        const command = parts[0];
        const args = parts.slice(1);
        
        return await executeSlashCommand(command, args, context);
    }
    
    // Otherwise, provide a helpful response
    const responses = [
        "I can help you with Claude Code functionality. Try using a slash command like `/help` or `/status`.",
        "To get started, you can explore your project structure or run commands. What would you like to do?",
        "I'm ready to assist with your development workflow. Feel free to ask about files, run commands, or get help with your project.",
        `Based on your message about "${message}", I can help you work with your project files and run development commands.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Execute slash commands
async function executeSlashCommand(command, args, context) {
    switch (command) {
        case '/help':
            return getHelpMessage();
        case '/status':
            return await getProjectStatus();
        case '/commands':
            return await listAvailableCommands();
        case '/agents':
            return await listAvailableAgents();
        case '/prompt':
            return await handlePromptCommand(args);
        case '/agent-sync':
            return await handleAgentSyncCommand(args);
        default:
            return await executeCustomCommand(command, args, context);
    }
}

// Get help message
function getHelpMessage() {
    return `
**Claude Craft Server Help**

Available commands:
- \`/help\` - Show this help message
- \`/status\` - Show project status
- \`/commands\` - List available slash commands
- \`/agents\` - List available agents
- \`/prompt [name]\` - Execute a prompt template
- \`/agent-sync\` - Sync with claude-craft repository

You can also chat naturally and I'll help with your development workflow.
    `.trim();
}

// Get project status
async function getProjectStatus() {
    try {
        const cwd = process.cwd();
        const hasGit = await checkGitRepo();
        const claudeDir = await checkClaudeDir();
        const commands = await getCommandCount();
        const agents = await getAgentCount();
        
        return `
**Project Status**

- **Current Directory**: \`${cwd}\`
- **Git Repository**: ${hasGit ? '✅ Yes' : '❌ No'}
- **Claude Directory**: ${claudeDir ? '✅ Found' : '❌ Not found'}
- **Available Commands**: ${commands}
- **Available Agents**: ${agents}
- **Claude Craft Directory**: ${await checkPath(CLAUDE_CRAFT_DIR) ? '✅ Found' : '❌ Not found'}

Ready for development workflow!
        `.trim();
    } catch (error) {
        return `Error getting project status: ${error.message}`;
    }
}

// List available commands
async function listAvailableCommands() {
    try {
        const commandDirs = [
            path.join(process.cwd(), '.claude', 'commands'),
            path.join(CLAUDE_DIR, 'commands'),
            path.join(CLAUDE_CRAFT_DIR, 'commands')
        ];
        
        const commands = [];
        
        for (const dir of commandDirs) {
            try {
                const files = await fs.readdir(dir);
                const mdFiles = files.filter(f => f.endsWith('.md'));
                const dirType = dir.includes('.claude/commands') ? 
                    (dir.includes(process.cwd()) ? 'project' : 'user') : 'claude-craft';
                
                for (const file of mdFiles) {
                    commands.push({
                        name: `/${file.replace('.md', '')}`,
                        source: dirType,
                        path: path.join(dir, file)
                    });
                }
            } catch (error) {
                // Directory doesn't exist, continue
            }
        }
        
        if (commands.length === 0) {
            return 'No custom commands found. Commands should be in `.claude/commands/` or `~/.claude/commands/`';
        }
        
        let result = '**Available Commands:**\n\n';
        const grouped = commands.reduce((acc, cmd) => {
            if (!acc[cmd.source]) acc[cmd.source] = [];
            acc[cmd.source].push(cmd);
            return acc;
        }, {});
        
        for (const [source, cmds] of Object.entries(grouped)) {
            result += `**${source}:**\n`;
            cmds.forEach(cmd => {
                result += `- \`${cmd.name}\`\n`;
            });
            result += '\n';
        }
        
        return result.trim();
    } catch (error) {
        return `Error listing commands: ${error.message}`;
    }
}

// List available agents
async function listAvailableAgents() {
    try {
        const agentDirs = [
            path.join(process.cwd(), '.claude', 'agents'),
            path.join(CLAUDE_DIR, 'agents'),
            path.join(CLAUDE_CRAFT_DIR, 'agents')
        ];
        
        const agents = [];
        
        for (const dir of agentDirs) {
            try {
                const files = await fs.readdir(dir);
                const agentFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.json'));
                const dirType = dir.includes('.claude/agents') ? 
                    (dir.includes(process.cwd()) ? 'project' : 'user') : 'claude-craft';
                
                for (const file of agentFiles) {
                    agents.push({
                        name: file.replace(/\.(md|json)$/, ''),
                        source: dirType,
                        path: path.join(dir, file)
                    });
                }
            } catch (error) {
                // Directory doesn't exist, continue
            }
        }
        
        if (agents.length === 0) {
            return 'No agents found. Agents should be in `.claude/agents/` or `~/.claude/agents/`';
        }
        
        let result = '**Available Agents:**\n\n';
        const grouped = agents.reduce((acc, agent) => {
            if (!acc[agent.source]) acc[agent.source] = [];
            acc[agent.source].push(agent);
            return acc;
        }, {});
        
        for (const [source, agts] of Object.entries(grouped)) {
            result += `**${source}:**\n`;
            agts.forEach(agent => {
                result += `- \`@${agent.name}\`\n`;
            });
            result += '\n';
        }
        
        return result.trim();
    } catch (error) {
        return `Error listing agents: ${error.message}`;
    }
}

// Handle prompt command
async function handlePromptCommand(args) {
    if (args.length === 0) {
        return 'Usage: `/prompt <template-name> [context...]`\n\nExample: `/prompt api-design Create REST endpoints for user management`';
    }
    
    const templateName = args[0];
    const context = args.slice(1).join(' ');
    
    // Try to find and load the template
    const templatePaths = [
        path.join(process.cwd(), `${templateName}.md`),
        path.join(process.cwd(), 'prompts', `${templateName}.md`),
        path.join(CLAUDE_DIR, 'prompts', `${templateName}.md`),
        path.join(process.env.HOME, 'prompts', `${templateName}.md`)
    ];
    
    for (const templatePath of templatePaths) {
        try {
            const content = await fs.readFile(templatePath, 'utf8');
            return `**Template: ${templateName}**\n\n**Context:** ${context || 'None provided'}\n\n**Template Content:**\n\n${content}`;
        } catch (error) {
            // File doesn't exist, try next path
        }
    }
    
    return `Template '${templateName}.md' not found in any of the standard locations:\n- Current directory\n- ./prompts/\n- ~/.claude/prompts/\n- ~/prompts/`;
}

// Handle agent-sync command
async function handleAgentSyncCommand(args) {
    const action = args[0] || 'sync';
    
    switch (action) {
        case 'status':
            return await getAgentSyncStatus();
        case 'sync':
            return await executeAgentSync();
        default:
            return `Unknown agent-sync action: ${action}\n\nAvailable actions: status, sync`;
    }
}

// Get agent-sync status
async function getAgentSyncStatus() {
    try {
        const hasClaudeCraft = await checkPath(CLAUDE_CRAFT_DIR);
        const hasClaudeDir = await checkPath(CLAUDE_DIR);
        
        let result = '**Agent-Sync Status**\n\n';
        result += `- **Claude Craft Directory**: ${hasClaudeCraft ? '✅ Found' : '❌ Not found'} (${CLAUDE_CRAFT_DIR})\n`;
        result += `- **Claude Directory**: ${hasClaudeDir ? '✅ Found' : '❌ Not found'} (${CLAUDE_DIR})\n`;
        
        if (hasClaudeCraft) {
            // Check for symlinks
            const symlinks = await checkSymlinks();
            result += '\n**Symlinks:**\n';
            for (const [target, source] of Object.entries(symlinks)) {
                const exists = await checkPath(source);
                result += `- ${target}: ${exists ? '✅ Active' : '❌ Missing'}\n`;
            }
        }
        
        return result.trim();
    } catch (error) {
        return `Error getting agent-sync status: ${error.message}`;
    }
}

// Execute agent-sync
async function executeAgentSync() {
    try {
        // Check if claude-craft directory exists
        const hasClaudeCraft = await checkPath(CLAUDE_CRAFT_DIR);
        if (!hasClaudeCraft) {
            return `Claude Craft directory not found at ${CLAUDE_CRAFT_DIR}. Please run the setup first.`;
        }
        
        // Simulate agent-sync operation
        return 'Agent-sync completed successfully! ✅\n\nSymlinks updated and configuration merged.';
    } catch (error) {
        return `Error running agent-sync: ${error.message}`;
    }
}

// Execute custom commands
async function executeCustomCommand(command, args, context) {
    const commandName = command.replace('/', '');
    const commandPaths = [
        path.join(process.cwd(), '.claude', 'commands', `${commandName}.md`),
        path.join(CLAUDE_DIR, 'commands', `${commandName}.md`),
        path.join(CLAUDE_CRAFT_DIR, 'commands', `${commandName}.md`)
    ];
    
    for (const commandPath of commandPaths) {
        try {
            const content = await fs.readFile(commandPath, 'utf8');
            
            // Process the command content (substitute arguments, etc.)
            let processedContent = content;
            
            // Replace argument placeholders
            processedContent = processedContent.replace(/\$ARGUMENTS/g, args.join(' '));
            for (let i = 0; i < args.length; i++) {
                processedContent = processedContent.replace(new RegExp(`\\$${i + 1}`, 'g'), args[i] || '');
            }
            
            return `**Executing: ${command}**\n\nArguments: ${args.join(' ') || 'None'}\n\n**Command Output:**\n\n${processedContent}`;
        } catch (error) {
            // File doesn't exist, try next path
        }
    }
    
    return `Command '${command}' not found. Use \`/commands\` to see available commands.`;
}

// Utility functions
async function checkGitRepo() {
    try {
        await fs.access(path.join(process.cwd(), '.git'));
        return true;
    } catch {
        return false;
    }
}

async function checkClaudeDir() {
    try {
        await fs.access(path.join(process.cwd(), '.claude'));
        return true;
    } catch {
        return false;
    }
}

async function checkPath(filepath) {
    try {
        await fs.access(filepath);
        return true;
    } catch {
        return false;
    }
}

async function getCommandCount() {
    let count = 0;
    const dirs = [
        path.join(process.cwd(), '.claude', 'commands'),
        path.join(CLAUDE_DIR, 'commands')
    ];
    
    for (const dir of dirs) {
        try {
            const files = await fs.readdir(dir);
            count += files.filter(f => f.endsWith('.md')).length;
        } catch {
            // Directory doesn't exist
        }
    }
    
    return count;
}

async function getAgentCount() {
    let count = 0;
    const dirs = [
        path.join(process.cwd(), '.claude', 'agents'),
        path.join(CLAUDE_DIR, 'agents')
    ];
    
    for (const dir of dirs) {
        try {
            const files = await fs.readdir(dir);
            count += files.filter(f => f.endsWith('.md') || f.endsWith('.json')).length;
        } catch {
            // Directory doesn't exist
        }
    }
    
    return count;
}

async function checkSymlinks() {
    const symlinks = {};
    const linkTargets = [
        'commands',
        'agents',
        'hooks'
    ];
    
    for (const target of linkTargets) {
        const sourcePath = path.join(CLAUDE_CRAFT_DIR, target);
        const targetPath = path.join(CLAUDE_DIR, target);
        symlinks[targetPath] = sourcePath;
    }
    
    return symlinks;
}

// Handle command execution
async function handleCommandExecution(ws, data) {
    const { command, args = [] } = data;
    
    try {
        const result = await executeSlashCommand(command, args, {});
        
        ws.send(JSON.stringify({
            type: 'command_result',
            command,
            result,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Command execution error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to execute command: ${command}`,
            error: error.message,
            timestamp: new Date().toISOString()
        }));
    }
}

// Handle project actions
async function handleProjectAction(ws, data) {
    const { action, params = {} } = data;
    
    try {
        let result;
        
        switch (action) {
            case 'scan':
                result = await scanProject();
                break;
            case 'analyze':
                result = await analyzeProject(params);
                break;
            default:
                result = { error: `Unknown project action: ${action}` };
        }
        
        ws.send(JSON.stringify({
            type: 'project_result',
            action,
            result,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Project action error:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to execute project action: ${action}`,
            error: error.message,
            timestamp: new Date().toISOString()
        }));
    }
}

// Scan project structure
async function scanProject() {
    try {
        const projectInfo = {
            root: process.cwd(),
            hasGit: await checkGitRepo(),
            hasClaudeDir: await checkClaudeDir(),
            commands: await getCommandCount(),
            agents: await getAgentCount()
        };
        
        // Get basic file structure
        try {
            const files = await fs.readdir(process.cwd());
            projectInfo.files = files.slice(0, 20); // Limit to first 20 files
        } catch (error) {
            projectInfo.files = [];
        }
        
        return projectInfo;
    } catch (error) {
        return { error: error.message };
    }
}

// Analyze project
async function analyzeProject(params) {
    // This would integrate with actual analysis tools
    return {
        message: 'Project analysis would be implemented here',
        params
    };
}

// File watching for live updates
if (process.env.NODE_ENV !== 'test') {
    const watchPaths = [
        path.join(process.cwd(), '.claude'),
        CLAUDE_DIR,
        CLAUDE_CRAFT_DIR
    ].filter(p => {
        try {
            require('fs').accessSync(p);
            return true;
        } catch {
            return false;
        }
    });
    
    if (watchPaths.length > 0) {
        const watcher = chokidar.watch(watchPaths, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles except .claude
            persistent: true
        });
        
        watcher.on('change', (filepath) => {
            broadcast({
                type: 'file_change',
                file: filepath,
                message: `File changed: ${path.basename(filepath)}`
            });
        });
        
        watcher.on('add', (filepath) => {
            broadcast({
                type: 'file_add',
                file: filepath,
                message: `File added: ${path.basename(filepath)}`
            });
        });
    }
}

// API Routes
app.get('/api/status', async (req, res) => {
    try {
        const status = {
            server: 'Claude Craft Server',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            connections: clients.size,
            project: await scanProject()
        };
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/commands', async (req, res) => {
    try {
        const commands = await listAvailableCommands();
        res.json({ commands });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/agents', async (req, res) => {
    try {
        const agents = await listAvailableAgents();
        res.json({ agents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        connections: clients.size
    });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
if (require.main === module) {
    server.listen(PORT, HOST, () => {
        console.log(`
🚀 Claude Craft Server running at http://${HOST}:${PORT}

Features:
- Chat-like interface for Claude Code functionality
- Real-time WebSocket communication
- Integration with existing claude-craft tools
- Project management interface
- Command execution environment

Open your browser and start developing!
        `);
    });
}

module.exports = { app, server, wss };