# UI Designer Test: Command Line Shell Interface

Test the ui-designer subagent with command line interface and terminal UI scenarios.

## Test Parameters
- **target_file**: "src/dashboard.sh" 
- **task_name**: "shell-system-monitor"
- **worktree_dir**: "/tmp/test-worktree-shell"
- **dryrun**: "false"

## Technology Stack Context
Command line shell scripting with terminal-based user interfaces using ncurses, dialog, or plain text.

## Test Setup Requirements

```bash
mkdir -p "/tmp/test-worktree-shell/docs/planning"
mkdir -p "/tmp/test-worktree-shell/src"
mkdir -p "/tmp/test-worktree-shell/tasks/in-progress"

# Create shell-specific task file
cat > "/tmp/test-worktree-shell/tasks/in-progress/shell-system-monitor.md" << 'EOF'
# Shell System Monitor Dashboard

## Description
Create an interactive command-line system monitoring dashboard that displays real-time system metrics with keyboard navigation.

## Acceptance Criteria
- [ ] Display CPU, memory, disk usage in real-time
- [ ] Interactive menu system with keyboard navigation
- [ ] Color-coded status indicators (green/yellow/red)
- [ ] Process list with sorting and filtering options
- [ ] Configuration options via command line arguments
- [ ] Cross-platform compatibility (Linux, macOS, BSD)
- [ ] Clean terminal output with proper cursor management
- [ ] Signal handling for graceful shutdown

## Epic: system-administration
## Story: monitoring-dashboard
## Priority: high
EOF

# Create shell architecture context
cat > "/tmp/test-worktree-shell/docs/planning/phase7-architecture.md" << 'EOF'
# Architecture Decisions

## Command Line Environment
- **Platform**: POSIX-compliant shell scripting
- **UI Framework**: ncurses/dialog for interactive elements, ANSI escape codes for formatting
- **Display System**: Terminal-based with cursor positioning and color support
- **Data Sources**: System commands (ps, df, free, top, iostat)
- **Interactivity**: Keyboard input handling with non-blocking reads

## Technical Constraints
- Must work in minimal environments (no GUI dependencies)
- POSIX compliance for maximum portability
- Efficient terminal updates to prevent flicker
- Signal handling for clean shutdown
- Minimal dependencies (standard Unix tools only)
EOF

# Create shell target users context
cat > "/tmp/test-worktree-shell/docs/planning/phase2-target-users.md" << 'EOF'
# Target Users Analysis

## Primary User Personas
- **System Administrators**: Need quick system health overview
- **DevOps Engineers**: Require monitoring during deployment/troubleshooting
- **Server Operators**: Need lightweight monitoring without GUI overhead

## Environment Requirements
- Terminal width: 80-120 columns minimum
- Color support: 256 colors preferred, 16 colors fallback
- Keyboard: Function keys, arrow keys, standard ASCII
- Platforms: Linux, macOS, BSD systems
- Shell compatibility: bash, zsh, dash
EOF

# Create shell tech research context
cat > "/tmp/test-worktree-shell/docs/planning/phase4-tech-research.md" << 'EOF'
# Technology Research

## Shell UI Technologies
- ncurses library for advanced terminal control
- dialog/whiptail for menu systems
- ANSI escape sequences for colors and positioning
- tput command for portable terminal control
- Standard Unix utilities: awk, sed, grep, ps, df

## Performance Considerations
- Minimize subprocess calls for better performance
- Use built-in shell features where possible
- Efficient screen updates to reduce flicker
- Background data collection with proper buffering
- Signal handling for responsive user interaction
EOF
```

## Expected Agent Call
```bash
ask subagent ui-designer "src/dashboard.sh" "shell-system-monitor" "/tmp/test-worktree-shell" "false"
```

## Expected Outputs to Validate

### 1. Shell-Specific Architecture Decisions
**Expected**: Dynamic recognition of terminal UI constraints
- Framework decision: "ncurses/ANSI" (not web frameworks)
- Styling decision: "Terminal colors and positioning" 
- Interaction patterns: Keyboard-driven navigation
- Platform considerations: POSIX compliance and portability

### 2. Terminal UI Specification
**Expected**: `docs/planning/ui-specs/dashboard.sh-ui-spec.md`
**Should contain**:
- Terminal layout with cursor positioning
- Color scheme using ANSI escape codes
- Keyboard navigation patterns
- Screen refresh strategies
- ASCII art and text-based visual elements
- Responsive design for different terminal sizes

### 3. Shell Implementation Guide
**Should include**:
- Complete shell script structure with functions
- ncurses integration patterns
- Signal handling for clean shutdown
- Cross-platform compatibility code
- Performance optimization techniques
- Data collection and display loops

### 4. Technology Stack Validation
**JSON return data should show**:
```json
{
  "framework": "Shell/ncurses",
  "framework_reason": "Command line environment requires terminal-based UI",
  "styling": "ANSI colors and terminal positioning",
  "styling_reason": "No GUI framework available in shell environment",
  "interaction_model": "keyboard_driven",
  "constraints_detected": [
    "no_gui_dependencies",
    "posix_compliance_required", 
    "terminal_width_constraints",
    "ascii_only_graphics"
  ]
}
```

## Validation Criteria
- [ ] Agent correctly identifies command line environment
- [ ] Framework decision uses terminal-based technologies (ncurses/dialog/ANSI)
- [ ] No web framework recommendations (React/HTML inappropriate)
- [ ] UI specification includes terminal layout patterns
- [ ] Keyboard navigation patterns are documented
- [ ] Cross-platform shell compatibility considered
- [ ] Signal handling and cleanup procedures included
- [ ] Color and ASCII-based visual design patterns

## Success Metrics
- Agent adapts to terminal constraints without GUI assumptions
- Recommends appropriate shell UI libraries (ncurses, dialog)
- Includes comprehensive terminal control patterns
- Documents keyboard interaction models properly
- Addresses cross-platform shell compatibility

## Expected Research Insights
- ncurses best practices for shell applications
- ANSI escape code usage and terminal compatibility
- Shell performance optimization techniques
- Cross-platform POSIX compliance strategies
- Terminal UI design patterns and conventions