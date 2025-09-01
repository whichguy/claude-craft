# Claude Craft Directory Structure

## Directory Layout

```
claude-craft/
├── agents/                   # AI agent definitions
│   └── code-refactor.md     # Automated code refactoring agent
│
├── commands/                 # Claude Code slash commands
│   ├── code-security.md     # Code security vulnerability analysis
│   ├── craft.md             # Main sync and management command
│   ├── knowledge.md         # Knowledge discovery command
│   ├── memory-security.md   # Memory fragment security scanner
│   ├── performance.md       # Performance analysis command
│   ├── prompts.md           # Prompt template loader
│   ├── review.md            # Code review command
│   └── test.md              # Test generation command
│
├── hooks/                    # Claude Code hook scripts
│   └── scripts/             # Executable hook scripts
│       ├── log-prompts.sh   # Prompt logging hook
│       └── validate-bash.sh # Bash validation hook
│
├── memory/                   # Claude Code memory system
│   ├── fragments/           # Memory fragments to include
│   │   ├── development-principles.md  # Core dev principles
│   │   ├── knowledge-discovery.md     # Knowledge system docs
│   │   ├── project-context.md         # Project information
│   │   └── project-conventions.md     # Coding conventions
│
├── prompts/                  # Reusable prompt templates
│   ├── api-design.md        # API design template
│   ├── debugging.md         # Debugging strategy template
│   └── security-scan.md     # Security analysis prompt
│
├── settings/                 # Claude Code settings fragments
│   └── fragments/           # JSON settings to merge
│       ├── development-settings.json  # Editor settings
│       └── example-hooks.json         # Hook configuration
│
├── test/                     # Test suite
│   ├── fixtures/            # Test data files
│   │   ├── clean-data.md    # Clean test data
│   │   └── sensitive-test-data.md  # Security test data
│   ├── backup.test.js       # Backup/restore tests
│   ├── knowledge.test.js    # Knowledge discovery tests
│   ├── mocha.opts          # Mocha configuration
│   └── security.test.js     # Security scanner tests
│
├── tools/                    # Core utility scripts
│   ├── add-memory.sh        # Memory fragment manager
│   ├── backup.sh            # Backup/restore utility
│   ├── knowledge-sync.sh    # Knowledge discovery sync
│   ├── merge-settings.sh    # Settings merger
│   └── security-scan.sh     # Security scanner
│
├── workflows/                # Development workflows
│   ├── new-feature-workflow.md  # TDD feature workflow
│   └── security-workflow.md     # Security review process
│
├── install.sh               # One-liner installation script
├── run-tests.sh            # Test runner script
├── package.json            # NPM configuration
├── package-lock.json       # NPM dependency lock
└── README.md               # Project documentation
```

## File Categories

### Essential Core Files
- **install.sh** - Required for one-liner installation
- **commands/craft.md** - Main command for syncing and management
- **tools/*.sh** - Core functionality scripts
- **README.md** - User documentation

### Extension Files
- **commands/*.md** - Slash commands (user can add more)
- **memory/fragments/*.md** - Memory extensions (customizable)
- **prompts/*.md** - Prompt templates (expandable)
- **settings/fragments/*.json** - Settings to merge (optional)
- **hooks/scripts/*.sh** - Hook scripts (optional)

### Development Files
- **test/** - Test suite (for maintainers)
- **package*.json** - NPM dependencies (for testing)
- **run-tests.sh** - Test runner (for development)

### Removed Directories
The following reserved directories were removed as unnecessary:
- ~~configs/~~ - No current configuration needs
- ~~memory/includes/~~ - Fragments system is sufficient
- ~~memory/templates/~~ - Not needed with current design
- ~~settings/templates/~~ - Fragments provide all needed functionality
- ~~hooks/settings/~~ - Scripts directory handles all hook needs

## Design Principles

1. **Modular Structure** - Each directory has a specific purpose
2. **Extensible** - Users can add their own commands, prompts, memory
3. **Safe Merging** - Settings and memory use safe merge strategies
4. **Backup First** - All modifications backup existing files
5. **Clear Separation** - Core tools vs user extensions

## File Naming Conventions

- **Commands**: `command-name.md` (lowercase, hyphenated)
- **Scripts**: `script-name.sh` (lowercase, hyphenated)
- **Test Files**: `*.test.js` (matches tested component)
- **Fragments**: `descriptive-name.md/json` (clear purpose)

## Dependencies

### Required (System)
- Bash 4.0+
- Git
- jq (for JSON merging)
- Standard Unix tools (find, grep, sed)

### Optional (Development)
- Node.js 14+ (for testing)
- NPM (for test dependencies)
- Mocha/Chai (test framework)

## Security Considerations

- All memory fragments are scanned before commits
- API keys and secrets trigger security warnings
- Personal information detection for privacy
- Backup system prevents data loss
- Read-only symlinks for safe command sharing