const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('SMALL→FULL state carry', function () {
    const skillPath = path.join(__dirname, '..', 'skills', 'review-plan', 'SKILL.md');
    let skillContent;

    before(function () {
        skillContent = fs.readFileSync(skillPath, 'utf-8');
    });

    it('SKILL.md captures small_pass_verdicts at SMALL→FULL transition', function () {
        expect(skillContent).to.include('small_pass_verdicts');
        expect(skillContent).to.include('seeded_from');
    });

    it('SKILL.md guard fires when small_pass_verdicts is empty (no SMALL PASSes)', function () {
        // Guard text: seeding is a no-op when small_pass_verdicts is empty
        const hasGuard =
            /small_pass_verdicts.*is.*empty|len\(small_pass_verdicts\)|small_pass_verdicts = \{\}/i.test(skillContent);
        expect(hasGuard).to.equal(true);
    });

    it('SKILL.md injects small_pass_verdicts as advisory context in FULL pass 1 only', function () {
        expect(skillContent).to.include('small_seed_context');
        expect(skillContent).to.include('pass_count == 0');
        // Advisory context, not a skip
        expect(skillContent).to.include('do not skip based on this');
    });

    it('seeded Q-IDs are NOT added to memoized_l1_questions (FULL still re-evaluates all)', function () {
        // memoized_l1_questions init should be a plain empty set — not seeded
        const memoInitRegion = skillContent.substring(
            skillContent.indexOf('memoized_l1_questions = set()'),
            skillContent.indexOf('memoized_l1_questions = set()') + 200
        );
        // small_pass_verdicts should NOT appear in this region
        expect(memoInitRegion).to.not.include('small_pass_verdicts');
    });

    it('small_pass_verdicts is initialized in Phase 3c tracking block', function () {
        // Must appear after prev_pass_results init and before Phase 4
        const phase3cEnd = skillContent.indexOf('STATE AT END OF PHASE 3c');
        const prev_pass_idx = skillContent.lastIndexOf('prev_pass_results = {}', phase3cEnd);
        const seedIdx = skillContent.indexOf('small_pass_verdicts', prev_pass_idx);
        expect(seedIdx).to.be.greaterThan(prev_pass_idx);
        expect(seedIdx).to.be.lessThan(phase3cEnd);
    });
});
