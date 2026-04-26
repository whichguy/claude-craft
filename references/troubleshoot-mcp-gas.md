---
description: "Troubleshooting guide for mcp_gas build failures, auth issues, and common errors"
alwaysApply: false
---

# MCP GAS Troubleshooting Guide

## Build/Restart Required
**Problem**: Changes to tools, schemas, or CommonJS modules not working
**Solution**:
1. `npm run build`
2. Restart Claude Code (changes don't hot-reload)

## Module Updates Not Appearing in GAS
**Problem**: Updated CommonJS infrastructure files not syncing
**Solution**: Update template files in `mcp_gas` repository, rebuild, then update GAS project

## Git Changes Not Being Committed
**Problem**: Write operations not creating commits (this is expected behavior)
**Solution**: Write tools do NOT auto-commit. You must explicitly commit:
1. After writes, call `git_feature({operation: 'commit', scriptId, message: '...'})`
2. Check response for `git.blocked: true` - this means uncommitted changes exist
3. Verify git repo exists at `~/gas-repos/project-{scriptId}/`
4. Check server startup logs for uncommitted changes from previous sessions

## Authentication Tokens Not Persisting
**Problem**: Server requires re-authentication after every restart
**Solution**:
1. Verify token storage location: `ls -la ~/.auth/mcp-gas/tokens/`
2. Check file permissions: should be 0600 (owner-only)
3. If tokens exist but still prompting: Check server startup logs for token loading errors
4. Manual token clear if needed: `rm -rf ~/.auth/mcp-gas/tokens/`

### Token Persistence Details
**Token Storage:** `~/.auth/mcp-gas/tokens/{email}.json` — persists across server restarts
**Key Features:** Auto-persistence | auto-refresh | cross-session sharing | 0600 permissions | 30-day cleanup
**Workflow:** First use → OAuth flow → token cached | Server restart → auto-loaded | Token expiry → auto-refresh
**Manual Clear:** `rm -rf ~/.auth/mcp-gas/tokens/`

## Integration Tests Failing
**Problem**: Tests fail with authentication errors
**Solution**:
1. First run triggers OAuth flow automatically
2. Tokens cached at `~/.auth/mcp-gas/tokens/` for future runs
3. Set `MCP_TEST_MODE=true` to preserve tokens during testing

## "Cannot find module" Errors
**Problem**: TypeScript imports not resolving
**Solution**:
1. Ensure `.js` extensions on all imports (ESM requirement)
2. Check `tsconfig.json` module resolution settings
3. Rebuild: `npm run clean && npm run build`
