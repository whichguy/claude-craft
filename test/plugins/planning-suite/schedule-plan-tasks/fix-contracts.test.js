// Static-contract regression guards for the 14-item fix set.
//
// Each fix has its own describe block. The tests assert presence/absence of contract
// strings in the SKILL.md / agent / reference markdown — not behavior — and exist to
// prevent silent regressions when prose drifts. Behavioral verification of Q1/Q2/Q3/S1
// lives in the dedicated fixture-driven test files.

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md',
);
const DA_MD = path.join(REPO_ROOT, 'plugins/planning-suite/agents/delivery-agent.md');
const RECAP_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/references/recap-task-template.md',
);
const PROV_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/references/sandbox-provisioner-prompt.md',
);
const SYNTH_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/references/sandbox-provisioner-synthesis-preamble.md',
);

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

describe('Fix-set contracts (static regression guards)', function () {
  describe('Q4 — H2-B trailer contract reverted', function () {
    it('delivery-agent.md no longer documents the "Commit-body failure contract" block', function () {
      expect(read(DA_MD)).to.not.include('Commit-body failure contract');
    });

    it('recap-task-template.md no longer parses RESULT: failed / RESULT: partial trailers', function () {
      const text = read(RECAP_MD);
      // The classification step must not split on the trailer.
      expect(text).to.not.match(/RESULT: failed.*trailer/);
      expect(text).to.not.match(/RESULT: partial.*trailer/);
    });

    it('recap classification routes absent-merge to "no recap data — see investigation TaskCreate"', function () {
      const text = read(RECAP_MD);
      expect(text).to.include('investigation TaskCreate');
      expect(text).to.match(/no recap data/);
    });
  });

  describe('Q5 — single foreground rule', function () {
    it('SKILL.md states the "Foreground exception" once at the top of Phase C', function () {
      const text = read(SKILL_MD);
      const occurrences =
        text.match(/\*\*Foreground exception[^*]*\*\*/g) || [];
      expect(occurrences.length).to.equal(
        1,
        'Foreground exception must be documented exactly once',
      );
    });

    it('SKILL.md does NOT redocument the rule as a step-3c "Single-agent foreground exception (G)" block', function () {
      const text = read(SKILL_MD);
      expect(text).to.not.match(/Single-agent foreground exception \(G\)/);
    });
  });

  describe('Q6 — synthesis preamble explicit override + extracted', function () {
    it('synthesis preamble lives in references/sandbox-provisioner-synthesis-preamble.md', function () {
      expect(fs.existsSync(SYNTH_MD)).to.equal(true);
    });

    it('preamble file contains the explicit OVERRIDES BODY header', function () {
      expect(read(SYNTH_MD)).to.include('SYNTHESIS MODE — OVERRIDES BODY');
    });

    it('SKILL.md no longer inlines the preamble (refers to the extracted file)', function () {
      const text = read(SKILL_MD);
      expect(text).to.include('sandbox-provisioner-synthesis-preamble.md');
    });

    it('sandbox-provisioner-prompt.md points readers at the extracted preamble file', function () {
      expect(read(PROV_MD)).to.include('sandbox-provisioner-synthesis-preamble.md');
    });
  });

  describe('S3 — Phase 0 step 0 rename + .git gate', function () {
    it('Phase 0 step 0 is "workspace pre-flight"', function () {
      expect(read(SKILL_MD)).to.match(/Phase 0 step 0 — workspace pre-flight/);
    });

    it('exclude-file write gated on .git directory existence', function () {
      expect(read(SKILL_MD)).to.include('[ -d "$REPO_ROOT/.git" ]');
    });

    it('old name "ensure directories exist" is gone', function () {
      expect(read(SKILL_MD)).to.not.match(/Phase 0 step 0 — ensure directories exist/);
    });
  });

  describe('S4 — Rule 2 dropped from regression task', function () {
    it('SKILL.md regression task no longer documents a "Rule 2" fallback', function () {
      const text = read(SKILL_MD);
      // Negative match: a "Rule 2:" line in the regression-task "What to do" section.
      // Scope to the regression block to avoid catching unrelated occurrences.
      const startIdx = text.indexOf('## What to do');
      expect(startIdx).to.be.greaterThan(-1);
      const end = text.indexOf('## Trigger table', startIdx);
      const block = text.slice(startIdx, end > 0 ? end : startIdx + 5000);
      expect(block).to.not.match(/^Rule 2:/m);
    });
  });
});
