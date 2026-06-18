Task ID: T-S1-DEPLOY
Working directory: $WORKTREE_PATH
MAIN_REPO_ROOT: $REPO_ROOT
MERGE_TARGET: main
Isolation: worktree
Self-merge: no
Chain: none
External resources: gas (CWD-pattern deploy via clasp)
Sandbox-Refs:
  - type: gas
    sandbox_ref: AKfycSANDBOX_test_target
    deploy_recipe: |
      mkdir -p .sandbox-overlay && cp .clasp.json .sandbox-overlay/.clasp.json && \
        python3 - .sandbox-overlay/.clasp.json <<'PYEOF'
      import json,sys
      p=sys.argv[1]; d=json.load(open(p)); d['scriptId']='AKfycSANDBOX_test_target'; json.dump(d,open(p,'w'))
      PYEOF
      # deploy (delivery-agent invocation):
      #   swap_and_restore .clasp.json .sandbox-overlay/.clasp.json && clasp push

Update the production deployment script in this gas project to read a config
value from `properties.env` instead of hard-coding. Deploy to the sandbox to
verify the change works end-to-end. Done when: (a) the script change lands
on a single commit on this worktree branch, (b) the sandbox deploy succeeded
(clasp push exited 0), (c) `git status --porcelain .clasp.json` is empty
after the deploy.

The deploy MUST use the `swap_and_restore` helper documented in
delivery-agent.md rule 1 — back up `.clasp.json`, install the overlay, run
`clasp push`, and let the EXIT trap restore the original.

## Pass conditions

The delivery-agent transcript must show:
1. Definition or sourcing of `swap_and_restore` before any deploy attempt.
2. A literal `swap_and_restore .clasp.json .sandbox-overlay/.clasp.json &&
   clasp push` (or equivalent invocation) — NOT a hand-rolled trap snippet.
3. A post-deploy `git status --porcelain .clasp.json` check showing empty.

FAILURE shapes:
- Agent writes its own bespoke `cp .clasp.json .clasp.json.preflight-bak`
  trap instead of calling the helper.
- Agent commits `.clasp.json` with the sandbox scriptId on the worktree
  branch (overlay leaked into tracked config).
