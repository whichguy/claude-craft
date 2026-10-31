const { expect } = require('chai');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Policy for .github/ as tests, so it holds without Docker and on every OS leg and in the
// pre-push hook. actionlint + zizmor (job "Workflow lint" in ci.yml) remain the thorough
// check; these pin the decisions this repo made on purpose:
//   - actions are pinned to commit SHAs (a moved tag cannot change what we run)
//   - tokens are read-only and credentials are not persisted into the checkout
//   - CI is one required "gate" job that cannot silently miss a new job
//   - required legs use pinned runner labels; floating labels live in the scheduled canary only

const REPO_ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');
const load = (f) => yaml.load(fs.readFileSync(f, 'utf8'));
const workflowFiles = fs.readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f)).map((f) => path.join(WORKFLOW_DIR, f));
const rel = (f) => path.relative(REPO_ROOT, f);

function steps(wf) {
    return Object.entries(wf.jobs).flatMap(([id, job]) => (job.steps || []).map((s) => ({ job: id, step: s })));
}

describe('.github/workflows policy', function () {
    it('has workflows to check', function () {
        expect(workflowFiles.length).to.be.greaterThan(0);
    });

    workflowFiles.forEach((file) => {
        const wf = load(file);
        const name = rel(file);

        describe(name, function () {
            it('pins every action to a full commit SHA (or an image digest), with a version comment', function () {
                const text = fs.readFileSync(file, 'utf8');
                const lines = text.split('\n').filter((l) => /^\s*(-\s+)?uses:/.test(l));
                lines.forEach((l) => {
                    const ref = l.replace(/^\s*(-\s+)?uses:\s*/, '').split(/\s+#/)[0].trim();
                    if (ref.startsWith('./')) return;
                    const pinned = /@[0-9a-f]{40}$/.test(ref) || /^docker:\/\/.+@sha256:[0-9a-f]{64}$/.test(ref);
                    expect(pinned, `${name}: not SHA/digest pinned: ${ref}`).to.equal(true);
                    expect(l, `${name}: add a "# vX.Y.Z" comment so Dependabot/humans can read the pin: ${ref}`).to.match(/#\s*v?\d/);
                });
            });

            it('declares top-level permissions and never grants write-all', function () {
                expect(wf, `${name}: missing top-level permissions`).to.have.property('permissions');
                const all = [wf.permissions].concat(Object.values(wf.jobs).map((j) => j.permissions));
                all.forEach((p) => expect(p).to.not.equal('write-all'));
            });

            it('gives every job a timeout of at most an hour (GitHub defaults to six)', function () {
                Object.entries(wf.jobs).forEach(([id, job]) => {
                    expect(job['timeout-minutes'], `${name}: job ${id} has no timeout-minutes`).to.be.a('number');
                    expect(job['timeout-minutes']).to.be.at.most(60);
                });
            });

            it('does not use pull_request_target (it runs untrusted PR code with a privileged token)', function () {
                const on = wf.on || wf[true] || {};
                expect(Object.keys(on)).to.not.include('pull_request_target');
            });

            it('does not persist checkout credentials', function () {
                steps(wf).filter((s) => /^actions\/checkout@/.test(s.step.uses || '')).forEach((s) => {
                    expect(s.step.with && s.step.with['persist-credentials'], `${name}: ${s.job} checkout`).to.equal(false);
                });
            });

            it('never interpolates event/input data into a shell script (injection)', function () {
                steps(wf).filter((s) => s.step.run).forEach((s) => {
                    const exprs = s.step.run.match(/\$\{\{[^}]*\}\}/g) || [];
                    exprs.forEach((e) => expect(e, `${name}: ${s.job} run: block`).to.not.match(/github\.event|github\.head_ref|inputs\./));
                });
            });
        });
    });

    describe('ci.yml', function () {
        const wf = load(path.join(WORKFLOW_DIR, 'ci.yml'));

        it('has a gate job that waits for every other job and runs even when they fail', function () {
            const gate = wf.jobs.gate;
            expect(gate, 'ci.yml needs a job with id "gate"').to.be.an('object');
            const others = Object.keys(wf.jobs).filter((j) => j !== 'gate').sort();
            expect([].concat(gate.needs).sort(), 'a job was added without adding it to gate.needs').to.deep.equal(others);
            expect(String(gate.if)).to.match(/always\(\)/);
        });

        it('never cancels in-progress runs on main (every commit gets a verdict)', function () {
            expect(wf.concurrency['cancel-in-progress']).to.not.equal(true);
            expect(String(wf.concurrency['cancel-in-progress'])).to.match(/pull_request/);
        });

        it('uses pinned runner labels for every gating job', function () {
            const labels = [];
            Object.values(wf.jobs).forEach((job) => {
                labels.push(job['runs-on']);
                const m = job.strategy && job.strategy.matrix;
                if (m && m.os) labels.push(...m.os);
                if (m && m.include) m.include.forEach((i) => i.os && labels.push(i.os));
            });
            labels.filter((l) => !String(l).includes('${{')).forEach((l) => expect(l, 'floating label in a gating job').to.not.match(/-latest$/));
        });

        it('exercises the node floor declared in package.json engines', function () {
            const pkg = require('../../package.json');
            const floor = parseInt(String(pkg.engines.node).replace(/[^0-9]/g, ''), 10);
            const nodes = wf.jobs.test.strategy.matrix.include.map((i) => i.node);
            expect(Math.min(...nodes)).to.equal(floor);
        });

        it('runs every test shard on every OS (a shard dropped from one OS would silently lose coverage there)', function () {
            const ciSh = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'ci.sh'), 'utf8');
            const all = ciSh.match(/^SHARDS="([^"]+)"/m)[1].split(/\s+/).sort();
            const byOs = {};
            wf.jobs.test.strategy.matrix.include.forEach((leg) => {
                byOs[leg.os] = byOs[leg.os] || new Set();
                leg.shards.split(/\s+/).forEach((s) => byOs[leg.os].add(s));
            });
            Object.keys(byOs).forEach((os) => expect([...byOs[os]].sort(), `shards run on ${os}`).to.deep.equal(all));
        });

        it('gives every upload-artifact a name that is unique per matrix leg (duplicates fail the upload)', function () {
            steps(wf).filter((s) => /^actions\/upload-artifact@/.test(s.step.uses || '')).forEach((s) => {
                if (s.job === 'test') expect(s.step.with.name).to.include('strategy.job-index');
            });
        });

        it('runs tools/ci.sh, so local and remote checks cannot drift', function () {
            const runs = steps(wf).map((s) => s.step.run || '').join('\n');
            expect(runs).to.match(/tools\/ci\.sh static/);
            expect(runs).to.match(/tools\/ci\.sh test/);
        });
    });

    describe('dependabot.yml', function () {
        const cfg = load(path.join(REPO_ROOT, '.github', 'dependabot.yml'));
        it('covers actions and npm, each with a cooldown', function () {
            ['github-actions', 'npm'].forEach((eco) => {
                const u = cfg.updates.find((x) => x['package-ecosystem'] === eco);
                expect(u, `dependabot is missing ${eco}`).to.be.an('object');
                expect(u.cooldown['default-days']).to.be.at.least(7);
            });
        });
    });
});

describe('npm install reproducibility', function () {
    const pkg = require('../../package.json');

    it('tracks package-lock.json (CI uses `npm ci`)', function () {
        const tracked = execFileSync('git', ['-C', REPO_ROOT, 'ls-files', 'package-lock.json'], { encoding: 'utf8' }).trim();
        expect(tracked, 'package-lock.json is not tracked by git').to.equal('package-lock.json');
        expect(fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8')).to.not.match(/^package-lock\.json$/m);
    });

    it('keeps the lockfile in sync with package.json (what `npm ci` would reject)', function () {
        const lock = require('../../package-lock.json');
        const root = lock.packages[''];
        expect(root.devDependencies).to.deep.equal(pkg.devDependencies);
        expect(root.dependencies || {}).to.deep.equal(pkg.dependencies || {});
    });

    it('splits mocha into core + claudecraft shards that together cover every test exactly once', function () {
        expect(pkg.scripts['test:core']).to.include("--ignore 'test/plugins/claudecraft/**'");
        expect(pkg.scripts['test:improve-loop']).to.include("'test/plugins/claudecraft/**/*.test.js'");
    });
});
