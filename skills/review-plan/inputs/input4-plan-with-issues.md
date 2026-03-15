# Plan: Refactor Sync Engine to Support Remote Repos

## Context
The sync-status.sh engine currently only supports local symlinks. We want to add support for pulling extensions from remote git repositories, enabling team sharing of extensions.

## Steps

1. Add a `--remote` flag to sync-status.sh that accepts a git URL
2. When `--remote` is passed, clone the repo to a temp directory
3. Copy files from the cloned repo to ~/.claude/ directories
4. Maybe add some caching so we don't clone every time
5. Update the TYPES array in shared-types.sh to include a remote_url field
6. Test it manually to make sure it works
7. Push directly to main

## Notes
- Should handle authentication somehow
- Need to think about conflict resolution
- Might need to update install.sh too
