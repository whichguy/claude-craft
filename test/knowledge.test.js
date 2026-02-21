const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Knowledge Discovery Tests', function() {
    this.timeout(10000);

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
});
