const fixtures = [
    "test/fixtures/complex-bad-code/naked/trap-q1-validation.js",
    "test/fixtures/complex-bad-code/naked/trap-q2-async.js",
    "test/fixtures/complex-bad-code/naked/trap-q3-gas-quota.gs",
    "test/fixtures/complex-bad-code/naked/trap-q4-intent.js",
    "test/fixtures/complex-bad-code/naked/trap-react-ui.jsx",
    "test/fixtures/complex-bad-code/naked/trap-gas-quirks.gs",
    "test/fixtures/complex-bad-code/naked/trap-pedantic-idioms.js",
    "test/fixtures/complex-bad-code/naked/trap-concurrency.js",
    "test/fixtures/complex-bad-code/naked/trap-data-integrity.ts",
    "test/fixtures/complex-bad-code/naked/trap-resource-leak.js",
    "test/fixtures/complex-bad-code/naked/trap-gas-advanced.gs",
    "test/fixtures/complex-bad-code/naked/trap-type-safety.ts",
    "test/fixtures/complex-bad-code/naked/trap-architectural.js",
    "test/fixtures/complex-bad-code/naked/trap-duplication.js",
    "test/fixtures/complex-bad-code/naked/trap-python-mutable.py",
    "test/fixtures/complex-bad-code/naked/trap-go-goroutine.go",
    "test/fixtures/bad-code/bad-node-backend.js",
    "test/fixtures/bad-code/bad-gas-script.gs",
    "test/fixtures/bad-code/bad-python-data.py",
    "test/fixtures/bad-code/bad-html-ui.html",
    "test/fixtures/bad-code/gate-test.js",
    "test/fixtures/linter-test/bad-format.js",
    "test/fixtures/complex-bad-code/naked/related-caller.js",
    "utils/formatters.js",
    "test/fixtures/review-fix/sql-injection.js"
];

const generations = [
    "agents/variants/generations/g1.md",
    "agents/variants/generations/g2.md",
    "agents/variants/generations/g3.md",
    "agents/variants/generations/g4.md",
    "agents/variants/generations/g5.md",
    "agents/variants/generations/g6.md",
    "agents/variants/generations/g7.md",
    "agents/variants/generations/g8.md",
    "agents/variants/generations/g9.md",
    "agents/variants/generations/g10.md",
    "agents/variants/generations/g11.md",
    "agents/variants/generations/g12.md",
    "agents/variants/generations/g13.md"
];

module.exports = { fixtures, generations };
