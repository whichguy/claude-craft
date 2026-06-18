// S5: assert SKILL.md Phase 0 contract directly against fixture mappings.
//
// Prior version mirrored the front-matter parser and Layer-2 keyword scan in JS, which
// gave false confidence when SKILL.md drifted from the mirror. This rewrite asserts
// each fixture's expected resolution-row banner text appears verbatim in SKILL.md AND
// confirms the fixture file is the shape Phase 0's parsers would actually scan.

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md',
);
const FIXTURE_DIR = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/fixtures',
);

describe('Phase 0 detection — SKILL.md contract per fixture', function () {
  let skill;
  before(function () {
    skill = fs.readFileSync(SKILL_MD, 'utf8');
  });

  describe('plan11 (Target-System: none) → skip path', function () {
    let fixtureText;
    before(function () {
      fixtureText = fs.readFileSync(
        path.join(FIXTURE_DIR, 'plan11-target-system-none.md'),
        'utf8',
      );
    });

    it('fixture front-matter sets Target-System: none in the first 30 lines', function () {
      const headerLines = fixtureText.split('\n').slice(0, 30).join('\n');
      expect(headerLines).to.match(/^Target-System:\s*none\s*$/m);
    });

    it('SKILL.md resolution table contains the `target-system=none — skipped` action banner', function () {
      expect(skill).to.include('[sandbox] target-system=none — skipped');
      // Resolution-table row predicate is present.
      expect(skill).to.match(/^\|\s*`none`\s*\|[\s\S]*?Skip pre-flight entirely/m);
    });
  });

  describe('plan12 (no Target-System, Salesforce keyword) → fail-fast disambiguation', function () {
    let fixtureText;
    before(function () {
      fixtureText = fs.readFileSync(
        path.join(FIXTURE_DIR, 'plan12-salesforce-ambiguous.md'),
        'utf8',
      );
    });

    it('fixture has NO Target-System / Sandbox-Ref / Source-Ref front-matter', function () {
      const headerLines = fixtureText.split('\n').slice(0, 30).join('\n');
      expect(headerLines).to.not.match(/^Target-System:/m);
      expect(headerLines).to.not.match(/^Sandbox-Ref:/m);
      expect(headerLines).to.not.match(/^Source-Ref:/m);
    });

    it('fixture Context section contains a Salesforce keyword Layer-2 would match', function () {
      const ctxIdx = fixtureText.indexOf('## Context');
      expect(ctxIdx).to.be.greaterThan(-1);
      const ctx = fixtureText.slice(ctxIdx, ctxIdx + 3000).toLowerCase();
      expect(ctx).to.match(/\bsalesforce\b/);
    });

    it('SKILL.md Layer-2 contract documents the salesforce-ambiguous disambiguation', function () {
      expect(skill).to.match(/salesforce-scratch[\s\S]{0,80}salesforce-sandbox-refresh/);
    });
  });

  it('Phase 0 step 0 is renamed "workspace pre-flight" and gates the exclude write on .git existence', function () {
    expect(skill).to.match(/Phase 0 step 0 — workspace pre-flight/);
    expect(skill).to.match(/\[ -d "\$REPO_ROOT\/\.git" \]/);
  });
});
