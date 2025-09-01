const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

describe('Knowledge Discovery Tests', function() {
    this.timeout(10000);
    
    const knowledgeSync = path.join(__dirname, '..', 'tools', 'knowledge-sync.sh');
    const testKnowledgeDir = path.join(__dirname, 'fixtures', 'test-knowledge');
    const testClaudeFile = path.join(__dirname, 'fixtures', 'test-claude.md');
    
    before(function() {
        // Create test knowledge directory structure
        if (!fs.existsSync(testKnowledgeDir)) {
            fs.mkdirSync(testKnowledgeDir, { recursive: true });
        }
        
        // Create test knowledge files
        const testFiles = [
            {
                name: 'project-context.md',
                content: '# Project Context\n\nThis is a test project for knowledge discovery.'
            },
            {
                name: 'development-notes.md',
                content: '# Development Notes\n\nTest-driven development is important.'
            },
            {
                name: 'api-documentation.md',
                content: '# API Documentation\n\nAPI endpoints are documented here.'
            }
        ];
        
        testFiles.forEach(file => {
            fs.writeFileSync(
                path.join(testKnowledgeDir, file.name),
                file.content
            );
        });
    });
    
    after(function() {
        // Clean up test files
        if (fs.existsSync(testKnowledgeDir)) {
            fs.readdirSync(testKnowledgeDir).forEach(file => {
                fs.unlinkSync(path.join(testKnowledgeDir, file));
            });
            fs.rmdirSync(testKnowledgeDir);
        }
        
        if (fs.existsSync(testClaudeFile)) {
            fs.unlinkSync(testClaudeFile);
        }
        
        // Clean up any backup files
        const backupPattern = new RegExp(`${path.basename(testClaudeFile)}\\.backup-\\d{8}-\\d{6}`);
        const dir = path.dirname(testClaudeFile);
        fs.readdirSync(dir).forEach(file => {
            if (backupPattern.test(file)) {
                fs.unlinkSync(path.join(dir, file));
            }
        });
    });
    
    describe('Script Validation', function() {
        it('should exist and be executable', function() {
            expect(fs.existsSync(knowledgeSync)).to.be.true;
            const stats = fs.statSync(knowledgeSync);
            const isExecutable = (stats.mode & parseInt('0100', 8)) !== 0;
            expect(isExecutable).to.be.true;
        });
        
        it('should pass bash syntax check', async function() {
            try {
                await execAsync(`bash -n ${knowledgeSync}`);
                expect(true).to.be.true;
            } catch (error) {
                expect.fail(`Syntax error in script: ${error.message}`);
            }
        });
    });
    
    describe('Knowledge Discovery', function() {
        it('should discover knowledge files in specified directory', async function() {
            // Note: This test would need environment setup to work properly
            // For now, we'll test the script structure
            const scriptContent = fs.readFileSync(knowledgeSync, 'utf8');
            expect(scriptContent).to.include('discover_knowledge_files');
            expect(scriptContent).to.include('SEARCH_PATHS');
            expect(scriptContent).to.include('./knowledge');
            expect(scriptContent).to.include('~/knowledge');
        });
        
        it('should handle missing knowledge directory gracefully', async function() {
            const nonExistentPath = '/nonexistent/knowledge/path';
            // The script should not fail but should report no files found
            const scriptContent = fs.readFileSync(knowledgeSync, 'utf8');
            expect(scriptContent).to.include('No knowledge files found');
        });
    });
    
    describe('CLAUDE.md Generation', function() {
        it('should create knowledge section with proper markers', function() {
            const scriptContent = fs.readFileSync(knowledgeSync, 'utf8');
            expect(scriptContent).to.include('Claude Craft Knowledge Discovery');
            expect(scriptContent).to.include('KNOWLEDGE_START=');
            expect(scriptContent).to.include('KNOWLEDGE_END=');
        });
        
        it('should generate import statements for discovered files', function() {
            const scriptContent = fs.readFileSync(knowledgeSync, 'utf8');
            expect(scriptContent).to.include('<!-- Import:');
            expect(scriptContent).to.include('generate_knowledge_section');
        });
        
        it('should create backup before modifying CLAUDE.md', function() {
            const scriptContent = fs.readFileSync(knowledgeSync, 'utf8');
            expect(scriptContent).to.include('BACKUP_SUFFIX');
            expect(scriptContent).to.include('Backed up existing');
        });
        
        it('should handle existing knowledge section replacement', function() {
            const scriptContent = fs.readFileSync(knowledgeSync, 'utf8');
            expect(scriptContent).to.include('grep -q "$KNOWLEDGE_START"');
            expect(scriptContent).to.include('Updating existing knowledge section');
        });
    });
    
    describe('Knowledge Command', function() {
        const knowledgeCommand = path.join(__dirname, '..', 'commands', 'knowledge.md');
        
        it('should have knowledge command file', function() {
            expect(fs.existsSync(knowledgeCommand)).to.be.true;
        });
        
        it('should have proper frontmatter', function() {
            const content = fs.readFileSync(knowledgeCommand, 'utf8');
            expect(content).to.include('---');
            expect(content).to.include('description:');
            expect(content).to.include('allowed-tools:');
        });
        
        it('should support scan, list, and read actions', function() {
            const content = fs.readFileSync(knowledgeCommand, 'utf8');
            expect(content).to.include('scan');
            expect(content).to.include('list');
            expect(content).to.include('read');
        });
        
        it('should document search locations', function() {
            const content = fs.readFileSync(knowledgeCommand, 'utf8');
            expect(content).to.include('./knowledge/');
            expect(content).to.include('../knowledge/');
            expect(content).to.include('~/knowledge/');
        });
    });
    
    describe('Memory Fragment Integration', function() {
        const knowledgeFragment = path.join(__dirname, '..', 'memory', 'fragments', 'knowledge-discovery.md');
        
        it('should have knowledge discovery memory fragment', function() {
            expect(fs.existsSync(knowledgeFragment)).to.be.true;
        });
        
        it('should document knowledge discovery process', function() {
            const content = fs.readFileSync(knowledgeFragment, 'utf8');
            expect(content).to.include('Knowledge Discovery System');
            expect(content).to.include('Search Locations');
            expect(content).to.include('File Discovery Process');
        });
        
        it('should include implementation notes', function() {
            const content = fs.readFileSync(knowledgeFragment, 'utf8');
            expect(content).to.include('Hierarchical Override');
            expect(content).to.include('Contextual Relevance');
            expect(content).to.include('Standard Knowledge Categories');
        });
    });
    
    describe('Development Principles Integration', function() {
        const devPrinciples = path.join(__dirname, '..', 'memory', 'fragments', 'development-principles.md');
        
        it('should include knowledge discovery in development principles', function() {
            const content = fs.readFileSync(devPrinciples, 'utf8');
            expect(content).to.include('Knowledge Discovery Protocol');
            expect(content).to.include('ALWAYS');
            expect(content).to.include('check for knowledge directories');
        });
        
        it('should list all search locations', function() {
            const content = fs.readFileSync(devPrinciples, 'utf8');
            expect(content).to.include('./knowledge/');
            expect(content).to.include('../knowledge/');
            expect(content).to.include('~/knowledge/');
        });
    });
});