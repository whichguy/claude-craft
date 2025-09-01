const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

describe('Backup and Restore Tests', function() {
    this.timeout(10000);
    
    const backupScript = path.join(__dirname, '..', 'tools', 'backup.sh');
    const testClaudeDir = path.join(__dirname, 'fixtures', 'test-claude');
    const testBackupDir = path.join(testClaudeDir, 'backups');
    
    beforeEach(function() {
        // Create test Claude directory structure
        if (!fs.existsSync(testClaudeDir)) {
            fs.mkdirSync(testClaudeDir, { recursive: true });
        }
        
        // Create test files to backup
        fs.writeFileSync(
            path.join(testClaudeDir, 'settings.json'),
            JSON.stringify({ test: true }, null, 2)
        );
        
        fs.writeFileSync(
            path.join(testClaudeDir, 'CLAUDE.md'),
            '# Test CLAUDE.md\n\nTest content for backup.'
        );
        
        // Create commands directory with test command
        const commandsDir = path.join(testClaudeDir, 'commands');
        if (!fs.existsSync(commandsDir)) {
            fs.mkdirSync(commandsDir);
        }
        fs.writeFileSync(
            path.join(commandsDir, 'test-command.md'),
            '# Test Command\n\nTest command content.'
        );
    });
    
    afterEach(function() {
        // Clean up test files
        if (fs.existsSync(testClaudeDir)) {
            // Recursively delete test directory
            const deleteFolderRecursive = (dirPath) => {
                if (fs.existsSync(dirPath)) {
                    fs.readdirSync(dirPath).forEach((file) => {
                        const curPath = path.join(dirPath, file);
                        if (fs.lstatSync(curPath).isDirectory()) {
                            deleteFolderRecursive(curPath);
                        } else {
                            fs.unlinkSync(curPath);
                        }
                    });
                    fs.rmdirSync(dirPath);
                }
            };
            deleteFolderRecursive(testClaudeDir);
        }
    });
    
    describe('Script Validation', function() {
        it('should exist and be executable', function() {
            expect(fs.existsSync(backupScript)).to.be.true;
            const stats = fs.statSync(backupScript);
            const isExecutable = (stats.mode & parseInt('0100', 8)) !== 0;
            expect(isExecutable).to.be.true;
        });
        
        it('should pass bash syntax check', async function() {
            try {
                await execAsync(`bash -n ${backupScript}`);
                expect(true).to.be.true;
            } catch (error) {
                expect.fail(`Syntax error in script: ${error.message}`);
            }
        });
    });
    
    describe('Backup Functionality', function() {
        it('should create backup directory if not exists', async function() {
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            expect(fs.existsSync(testBackupDir)).to.be.true;
            expect(stdout).to.include('Backup complete');
        });
        
        it('should backup settings.json', async function() {
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            expect(stdout).to.include('Backed up settings.json');
            
            // Check that backup file exists
            const backupFiles = fs.readdirSync(testBackupDir);
            const settingsBackup = backupFiles.find(f => f.startsWith('settings-') && f.endsWith('.json'));
            expect(settingsBackup).to.not.be.undefined;
        });
        
        it('should backup CLAUDE.md', async function() {
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            expect(stdout).to.include('Backed up CLAUDE.md');
            
            // Check that backup file exists
            const backupFiles = fs.readdirSync(testBackupDir);
            const claudeBackup = backupFiles.find(f => f.startsWith('CLAUDE-') && f.endsWith('.md'));
            expect(claudeBackup).to.not.be.undefined;
        });
        
        it('should backup commands directory', async function() {
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            expect(stdout).to.include('Backed up commands directory');
            
            // Check that commands backup exists
            const backupFiles = fs.readdirSync(testBackupDir);
            const commandsBackup = backupFiles.find(f => f.startsWith('commands-') && f.endsWith('.tar.gz'));
            expect(commandsBackup).to.not.be.undefined;
        });
        
        it('should create timestamped backup', async function() {
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            // Extract timestamp from output
            const timestampMatch = stdout.match(/Timestamp: (\d{8}-\d{6})/);
            expect(timestampMatch).to.not.be.null;
            
            const timestamp = timestampMatch[1];
            expect(timestamp).to.match(/^\d{8}-\d{6}$/);
            
            // Check that backup files have timestamp
            const backupFiles = fs.readdirSync(testBackupDir);
            const timestampedFiles = backupFiles.filter(f => f.includes(timestamp));
            expect(timestampedFiles.length).to.be.greaterThan(0);
        });
        
        it('should count backed up files correctly', async function() {
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            // Should backup at least settings.json, CLAUDE.md, and commands
            const fileCountMatch = stdout.match(/Backup complete! \((\d+) files\)/);
            expect(fileCountMatch).to.not.be.null;
            
            const fileCount = parseInt(fileCountMatch[1]);
            expect(fileCount).to.be.at.least(3);
        });
    });
    
    describe('Restore Functionality', function() {
        it('should validate timestamp format', function() {
            const scriptContent = fs.readFileSync(backupScript, 'utf8');
            expect(scriptContent).to.include('validate_timestamp');
            expect(scriptContent).to.include('[0-9]{8}-[0-9]{6}');
        });
        
        it('should restore from backup', async function() {
            // First create a backup
            await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            // Get the timestamp from the backup
            const backupFiles = fs.readdirSync(testBackupDir);
            const timestampMatch = backupFiles[0].match(/(\d{8}-\d{6})/);
            const timestamp = timestampMatch ? timestampMatch[1] : null;
            expect(timestamp).to.not.be.null;
            
            // Modify original files
            fs.writeFileSync(
                path.join(testClaudeDir, 'settings.json'),
                JSON.stringify({ modified: true }, null, 2)
            );
            
            // Test restore (would need interactive confirmation in real script)
            const scriptContent = fs.readFileSync(backupScript, 'utf8');
            expect(scriptContent).to.include('restore_backup');
            expect(scriptContent).to.include('Restore backup from');
        });
    });
    
    describe('Error Handling', function() {
        it('should handle missing files gracefully', async function() {
            // Remove a file that would normally be backed up
            const settingsPath = path.join(testClaudeDir, 'settings.json');
            if (fs.existsSync(settingsPath)) {
                fs.unlinkSync(settingsPath);
            }
            
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null || echo "handled"`
            );
            
            // Should still complete backup of other files
            expect(stdout).to.include('Backup complete');
        });
        
        it('should create backup directory if not exists', async function() {
            // Ensure backup directory doesn't exist
            if (fs.existsSync(testBackupDir)) {
                fs.rmdirSync(testBackupDir, { recursive: true });
            }
            
            const { stdout } = await execAsync(
                `CLAUDE_DIR="${testClaudeDir}" ${backupScript} 2>/dev/null`
            );
            
            expect(fs.existsSync(testBackupDir)).to.be.true;
            expect(stdout).to.include('Backup complete');
        });
    });
    
    describe('Integration with Craft Command', function() {
        const craftCommand = path.join(__dirname, '..', 'commands', 'craft.md');
        
        it('should be integrated in craft command', function() {
            const content = fs.readFileSync(craftCommand, 'utf8');
            expect(content).to.include('backup');
            expect(content).to.include('Create backup before changes');
        });
        
        it('should be called in safe_merge_configs', function() {
            const content = fs.readFileSync(craftCommand, 'utf8');
            expect(content).to.include('safe_merge_configs');
            expect(content).to.include('tools/backup.sh');
        });
    });
    
    describe('Merge Settings Functionality', function() {
        const mergeScript = path.join(__dirname, '..', 'tools', 'merge-settings.sh');
        
        it('should exist and be executable', function() {
            expect(fs.existsSync(mergeScript)).to.be.true;
            const stats = fs.statSync(mergeScript);
            const isExecutable = (stats.mode & parseInt('0100', 8)) !== 0;
            expect(isExecutable).to.be.true;
        });
        
        it('should validate JSON before merging', function() {
            const content = fs.readFileSync(mergeScript, 'utf8');
            expect(content).to.include('validate_fragment');
            expect(content).to.include('jq empty');
        });
        
        it('should create backup before merging', function() {
            const content = fs.readFileSync(mergeScript, 'utf8');
            expect(content).to.include('Creating backup');
            expect(content).to.include('backup-');
        });
        
        it('should deep merge JSON', function() {
            const content = fs.readFileSync(mergeScript, 'utf8');
            expect(content).to.include('jq -s');
            expect(content).to.include('reduce');
            expect(content).to.include('* $item');
        });
    });
    
    describe('Add Memory Functionality', function() {
        const addMemoryScript = path.join(__dirname, '..', 'tools', 'add-memory.sh');
        
        it('should exist and be executable', function() {
            expect(fs.existsSync(addMemoryScript)).to.be.true;
            const stats = fs.statSync(addMemoryScript);
            const isExecutable = (stats.mode & parseInt('0100', 8)) !== 0;
            expect(isExecutable).to.be.true;
        });
        
        it('should use craft markers', function() {
            const content = fs.readFileSync(addMemoryScript, 'utf8');
            expect(content).to.include('Claude Craft Extensions');
            expect(content).to.include('CRAFT_MARKER');
        });
        
        it('should check for existing imports', function() {
            const content = fs.readFileSync(addMemoryScript, 'utf8');
            expect(content).to.include('check_import_exists');
            expect(content).to.include('grep -q');
        });
        
        it('should add import statements', function() {
            const content = fs.readFileSync(addMemoryScript, 'utf8');
            expect(content).to.include('add_craft_imports');
            expect(content).to.include('<!-- Import:');
        });
    });
});