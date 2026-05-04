# PII / personalization audit (Task #15)

Propose-only sweep of the marketplace surface (`plugins/`, `.claude-plugin/marketplace.json`, `README.md`) for content tied to the user (Jim/James Wiese, dadleet, BigDog, jim.wiese@gmail.com), to Fortified Strength Inc (the user's nonprofit), or to specific personal projects (Sheets Chat GAS).

## Summary

| Severity | Count of files | Action |
|---|---|---|
| **HIGH — real org PII** | 7 (all in form990) | Architectural decision: pull profile data out of the skill, OR remove form990 from the public marketplace |
| **MEDIUM — personal project ID embedded** | 5 (gas-suite, slides-suite, review-bench×3) | Replace with placeholder; document where the user supplies their own |
| **LOW — false positives / generic** | n/a | No action |

## HIGH — Fortified Strength / Wiese family PII

The `form990` plugin is **architecturally bound to one specific nonprofit**. Test fixtures and developer notes embed real production data:

| Type | Value | Files |
|---|---|---|
| Org legal name | `Fortified Strength` (and slug `fortified-strength`) | `PHASES.md:2002`, `TOOL-SIGNATURES.md:373` |
| Real EIN | `85-3576252` | `VERIFY.md:622,626,628,711`; `tests/verify.py:1246,1267,1278,1341,1456,1473`; `TOOL-SIGNATURES.md:373` |
| Officer names | `James Wiese` (CEO), `Kelly Wiese` (CFO), with literal `family: "wiese"` | `VERIFY.md:629,634`; `tests/verify.py:1252-1253,1284` |
| Org email | `jim@fortifiedstrength.org` | `VERIFY.md:630`; `tests/verify.py:1258,1289` |
| CA RCT number | `CT0272348` | `VERIFY.md:631`; `tests/verify.py:1255,1294`; `TOOL-SIGNATURES.md:348`; `lib/form990_lib.py:119` |
| Org address | `San Ramon CA 94583` | `LEARNINGS.md:214` |
| Workspace domain | `fortifiedstrength.org` | `LEARNINGS.md:179` |
| Candid profile URL | `https://app.candid.org/profile/9918853/fortified-strength-inc-85-3576252` | `TOOL-SIGNATURES.md:373` |

These are not redacted/synthetic — they are the user's real org records. Some (EIN, CA RCT, Candid profile) are technically public records, but ON THE PUBLIC MARKETPLACE they constitute a clear personal-identifier package.

### Recommended action — pick one

**Option A — Remove form990 from the marketplace (cleanest):**
- The plugin's value is "automate filing for ONE specific small nonprofit." It's not a generalizable template; it's an internal tool that happens to live in this repo.
- Delete the `form990` entry from `.claude-plugin/marketplace.json`.
- Drop the form990 row from `CLAUDE.md` and `README.md`.
- Keep the source under `plugins/form990/` for the user's own use, but don't expose it to others.
- **Pro**: zero generalization work; the data stays where it's already running fine for one user.
- **Con**: any work meant to make form990 a generic template is wasted.

**Option B — Generalize the fixtures (pull profile data out of the skill):**
- Replace all real values in `VERIFY.md`, `tests/verify.py`, `LEARNINGS.md`, `PHASES.md`, `TOOL-SIGNATURES.md`, `lib/form990_lib.py` with a synthetic example org:
  - Org: `Example Charity Inc`, slug `example-charity`
  - EIN: `12-3456789` (already used as the synthetic EIN in some test fixtures — extend that to all)
  - Officers: `Jane Doe` (CEO), `John Doe` (CFO), `family: "doe"`
  - Email: `accounts@example.org`
  - CA RCT: `CT0000000` (or remove altogether — that's CA-specific anyway)
  - Address: drop the literal address from LEARNINGS.md or replace with `City, ST 00000`
  - Candid URL: replace with `https://app.candid.org/profile/00000/example-charity-inc-12-3456789` as documented example
- Real org data lives in a user-supplied profile YAML at `~/.claude/config/form990/profile.yaml` (or similar) — already implied by the `load_profile(fixture)` design pattern.
- **Pro**: form990 becomes a usable template for other small nonprofits.
- **Con**: substantial edit; all references must change in lockstep; risk of missing some.

**Option C — Mothball:** keep the plugin in `plugins/form990/` but exclude it from `marketplace.json`. Half of A, none of B's effort. Probably the right interim if you're undecided.

## MEDIUM — personal GAS scriptId embedded

The "Sheets Chat" GAS project (scriptId `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`) is the user's specific personal project. It appears as a hardcoded default in plugins that other users would install:

| File | Type | Use |
|---|---|---|
| `plugins/gas-suite/skills/gas-sidebar/SKILL.md:32` | const declaration | Default `SCRIPT_ID = "1Y72…"` for sidebar automation |
| `plugins/slides-suite/skills/slides/SKILL.md:491` | doc | "Default target script: SHEETS_CHAT (`1Y72…`)" |
| `plugins/review-bench/fixtures/inputs/input1-gas-plan.md:8` | fixture text | `Project: Sheets Chat (scriptId: 1Y72…)` |
| `plugins/review-bench/fixtures/inputs/input5-gas-ui-plan.md:6` | fixture text | same |
| `plugins/review-bench/fixtures/inputs/input3-trivial-plan.md:9` | fixture text | `SHEETS_CHAT: 1Y72…` |
| `plugins/review-bench/skills/optimize-system-prompt/SKILL.md:32` | doc | Hardcoded ScriptId |
| `plugins/review-bench/skills/improve-system-prompt/SKILL.md:29` | doc | Hardcoded ScriptId |
| `plugins/review-bench/skills/ablate-review-plan/RESULTS.md:226` | results notes | Documents the value as "OLD" but it's the same ID |

### Recommended action

For `gas-sidebar` and `slides-suite`:
- Replace the literal scriptId with a placeholder like `"<your-script-id>"` or `"<set via .clasp.json or env>"`.
- Add a one-paragraph note: "Set this via your project's `.clasp.json` or `MCP__GAS_SCRIPT_ID` env var; no default is shipped." — `mcp-gas-deploy` already supports `.clasp.json` resolution.

For `review-bench` fixtures:
- Replace with a synthetic but well-formed-looking scriptId like `1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`. The bench doesn't make live calls; the value is referenced as a string.

For `review-bench/skills/optimize-system-prompt` and `improve-system-prompt`:
- These two skills **only make sense for the Sheets Chat project**. They're written as if Sheets Chat is the universal target. Same architectural choice as form990: either generalize (point at `<your-system-prompt-file>` configurable target) or remove from marketplace.

## LOW — checked, no action needed

The following hits were initially flagged but are intentional and benign:

- "GUS" / "Salesforce" mentions in `comms/slack-tag` — already documented as **optional** integration with explicit "configure if your org uses…" guidance. Generic technology references in `slides-suite` and `review-bench` are also fine.
- `whichguy` references — these are exclusively GitHub URL components (`github.com/whichguy/...`), which is the legitimate marketplace owner reference, not PII leakage.
- Generic test-fixture emails like `a@b.com`, `test@company.com`, `example@example.org` in `review-bench/fixtures/` — intentional placeholders.
- `merge-worktree.md` example path `/tmp/worktrees/feature-xyz-20250112` — generic.
- "Mark" tokens — false positive (the verb, not a name).
- Personal URL patterns: only `propublica.org`, `citizenaudit.org`, `candid.org`, `apps.irs.gov`, `oag.ca.gov` (form990 lib) and `taxbandits.com`, `tax990.com` (form990 templates). All are public services the form990 skill consults — fine on their own. The hits become PII only when paired with the org-specific ID at the URL endpoint (covered in the HIGH section).

## What to decide

The user should pick a path for each PII tier. Suggested defaults:

1. **HIGH (form990)**: Option C (mothball — remove from marketplace.json but keep source). Cheapest defensible action; keeps the option to either delete or generalize later.
2. **MEDIUM (Sheets Chat scriptId)**: 
   - gas-sidebar + slides-suite: **placeholder** the scriptId; add a one-line "set via .clasp.json/env" note.
   - review-bench fixtures: replace literal with a synthetic-but-well-formed scriptId.
   - review-bench/{optimize,improve}-system-prompt: same Option C as form990 — remove from marketplace, keep source.

Once the user picks, the changes are ~30 minutes of editing concentrated in 8-12 files plus the marketplace.json + 2 README rows.
