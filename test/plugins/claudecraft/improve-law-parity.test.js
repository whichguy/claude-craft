'use strict';

/**
 * Wave 3 — pinned-sentence A↔B parity (S3).
 *
 * Both homes are in-repo after the law-home reshape:
 *   A = plugins/claudecraft/law/improve-loop/**
 *   B = plugins/claudecraft/skills/improve-loop/SKILL.md
 *
 * Asserts load-bearing canonical law strings appear verbatim in BOTH so the
 * ~2.7k-line manual A→B mirror cannot silently drop R7/R8/soft≠seed/until/
 * streak/commit-subject/cap law. package-parity covers B↔M only; this covers A↔B.
 */

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const CC = path.join(REPO, 'plugins/claudecraft');
const LAW_ROOT = path.join(CC, 'law/improve-loop');
const B_SKILL = path.join(CC, 'skills/improve-loop/SKILL.md');

/** Walk all files under dir; join utf8. */
function walkBlob(dir) {
  const out = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) out.push(fs.readFileSync(p, 'utf8'));
    }
  }
  walk(dir);
  return out.join('\n');
}

/**
 * Canonical sentences / tokens that must exist in both A law corpus and B monolith.
 * Prefer exact load-bearing substrings already shared (or surgically mirrored).
 * id is for failure messages only.
 */
const CANONICAL = [
  // R7 — residual×2 sole complete; not “all V pass”
  {
    id: 'R7-not-all-V-complete',
    phrase: 'never “all V pass ⇒ complete” alone',
  },
  {
    id: 'R7-sole-complete-token',
    phrase: 'R7 sole complete',
  },
  // R8 — 3v fail never terminal (shared wording)
  {
    id: 'R8-never-terminal',
    phrase:
      '3v fail is **never** a terminal Status and **never** an L1 exit reason',
  },
  // soft≠seed
  {
    id: 'soft-neq-seed-token',
    phrase: 'soft≠seed',
  },
  {
    id: 'soft-never-alone-blocks-residual',
    phrase: 'never alone blocks residual×2',
  },
  // DEFAULT_UNTIL (continuous host default — residual×2 form)
  {
    id: 'DEFAULT_UNTIL',
    phrase: 'no material P0/P1 for 2 consecutive cycles (green tests)',
  },
  // streak law
  {
    id: 'streak-key',
    phrase: 'consecutive-non-material-cycles',
  },
  {
    id: 'streak-threshold',
    phrase: 'streak ≥ 2',
  },
  // commit-subject grammar (em-dash after N is load-bearing)
  {
    id: 'commit-subject-grammar',
    phrase: 'improve-loop: iteration N — <summary>',
  },
  // cap alignment (Wave 2)
  {
    id: 'MAX_CYCLES-token',
    phrase: 'MAX_CYCLES',
  },
  {
    id: 'max-cycles-default-8',
    phrase: 'default **8**',
  },
  // Fable-B+ validate-fix lint cycle (A definition + B R8 mirror)
  {
    id: 'validate-fix-cycle',
    phrase: 'Validate-fix cycle',
  },
];

describe('claudecraft improve-loop A↔B law phrase parity', function () {
  let aBlob;
  let bBlob;

  before(function () {
    expect(fs.existsSync(LAW_ROOT), 'A law root missing').to.equal(true);
    expect(fs.existsSync(B_SKILL), 'B SKILL.md missing').to.equal(true);
    aBlob = walkBlob(LAW_ROOT);
    bBlob = fs.readFileSync(B_SKILL, 'utf8');
  });

  for (const { id, phrase } of CANONICAL) {
    it(`${id}: present in A law and B monolith`, function () {
      const inA = aBlob.includes(phrase);
      const inB = bBlob.includes(phrase);
      expect(
        inA,
        `missing in A (law/improve-loop/**): ${JSON.stringify(phrase)}`
      ).to.equal(true);
      expect(
        inB,
        `missing in B (skills/improve-loop/SKILL.md): ${JSON.stringify(phrase)}`
      ).to.equal(true);
    });
  }

  it('lists every pin so a deliberate A-only edit is red (registry non-empty)', function () {
    expect(CANONICAL.length).to.be.at.least(6);
    expect(CANONICAL.length).to.be.at.most(15);
  });
});
