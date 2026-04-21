# review-fix LINTER_TABLE

Fixed lookup table for Step 1.5 lint pre-flight. Add a row here to support a new language — do not paraphrase this table at runtime, use it verbatim.

## Categories

Two categories determine auto-fix eligibility:
- **Linters** (`fix_category: lint`): Fix semantic issues. Auto-fix enabled by default on installed tools.
- **Formatters** (`fix_category: format`): Rewrite whitespace/style only. Auto-fix opt-in only (requires `.review-fix-autoformat` at worktree root). If not present, formatter runs in check-only mode; output shown in banner, auto-fix suppressed.

## Table

| Language | Config signal                                      | fix_category | Label            | Run cmd                                         | Fix cmd                                              | Binary check / install hint                            |
|----------|----------------------------------------------------|--------------|------------------|-------------------------------------------------|------------------------------------------------------|--------------------------------------------------------|
| JS/TS    | package.json has scripts.lint                      | lint         | npm run lint     | npm run lint -- \<files\>                       | npm run lint:fix -- \<files\> (if script exists)     | node_modules/.bin/ (else: npm install)                 |
| JS/TS    | package.json has scripts.typecheck or type-check   | lint         | npm run \<key\>  | npm run \<key\>                                 | (none — whole project typecheck)                     | node_modules/.bin/ (else: npm install)                 |
| JS/TS    | eslint.config.{js,mjs,cjs,ts} or .eslintrc*        | lint         | eslint           | npx eslint \<files\>                            | npx eslint --fix \<files\>                           | node_modules/.bin/eslint (else: npm i -D eslint)       |
| JS/TS    | biome.json                                         | lint         | biome            | npx biome check \<files\>                       | npx biome check --write \<files\>                    | node_modules/.bin/biome (else: npm i -D @biomejs/biome)|
| JS/TS    | .prettierrc* or prettier in package.json           | format       | prettier         | npx prettier --check \<files\>                  | npx prettier --write \<files\>                       | node_modules/.bin/prettier (else: npm i -D prettier)   |
| Python   | pyproject.toml OR .ruff.toml OR ruff.toml          | lint         | ruff             | ruff check \<py files\>                         | ruff check --fix \<py files\>                        | which ruff (else: pip install ruff)                    |
| Python   | .pylintrc OR setup.cfg [pylint] section            | lint         | pylint           | pylint \<py files\>                             | (none)                                               | which pylint (else: pip install pylint)                |
| Python   | pyproject.toml [tool.black] OR .black.toml         | format       | black            | black --check \<py files\>                      | black \<py files\>                                   | which black (else: pip install black)                  |
| Python   | mypy.ini OR pyproject.toml [tool.mypy]             | lint         | mypy             | mypy \<py files\>                               | (none)                                               | which mypy (else: pip install mypy)                    |
| Ruby     | .rubocop.yml OR .rubocop                           | lint         | rubocop          | rubocop \<rb files\>                            | rubocop -A \<rb files\>                              | which rubocop (else: gem install rubocop)              |
| Shell    | any .sh in file_list OR .shellcheckrc              | lint         | shellcheck       | shellcheck \<sh files\>                         | (none — report only)                                 | which shellcheck (else: brew install shellcheck)       |
| Shell    | any .sh in file_list                               | format       | shfmt            | shfmt -d \<sh files\>                           | shfmt -w \<sh files\>                                | which shfmt (else: brew install shfmt)                 |
| Go       | any .go in file_list                               | format       | gofmt            | gofmt -l \<go files\>                           | gofmt -w \<go files\>                                | which gofmt (ships with Go toolchain)                  |
| Go       | .golangci.yml OR .golangci.yaml                    | lint         | golangci-lint    | golangci-lint run ./...                         | golangci-lint run --fix ./...                        | which golangci-lint (else: brew install golangci-lint) |
| Rust     | Cargo.toml                                         | format       | cargo fmt        | cargo fmt --check -- \<files\>                  | cargo fmt -- \<files\>                               | which cargo (ships with rustup)                        |
| Rust     | Cargo.toml                                         | lint         | cargo clippy     | cargo clippy -- -D warnings                     | (none — whole crate; skip auto-fix)                  | which cargo (ships with rustup)                        |
| Markdown | .markdownlint.json OR .markdownlint.yaml           | lint         | markdownlint     | markdownlint \<md files\>                       | markdownlint --fix \<md files\>                      | which markdownlint (else: npm i -g markdownlint-cli)   |
| YAML     | .yamllint OR .yamllint.yml                         | lint         | yamllint         | yamllint \<yaml files\>                         | (none)                                               | which yamllint (else: pip install yamllint)            |

## Runtime rules

- **Filter to overlapping extensions first.** Only rows whose target extension appears in `file_list` are candidates. Then check the config signal.
- **Scope all run/fix commands to `file_list`**, not project-wide globs. Use `<files>` = space-joined `file_list` members with matching extension. For tools that do not support per-file invocation (e.g. whole-crate `cargo clippy`, whole-project `mypy`), run in check-only mode and skip auto-fix when `explicit_target_files=true`.
- **First match per tool category wins** where categories overlap (e.g. ESLint vs Biome — prefer whichever config file exists; if both exist, warn once and run both).
- **Auto-fix by category:** `lint` tools → auto-apply `fix_cmd` when installed. `format` tools → check-only mode unless `.review-fix-autoformat` exists at worktree root.
- **Install hints are suggestions, not auto-installs.** Missing-binary tools are deferred to the end-of-run Recommendations block — never install silently.
- **Unlisted languages fall through silently.** Step 1.5 skips unrecognized linters without error.
