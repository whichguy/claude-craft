const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

describe('Security Scanner Tests', function() {
    this.timeout(10000); // Allow longer timeout for shell script execution
    
    const securityScanner = path.join(__dirname, '..', 'tools', 'security-scan.sh');
    const testFixtures = path.join(__dirname, 'fixtures');
    const sensitiveData = path.join(testFixtures, 'sensitive-test-data.md');
    
    before(function() {
        // Ensure test fixtures exist
        if (!fs.existsSync(testFixtures)) {
            throw new Error('Test fixtures directory not found');
        }
        if (!fs.existsSync(sensitiveData)) {
            throw new Error('Sensitive test data file not found');
        }
        if (!fs.existsSync(securityScanner)) {
            throw new Error('Security scanner script not found');
        }
    });
    
    describe('Script Validation', function() {
        it('should have executable permissions', function() {
            const stats = fs.statSync(securityScanner);
            const isExecutable = (stats.mode & parseInt('0100', 8)) !== 0;
            expect(isExecutable).to.be.true;
        });
        
        it('should pass bash syntax check', async function() {
            try {
                await execAsync(`bash -n ${securityScanner}`);
                expect(true).to.be.true; // Syntax check passed
            } catch (error) {
                expect.fail(`Syntax error in script: ${error.message}`);
            }
        });
    });
    
    describe('Security Detection - API Keys', function() {
        it('should detect Anthropic API keys', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('sk-ant-api03');
            expect(stdout).to.include('CRITICAL SECURITY ISSUES');
            expect(stdout).to.include('Anthropic API key detected');
            expect(stdout).to.include('Solutions:');
        });
        
        it('should detect OpenAI API keys', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('sk-proj-');
            expect(stdout).to.include('sk-1234567890');
        });
        
        it('should detect GitHub tokens', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('ghp_');
            expect(stdout).to.include('ghs_');
            expect(stdout).to.include('ghu_');
            expect(stdout).to.include('GitHub token detected');
        });
        
        it('should detect AWS credentials', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('AKIA');
            expect(stdout).to.include('aws_secret_access_key');
            expect(stdout).to.include('AWS key detected');
        });
        
        it('should detect database connection strings', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('postgres://');
            expect(stdout).to.include('mongodb://');
            expect(stdout).to.include('mysql://');
        });
        
        it('should detect JWT tokens', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('eyJ');
        });
        
        it('should detect passwords', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('password');
            expect(stdout).to.include('SuperSecret123');
        });
    });
    
    describe('Personal Information Detection', function() {
        it('should detect email addresses in full scan', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} full false 2>/dev/null`
            );
            expect(stdout).to.include('john.smith.personal@gmail.com');
            expect(stdout).to.include('PERSONAL INFO');
        });
        
        it('should detect personal names', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} full false 2>/dev/null`
            );
            expect(stdout).to.include('John Michael Smith');
        });
        
        it('should detect addresses', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} full false 2>/dev/null`
            );
            expect(stdout).to.include('742 Evergreen Terrace');
        });
        
        it('should detect phone numbers', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} full false 2>/dev/null`
            );
            expect(stdout).to.include('555');
        });
        
        it('should not detect PII in secrets-only scan', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            // Should still find critical issues but not warn about personal info
            expect(stdout).to.include('CRITICAL SECURITY ISSUES');
            // But shouldn't include the email in the critical issues section
            const criticalSection = stdout.split('📊 Scan Summary')[0];
            expect(criticalSection).to.not.include('john.smith.personal@gmail.com');
        });
    });
    
    describe('Clean Files', function() {
        it('should pass clean files without issues', async function() {
            // Create a temporary clean file
            const cleanFile = path.join(testFixtures, 'clean-test.md');
            const cleanContent = `# Clean Test File
            
## Development Preferences
- Use async/await over promises
- Prefer const over let
- Test-driven development

## Safe Examples
- API Key: \${API_KEY}
- Email: user@example.com
- Phone: xxx-xxx-xxxx`;
            
            fs.writeFileSync(cleanFile, cleanContent);
            
            try {
                const { stdout } = await execAsync(
                    `${securityScanner} ${testFixtures} secrets false 2>/dev/null | grep "clean-test.md"`
                );
                expect(stdout).to.include('✅');
                expect(stdout).to.include('Clean');
            } finally {
                // Clean up
                if (fs.existsSync(cleanFile)) {
                    fs.unlinkSync(cleanFile);
                }
            }
        });
    });
    
    describe('Exit Codes', function() {
        it('should exit with code 0 for clean files', async function() {
            const cleanDir = path.join(testFixtures, 'clean-dir');
            if (!fs.existsSync(cleanDir)) {
                fs.mkdirSync(cleanDir, { recursive: true });
            }
            
            const cleanFile = path.join(cleanDir, 'safe.md');
            fs.writeFileSync(cleanFile, '# Safe content\nNo secrets here.');
            
            try {
                await execAsync(`${securityScanner} ${cleanDir} full true`);
                expect(true).to.be.true; // No error thrown means exit code 0
            } catch (error) {
                expect.fail('Should not fail on clean files');
            } finally {
                // Clean up
                if (fs.existsSync(cleanFile)) {
                    fs.unlinkSync(cleanFile);
                }
                if (fs.existsSync(cleanDir)) {
                    fs.rmdirSync(cleanDir);
                }
            }
        });
        
        it('should exit with code 1 when issues found and exit_on_issues is true', async function() {
            try {
                await execAsync(`${securityScanner} ${testFixtures} secrets true`);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.code).to.equal(1);
            }
        });
        
        it('should exit with code 0 when issues found but exit_on_issues is false', async function() {
            try {
                await execAsync(`${securityScanner} ${testFixtures} secrets false`);
                expect(true).to.be.true; // No error thrown
            } catch (error) {
                expect.fail('Should not fail when exit_on_issues is false');
            }
        });
    });
    
    describe('Scan Types', function() {
        it('should respect secrets scan type', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} secrets false 2>/dev/null`
            );
            expect(stdout).to.include('Scan type: secrets');
        });
        
        it('should respect pii scan type', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} pii false 2>/dev/null`
            );
            expect(stdout).to.include('Scan type: pii');
        });
        
        it('should respect full scan type', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} ${testFixtures} full false 2>/dev/null`
            );
            expect(stdout).to.include('Scan type: full');
        });
    });
    
    describe('Error Handling', function() {
        it('should handle missing directory gracefully', async function() {
            const { stdout } = await execAsync(
                `${securityScanner} /nonexistent/path full false 2>/dev/null || echo "handled"`
            );
            expect(stdout).to.include('Memory path not found');
        });
        
        it('should handle invalid scan type', async function() {
            try {
                await execAsync(`${securityScanner} ${testFixtures} invalid false 2>&1`);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.stdout || error.stderr).to.include('Invalid scan type');
            }
        });
    });
});

describe('Security Command Integration', function() {
    const craftCommand = path.join(__dirname, '..', 'commands', 'craft.md');
    
    it('should have security scan integrated in craft push', function() {
        const craftContent = fs.readFileSync(craftCommand, 'utf8');
        expect(craftContent).to.include('security-scan');
        expect(craftContent).to.include('Security scan failed');
    });
    
    it('should have scan action in craft command', function() {
        const craftContent = fs.readFileSync(craftCommand, 'utf8');
        expect(craftContent).to.include('"scan")');
        expect(craftContent).to.include('Running security scan');
    });
});