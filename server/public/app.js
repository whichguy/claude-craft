/**
 * Claude Craft - Local Development Interface
 * Client-side JavaScript for chat interface and WebSocket communication
 */

class ClaudeCraftApp {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.commandHistory = [];
        this.currentTheme = localStorage.getItem('theme') || 'auto';
        this.settings = this.loadSettings();
        
        this.init();
    }
    
    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadProjectInfo();
    }
    
    // WebSocket connection
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            this.setupWebSocketHandlers();
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.showConnectionError();
        }
    }
    
    setupWebSocketHandlers() {
        this.socket.onopen = () => {
            console.log('Connected to Claude Craft server');
            this.isConnected = true;
            this.updateConnectionStatus('connected', 'Connected');
        };
        
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateConnectionStatus('disconnected', 'Disconnected');
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    this.updateConnectionStatus('connecting', 'Reconnecting...');
                    this.connectWebSocket();
                }
            }, 3000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected', 'Connection Error');
        };
    }
    
    // Message handling
    handleMessage(message) {
        const { type, ...data } = message;
        
        switch (type) {
            case 'system':
                this.addSystemMessage(data.message);
                break;
            case 'chat':
                this.addChatMessage(data.role, data.message, data.timestamp);
                break;
            case 'command_result':
                this.addCommandResult(data.command, data.result);
                break;
            case 'error':
                this.addErrorMessage(data.message);
                break;
            case 'file_change':
            case 'file_add':
                this.showNotification(`File ${type.split('_')[1]}: ${data.file}`);
                break;
            default:
                console.log('Unknown message type:', type, data);
        }
    }
    
    // UI Event listeners
    setupEventListeners() {
        // Chat input
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        chatInput.addEventListener('input', (e) => {
            this.handleInputChange(e.target.value);
        });
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Quick actions
        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.currentTarget.dataset.command;
                if (command) {
                    chatInput.value = command;
                    this.sendMessage();
                }
            });
        });
        
        // Modal handlers
        document.getElementById('project-info-btn').addEventListener('click', () => {
            this.showModal('project-info-modal');
            this.loadProjectInfo();
        });
        
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showModal('settings-modal');
        });
        
        // Close modal handlers
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });
        
        // Modal background click to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
        
        // Settings handlers
        document.getElementById('theme-select').addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });
        
        // Context menu
        this.setupContextMenu();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault();
                        chatInput.focus();
                        break;
                    case 'i':
                        e.preventDefault();
                        this.showModal('project-info-modal');
                        break;
                    case ',':
                        e.preventDefault();
                        this.showModal('settings-modal');
                        break;
                }
            }
        });
    }
    
    // Message sending
    sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message || !this.isConnected) return;
        
        // Add to command history
        if (!this.commandHistory.includes(message)) {
            this.commandHistory.unshift(message);
            if (this.commandHistory.length > this.settings.commandHistorySize) {
                this.commandHistory.pop();
            }
            this.updateRecentCommands();
        }
        
        // Send message via WebSocket
        this.socket.send(JSON.stringify({
            type: 'chat',
            data: {
                message,
                context: this.getContext()
            }
        }));
        
        input.value = '';
        this.updateInputHints('');
    }
    
    // Message display
    addChatMessage(role, content, timestamp) {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Remove welcome message if it exists
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Process markdown-like content
        messageContent.innerHTML = this.formatMessageContent(content);
        
        messageElement.appendChild(messageContent);
        
        if (this.settings.showTimestamps && timestamp) {
            const timestampElement = document.createElement('div');
            timestampElement.className = 'message-timestamp';
            timestampElement.textContent = new Date(timestamp).toLocaleTimeString();
            messageElement.appendChild(timestampElement);
        }
        
        messagesContainer.appendChild(messageElement);
        
        if (this.settings.autoScroll) {
            this.scrollToBottom();
        }
        
        this.messageHistory.push({ role, content, timestamp });
    }
    
    addSystemMessage(content) {
        this.addChatMessage('system', content, new Date().toISOString());
    }
    
    addErrorMessage(content) {
        this.addChatMessage('system', `❌ Error: ${content}`, new Date().toISOString());
    }
    
    addCommandResult(command, result) {
        this.addChatMessage('assistant', result, new Date().toISOString());
    }
    
    // Content formatting
    formatMessageContent(content) {
        // Convert markdown-like formatting to HTML
        let formatted = content
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Lists
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            // Checkboxes
            .replace(/- \[x\] (.*$)/gim, '<li>✅ $1</li>')
            .replace(/- \[ \] (.*$)/gim, '<li>☐ $1</li>')
            // Line breaks
            .replace(/\n/g, '<br>');
        
        // Wrap consecutive list items in ul tags
        formatted = formatted.replace(/(<li>.*<\/li>)+/g, (match) => {
            return `<ul>${match}</ul>`;
        });
        
        return formatted;
    }
    
    // UI helpers
    updateConnectionStatus(status, text) {
        const indicator = document.getElementById('connection-indicator');
        const statusText = document.getElementById('connection-text');
        
        indicator.className = `status-dot ${status}`;
        statusText.textContent = text;
    }
    
    handleInputChange(value) {
        this.updateInputHints(value);
    }
    
    updateInputHints(value) {
        const hintsElement = document.getElementById('input-hints');
        
        if (value.startsWith('/')) {
            const command = value.split(' ')[0];
            const hints = this.getCommandHints(command);
            hintsElement.textContent = hints;
        } else {
            hintsElement.textContent = '';
        }
    }
    
    getCommandHints(command) {
        const commandHints = {
            '/help': 'Show available commands and help',
            '/status': 'Display project status',
            '/commands': 'List all available commands',
            '/agents': 'List all available agents',
            '/prompt': '/prompt <template> [context...] - Execute prompt template',
            '/agent-sync': 'Synchronize with claude-craft repository'
        };
        
        return commandHints[command] || 'Press Enter to execute command';
    }
    
    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Modals
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
    }
    
    closeModal(modal) {
        modal.classList.remove('show');
    }
    
    // Project info
    async loadProjectInfo() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            const content = document.getElementById('project-info-content');
            content.innerHTML = this.formatProjectInfo(data);
            
            // Also update project tree in sidebar
            this.updateProjectTree(data.project);
        } catch (error) {
            console.error('Failed to load project info:', error);
            const content = document.getElementById('project-info-content');
            content.innerHTML = '<div class="error">Failed to load project information</div>';
        }
    }
    
    formatProjectInfo(data) {
        return `
            <div class="info-section">
                <h3>Server Information</h3>
                <p><strong>Version:</strong> ${data.version}</p>
                <p><strong>Connections:</strong> ${data.connections}</p>
                <p><strong>Last Updated:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
            </div>
            
            <div class="info-section">
                <h3>Project Details</h3>
                <p><strong>Root:</strong> <code>${data.project.root}</code></p>
                <p><strong>Git Repository:</strong> ${data.project.hasGit ? '✅ Yes' : '❌ No'}</p>
                <p><strong>Claude Directory:</strong> ${data.project.hasClaudeDir ? '✅ Yes' : '❌ No'}</p>
                <p><strong>Commands Available:</strong> ${data.project.commands}</p>
                <p><strong>Agents Available:</strong> ${data.project.agents}</p>
            </div>
            
            <div class="info-section">
                <h3>Project Files (first 20)</h3>
                <ul>
                    ${data.project.files.map(file => `<li><code>${file}</code></li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    updateProjectTree(projectData) {
        const treeElement = document.getElementById('project-tree');
        
        if (projectData.files && projectData.files.length > 0) {
            treeElement.innerHTML = `
                <div class="tree-item">
                    <strong>📁 ${projectData.root.split('/').pop() || 'Project Root'}</strong>
                </div>
                ${projectData.files.slice(0, 10).map(file => 
                    `<div class="tree-item">📄 ${file}</div>`
                ).join('')}
                ${projectData.files.length > 10 ? 
                    `<div class="tree-item">... and ${projectData.files.length - 10} more files</div>` : 
                    ''
                }
            `;
        } else {
            treeElement.innerHTML = '<div class="loading">No files found</div>';
        }
    }
    
    updateRecentCommands() {
        const container = document.getElementById('recent-commands');
        
        if (this.commandHistory.length > 0) {
            container.innerHTML = this.commandHistory.slice(0, 5).map(cmd => 
                `<div class="recent-command" data-command="${cmd}">${cmd}</div>`
            ).join('');
            
            // Add click handlers
            container.querySelectorAll('.recent-command').forEach(elem => {
                elem.addEventListener('click', () => {
                    document.getElementById('chat-input').value = elem.dataset.command;
                });
            });
        } else {
            container.innerHTML = '<div class="no-commands">No recent commands</div>';
        }
    }
    
    // Theme management
    setupTheme() {
        const themeSelect = document.getElementById('theme-select');
        themeSelect.value = this.currentTheme;
        this.applyTheme(this.currentTheme);
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme(theme);
    }
    
    applyTheme(theme) {
        const root = document.documentElement;
        
        if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }
    }
    
    // Settings management
    loadSettings() {
        const defaults = {
            autoScroll: true,
            commandHistorySize: 50,
            showTimestamps: true
        };
        
        const saved = localStorage.getItem('claude-craft-settings');
        if (saved) {
            try {
                return { ...defaults, ...JSON.parse(saved) };
            } catch (error) {
                console.error('Error loading settings:', error);
                return defaults;
            }
        }
        
        return defaults;
    }
    
    saveSettings() {
        localStorage.setItem('claude-craft-settings', JSON.stringify(this.settings));
    }
    
    // Context menu
    setupContextMenu() {
        const contextMenu = document.getElementById('context-menu');
        
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.chat-messages')) {
                e.preventDefault();
                
                contextMenu.style.left = `${e.pageX}px`;
                contextMenu.style.top = `${e.pageY}px`;
                contextMenu.style.display = 'block';
            }
        });
        
        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });
        
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'copy':
                    this.copySelectedText();
                    break;
                case 'select':
                    this.selectAllText();
                    break;
                case 'clear':
                    this.clearChat();
                    break;
            }
            
            contextMenu.style.display = 'none';
        });
    }
    
    copySelectedText() {
        const selection = window.getSelection();
        if (selection.toString()) {
            navigator.clipboard.writeText(selection.toString());
            this.showNotification('Text copied to clipboard');
        }
    }
    
    selectAllText() {
        const messagesContainer = document.getElementById('chat-messages');
        const range = document.createRange();
        range.selectNodeContents(messagesContainer);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🚀</div>
                <h2>Welcome back to Claude Craft</h2>
                <p>Chat cleared. How can I help you today?</p>
            </div>
        `;
        this.messageHistory = [];
    }
    
    // Utility methods
    getContext() {
        return {
            currentPath: window.location.pathname,
            messageCount: this.messageHistory.length,
            lastCommands: this.commandHistory.slice(0, 3)
        };
    }
    
    showNotification(message) {
        // Simple notification - could be enhanced with a proper notification system
        console.log('Notification:', message);
        
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    showConnectionError() {
        this.addSystemMessage('❌ Failed to connect to Claude Craft server. Please check if the server is running.');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.claudeCraftApp = new ClaudeCraftApp();
});

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .info-section {
        margin-bottom: 24px;
        padding: 16px;
        background-color: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
    }
    
    .info-section h3 {
        margin-bottom: 12px;
        color: var(--primary-color);
        font-size: 1.1rem;
        font-weight: 600;
    }
    
    .info-section p {
        margin-bottom: 8px;
        font-size: 0.9rem;
    }
    
    .info-section ul {
        max-height: 200px;
        overflow-y: auto;
        padding-left: 0;
        list-style: none;
    }
    
    .info-section li {
        padding: 4px 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
    }
    
    .tree-item {
        padding: 4px 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 4px;
        padding-left: 8px;
        transition: background-color 0.2s ease;
    }
    
    .tree-item:hover {
        background-color: var(--surface-color);
    }
    
    .recent-command {
        padding: 6px 8px;
        font-size: 0.875rem;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 4px;
        font-family: var(--font-mono);
        background-color: var(--code-background);
        border: 1px solid var(--border-color);
        margin-bottom: 4px;
        transition: all 0.2s ease;
    }
    
    .recent-command:hover {
        background-color: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }
    
    .error {
        color: var(--error-color);
        font-style: italic;
        text-align: center;
        padding: 16px;
    }
`;

document.head.appendChild(style);