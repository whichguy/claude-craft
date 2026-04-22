const fixtures = [
    "test/benchmarks/adversarial/fixtures/logic/trap-q1-validation.js",
    "test/benchmarks/adversarial/fixtures/async/trap-q2-async.js",
    "test/benchmarks/adversarial/fixtures/platform/trap-q3-gas-quota.gs",
    "test/benchmarks/adversarial/fixtures/logic/trap-q4-intent.js",
    "test/benchmarks/adversarial/fixtures/ui-ux/trap-react-ui.jsx",
    "test/benchmarks/adversarial/fixtures/platform/trap-gas-quirks.gs",
    "test/benchmarks/adversarial/fixtures/logic/trap-pedantic-idioms.js",
    "test/benchmarks/adversarial/fixtures/async/trap-concurrency.js",
    "test/benchmarks/adversarial/fixtures/logic/trap-data-integrity.ts",
    "test/benchmarks/adversarial/fixtures/logic/trap-resource-leak.js",
    "test/benchmarks/adversarial/fixtures/platform/trap-gas-advanced.gs",
    "test/benchmarks/adversarial/fixtures/logic/trap-type-safety.ts",
    "test/benchmarks/adversarial/fixtures/logic/trap-architectural.js",
    "test/benchmarks/adversarial/fixtures/logic/trap-duplication.js",
    "test/benchmarks/adversarial/fixtures/platform/trap-python-mutable.py",
    "test/benchmarks/adversarial/fixtures/async/trap-go-goroutine.go",
    "test/benchmarks/adversarial/fixtures/logic/bad-node-backend.js",
    "test/benchmarks/adversarial/fixtures/platform/bad-gas-script.gs",
    "test/benchmarks/adversarial/fixtures/platform/bad-python-data.py",
    "test/benchmarks/adversarial/fixtures/ui-ux/bad-html-ui.html",
    "test/benchmarks/adversarial/fixtures/logic/gate-test.js",
    "test/fixtures/linter-test/bad-format.js",
    "test/benchmarks/adversarial/fixtures/logic/related-caller.js",
    "utils/formatters.js",
    "test/fixtures/review-fix/sql-injection.js"
];

const generations = [
    "test/benchmarks/adversarial/prompts/g1.md",
    "test/benchmarks/adversarial/prompts/g2.md",
    "test/benchmarks/adversarial/prompts/g3.md",
    "test/benchmarks/adversarial/prompts/g4.md",
    "test/benchmarks/adversarial/prompts/g5.md",
    "test/benchmarks/adversarial/prompts/g6.md",
    "test/benchmarks/adversarial/prompts/g7.md",
    "test/benchmarks/adversarial/prompts/g8.md",
    "test/benchmarks/adversarial/prompts/g9.md",
    "test/benchmarks/adversarial/prompts/g10.md",
    "test/benchmarks/adversarial/prompts/g11.md",
    "test/benchmarks/adversarial/prompts/g12.md",
    "test/benchmarks/adversarial/prompts/g13.md"
];

module.exports = { fixtures, generations };
