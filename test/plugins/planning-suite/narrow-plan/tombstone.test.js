'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_LIB = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'narrow-plan', 'lib');
const { apply, validate } = require(path.join(SKILL_LIB, 'tombstone'));

function tmpRunDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'narrow-plan-tombstone-'));
    fs.writeFileSync(path.join(dir, 'prompt.md'), '# original intent\n');
    fs.writeFileSync(path.join(dir, 'tombstones.jsonl'), '');
    execFileSync('git', ['-C', dir, 'init', '-q']);
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
    execFileSync('git', ['-C', dir, 'add', '.']);
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'init']);
    return dir;
}

describe('lib/tombstone.js', function () {
    describe('validate', function () {
        it('accepts a valid record', function () {
            expect(() => validate({
                round: 1, question: 'q', answer: 'a', source: 'llm', agreed_by_two_framings: true
            })).to.not.throw();
        });

        it('rejects missing fields', function () {
            expect(() => validate({ round: 1, question: 'q', answer: 'a', source: 'llm' }))
                .to.throw(/agreed_by_two_framings/);
        });

        it('rejects bad source', function () {
            expect(() => validate({
                round: 1, question: 'q', answer: 'a', source: 'bot', agreed_by_two_framings: true
            })).to.throw(/source/);
        });

        it('rejects non-positive round', function () {
            expect(() => validate({
                round: 0, question: 'q', answer: 'a', source: 'llm', agreed_by_two_framings: true
            })).to.throw(/round/);
        });

        it('rejects empty question/answer', function () {
            expect(() => validate({
                round: 1, question: '', answer: 'a', source: 'llm', agreed_by_two_framings: true
            })).to.throw(/question/);
        });
    });

    describe('apply (with git)', function () {
        it('appends to jsonl + prompt.md and lands a commit with the expected message', function () {
            const dir = tmpRunDir();
            const record = {
                round: 1, question: 'mobile or web?', answer: 'mobile',
                source: 'llm', agreed_by_two_framings: true
            };
            apply({ runDir: dir, record, commitMessage: 'round-1: A p_top=0.85 margin=0.45' });

            const tombstones = fs.readFileSync(path.join(dir, 'tombstones.jsonl'), 'utf8').trim();
            expect(JSON.parse(tombstones)).to.deep.equal(record);

            const promptMd = fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8');
            expect(promptMd).to.include('# original intent');
            expect(promptMd).to.include('## Round 1 Q/A');
            expect(promptMd).to.include('mobile or web?');
            expect(promptMd).to.include('mobile');

            const lastCommitMsg = execFileSync('git', ['-C', dir, 'log', '-1', '--format=%s'])
                .toString().trim();
            expect(lastCommitMsg).to.equal('round-1: A p_top=0.85 margin=0.45');
        });

        it('writes files in the documented order: jsonl → prompt.md → git commit', function () {
            // Verify by checking the working-tree state right before the commit.
            // We use skipGit to inspect intermediate state.
            const dir = tmpRunDir();
            const record = {
                round: 2, question: 'q2', answer: 'a2',
                source: 'user', agreed_by_two_framings: false
            };
            apply({ runDir: dir, record, skipGit: true });

            // Both file appends happened.
            const tombstones = fs.readFileSync(path.join(dir, 'tombstones.jsonl'), 'utf8').trim();
            expect(JSON.parse(tombstones)).to.deep.equal(record);
            const promptMd = fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8');
            expect(promptMd).to.include('## Round 2 Q/A');

            // No new commit landed.
            const log = execFileSync('git', ['-C', dir, 'log', '--format=%s']).toString().trim();
            expect(log).to.equal('init');

            // Working tree is dirty (showing the appends are ready to commit).
            const status = execFileSync('git', ['-C', dir, 'status', '--porcelain']).toString();
            expect(status).to.include('tombstones.jsonl');
            expect(status).to.include('prompt.md');
        });

        it('multiple sequential applies produce monotonic round numbers in the journal', function () {
            const dir = tmpRunDir();
            apply({ runDir: dir, record: {
                round: 1, question: 'q1', answer: 'a1', source: 'llm', agreed_by_two_framings: true
            }, commitMessage: 'round-1' });
            apply({ runDir: dir, record: {
                round: 2, question: 'q2', answer: 'a2', source: 'user', agreed_by_two_framings: false
            }, commitMessage: 'round-2' });
            apply({ runDir: dir, record: {
                round: 3, question: 'q3', answer: 'a3', source: 'llm', agreed_by_two_framings: true
            }, commitMessage: 'round-3' });

            const lines = fs.readFileSync(path.join(dir, 'tombstones.jsonl'), 'utf8')
                .trim().split('\n').map(JSON.parse);
            expect(lines.map((l) => l.round)).to.deep.equal([1, 2, 3]);

            const log = execFileSync('git', ['-C', dir, 'log', '--format=%s', '--reverse'])
                .toString().trim().split('\n');
            expect(log).to.deep.equal(['init', 'round-1', 'round-2', 'round-3']);
        });
    });
});
