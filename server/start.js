#!/usr/bin/env node

/**
 * Claude Craft Server Launcher
 * Enhanced startup script with configuration and integration options
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ClaudeCraftLauncher {
    constructor() {
        this.config = {
            port: process.env.CLAUDE_CRAFT_PORT || 3000,
            host: process.env.CLAUDE_CRAFT_HOST || 'localhost',
            autoOpenBrowser: process.env.CLAUDE_CRAFT_AUTO_OPEN !== 'false',
            checkDependencies: process.env.CLAUDE_CRAFT_CHECK_DEPS !== 'false',
            logLevel: process.env.CLAUDE_CRAFT_LOG_LEVEL || 'info'
        };
        
        this.serverProcess = null;
        this.isShuttingDown = false;
    }
    
    async start() {
        try {
            console.log('🚀 Starting Claude Craft Server...\n');
            
            await this.checkEnvironment();
            await this.checkDependencies();
            await this.prepareDirectories();
            await this.startServer();
            
        } catch (error) {
            console.error('❌ Failed to start server:', error.message);
            process.exit(1);
        }
    }
    
    async checkEnvironment() {
        console.log('🔍 Checking environment...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 16) {
            throw new Error(`Node.js 16+ required, found ${nodeVersion}`);
        }
        
        console.log(`✅ Node.js version: ${nodeVersion}`);
        
        // Check for Claude Code directories
        const claudeDir = path.join(process.env.HOME, '.claude');
        const claudeCraftDir = path.join(process.env.HOME, 'claude-craft');
        
        try {
            await fs.access(claudeDir);
            console.log('✅ Claude directory found:', claudeDir);
        } catch {
            console.log('⚠️  Claude directory not found:', claudeDir);
        }
        
        try {
            await fs.access(claudeCraftDir);
            console.log('✅ Claude Craft directory found:', claudeCraftDir);
        } catch {
            console.log('⚠️  Claude Craft directory not found:', claudeCraftDir);
            console.log('   Consider running: git clone https://github.com/whichguy/claude-craft.git ~/claude-craft');
        }
        
        console.log();
    }
    
    async checkDependencies() {
        if (!this.config.checkDependencies) {
            console.log('⏭️  Skipping dependency check...\n');
            return;
        }
        
        console.log('📦 Checking dependencies...');
        
        const packageJsonPath = path.join(__dirname, 'package.json');
        
        try {
            await fs.access(path.join(__dirname, 'node_modules'));
            console.log('✅ Node modules found');
        } catch {
            console.log('⚠️  Node modules not found, installing...');
            
            try {
                await this.execCommand('npm install', { cwd: __dirname });
                console.log('✅ Dependencies installed');
            } catch (error) {
                throw new Error(`Failed to install dependencies: ${error.message}`);
            }
        }
        
        console.log();
    }
    
    async prepareDirectories() {
        console.log('📁 Preparing directories...');
        
        // Ensure public directory exists
        const publicDir = path.join(__dirname, 'public');
        try {
            await fs.access(publicDir);
            console.log('✅ Public directory ready');
        } catch {
            throw new Error('Public directory not found - this appears to be an incomplete installation');
        }
        
        // Check for server.js
        const serverPath = path.join(__dirname, 'server.js');
        try {
            await fs.access(serverPath);
            console.log('✅ Server script ready');
        } catch {
            throw new Error('Server script not found - this appears to be an incomplete installation');
        }
        
        console.log();
    }
    
    async startServer() {
        console.log('🌐 Starting web server...');
        
        // Check if port is available
        if (await this.isPortInUse(this.config.port)) {
            console.log(`⚠️  Port ${this.config.port} is already in use`);
            
            // Try to find an available port
            let newPort = this.config.port;
            while (await this.isPortInUse(newPort) && newPort < this.config.port + 10) {
                newPort++;
            }
            
            if (newPort !== this.config.port) {
                console.log(`🔄 Using port ${newPort} instead`);
                this.config.port = newPort;
            } else {
                throw new Error(`No available ports found around ${this.config.port}`);
            }
        }
        
        // Start the server process
        const env = {
            ...process.env,
            PORT: this.config.port,
            HOST: this.config.host,
            NODE_ENV: process.env.NODE_ENV || 'development'
        };
        
        this.serverProcess = spawn('node', ['server.js'], {
            cwd: __dirname,
            env,
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        // Handle server output
        this.serverProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(output);
            }
        });
        
        this.serverProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error && !error.includes('ExperimentalWarning')) {
                console.error('Server Error:', error);
            }
        });
        
        // Handle server events
        this.serverProcess.on('spawn', () => {
            console.log('✅ Server process started');
            this.setupGracefulShutdown();
            this.scheduleOpenBrowser();
        });
        
        this.serverProcess.on('error', (error) => {
            console.error('❌ Failed to start server process:', error.message);
            process.exit(1);
        });
        
        this.serverProcess.on('exit', (code, signal) => {
            if (!this.isShuttingDown) {
                console.error(`❌ Server process exited with code ${code} (signal: ${signal})`);
                process.exit(code || 1);
            }
        });
    }
    
    async isPortInUse(port) {
        try {
            const { stdout } = await execAsync(`netstat -an | grep :${port}`);
            return stdout.includes(`LISTEN`) || stdout.includes(`:${port}`);
        } catch {
            return false;
        }
    }
    
    scheduleOpenBrowser() {
        if (this.config.autoOpenBrowser) {
            setTimeout(() => {
                this.openBrowser();
            }, 2000); // Give server time to start
        }
    }
    
    async openBrowser() {
        const url = `http://${this.config.host}:${this.config.port}`;
        
        try {
            let command;
            switch (process.platform) {
                case 'darwin':
                    command = `open "${url}"`;
                    break;
                case 'win32':
                    command = `start "${url}"`;
                    break;
                default:
                    command = `xdg-open "${url}"`;
            }
            
            await execAsync(command);
            console.log(`🌐 Opened browser: ${url}`);
        } catch (error) {
            console.log(`🌐 Server running at: ${url}`);
            console.log('   (Could not automatically open browser)');
        }
    }
    
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            if (this.isShuttingDown) return;
            
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            this.isShuttingDown = true;
            
            if (this.serverProcess) {
                this.serverProcess.kill('SIGTERM');
                
                setTimeout(() => {
                    if (!this.serverProcess.killed) {
                        console.log('⚠️  Forcing server shutdown...');
                        this.serverProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
            
            setTimeout(() => {
                console.log('👋 Claude Craft Server stopped');
                process.exit(0);
            }, 1000);
        };
        
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            shutdown('UNCAUGHT_EXCEPTION');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('UNHANDLED_REJECTION');
        });
    }
    
    async execCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`${error.message}\\n${stderr}`));
                } else {
                    resolve(stdout);
                }
            });
        });
    }
}

// Command-line interface
function showHelp() {
    console.log(`
Claude Craft Server - Local Development Interface

Usage:
  node start.js [options]

Options:
  --port <number>    Server port (default: 3000)
  --host <string>    Server host (default: localhost)  
  --no-browser       Don't auto-open browser
  --no-deps-check    Skip dependency checking
  --log-level <level> Log level (default: info)
  --help, -h         Show this help message

Environment Variables:
  CLAUDE_CRAFT_PORT        Server port
  CLAUDE_CRAFT_HOST        Server host
  CLAUDE_CRAFT_AUTO_OPEN   Auto-open browser (true/false)
  CLAUDE_CRAFT_CHECK_DEPS  Check dependencies (true/false)
  CLAUDE_CRAFT_LOG_LEVEL   Log level

Examples:
  node start.js                    # Start with defaults
  node start.js --port 8080        # Use port 8080
  node start.js --no-browser       # Don't open browser
  node start.js --host 0.0.0.0     # Listen on all interfaces

For more information, visit: https://github.com/whichguy/claude-craft
    `);
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
            case '--port':
                config.port = parseInt(args[++i]);
                if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
                    console.error('❌ Invalid port number');
                    process.exit(1);
                }
                break;
            case '--host':
                config.host = args[++i];
                if (!config.host) {
                    console.error('❌ Invalid host');
                    process.exit(1);
                }
                break;
            case '--no-browser':
                config.autoOpenBrowser = false;
                break;
            case '--no-deps-check':
                config.checkDependencies = false;
                break;
            case '--log-level':
                config.logLevel = args[++i];
                break;
            default:
                console.error(`❌ Unknown option: ${arg}`);
                console.log('Use --help for available options');
                process.exit(1);
        }
    }
    
    return config;
}

// Main execution
if (require.main === module) {
    const config = parseArgs();
    const launcher = new ClaudeCraftLauncher();
    
    // Apply command-line config
    Object.assign(launcher.config, config);
    
    launcher.start();
}

module.exports = ClaudeCraftLauncher;