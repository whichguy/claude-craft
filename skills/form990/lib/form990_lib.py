"""
form990_lib.py — Form 990 Skill shared library (stdlib-only).

Extracted from SKILL.md prose definitions so that both the skill runtime and
tests/verify.py import the same implementation rather than re-implementing logic
inline.  This is Theme A of the hardening-2 pass; the inline SKILL.md prose is
rewritten to reference functions by symbol name.

Commit ownership:
  A1 — core helpers: now_iso/date, atomic_commit, commit_phase_entry,
        merge_datasets, ARTIFACT_DEPS, verify_ancestors, run_script,
        scrub_pii (basic), append_breadcrumb, auto_append_learning
  A6 — ERROR_CLASSES frozenset + breadcrumb schema extension
        (lands in same commit block as A1 per plan cross-cutting §9)
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
from typing import Any

# ---------------------------------------------------------------------------
# A6 — ERROR_CLASSES enum (frozenset)
# ---------------------------------------------------------------------------

ERROR_CLASSES: frozenset[str] = frozenset({
    "HalfWrite",          # Change 2 + crash recovery orphan path
    "RunningDeadPid",     # crash recovery no-orphan branch
    "AncestorRegression", # verify_ancestors mismatch
    "CasConflict",        # atomic_commit CAS retry exhausted
    "ScriptTimeout",      # run_script deadline exceeded
    "ScriptNonZero",      # run_script non-zero exit
    "PiiLeakSuspected",   # post-scrub defense-in-depth canary
    "SchemaUnknown",      # unknown schema_version on resume
    "ArtifactCycle",      # ARTIFACT_DEPS cycle detected
    "PreImageStale",      # pre_image_sha256 mismatch (dev error)
    "OrphanSweepFailed",  # unlink on staging/tmp raised non-ENOENT
    "WebFetchFailed",     # P9 blank PDF fetch failed after retry
    "PlaybookMissing",    # P6 dispatched to schedule with no playbook
})

# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------

def now_iso() -> str:
    """Return current UTC timestamp as ISO 8601 string."""
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def now_iso_date() -> str:
    """Return current UTC date as YYYY-MM-DD."""
    return datetime.datetime.utcnow().strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# scrub_pii() — PII redaction helper (A1 basic rules; C2 extends this)
# ---------------------------------------------------------------------------

def scrub_pii(text: str, donor_names: list[str] | None = None) -> str:
    """
    Redact PII before writing to plan file breadcrumbs or LEARNINGS.

    Rules applied in order (A1 basic set + C2 phone/email/DOB/addr extensions):
      1.  SSN/ITIN: ddd-dd-dddd → [REDACTED-SSN]
      2.  Bare 9-digit run → [REDACTED-9DIGIT]  (EINs are XX-XXXXXXX, skip)
      3.  Donor names from donor_names list (longest first, word-boundary, ≥4 chars)
      4.  Long numeric run >= 10 digits → [REDACTED-LONGNUM] (bank accts)
      5.  (C2) Phone numbers: ddd[-.]ddd[-.]dddd → [REDACTED-PHONE]
      6.  (C2) Email addresses → [REDACTED-EMAIL]
      7.  (C2) Date of birth MM/DD/YYYY → [REDACTED-DOB]
      8.  (C2) Street address: "<number> <words> <suffix>" → [REDACTED-ADDR], <city>
    """
    if donor_names is None:
        donor_names = []

    # 1. SSN/ITIN (hyphenated) — must come before bare-9 to avoid double-matching
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED-SSN]', text)
    # 2. Bare 9-digit run (not preceded/followed by hyphen — avoids EIN XX-XXXXXXX)
    text = re.sub(r'(?<![-\d])\b\d{9}\b(?![-\d])', '[REDACTED-9DIGIT]', text)

    # 3. Donor names: longest first, word boundary, minimum 4 chars
    for name in sorted(donor_names, key=len, reverse=True):
        if name and len(name) >= 4:
            pattern = r'\b' + re.escape(name) + r'\b'
            text = re.sub(pattern, '[REDACTED-DONOR]', text, flags=re.IGNORECASE)

    # 4. Long numeric run >= 10 digits (bank acct, ITIN without dashes, etc.)
    text = re.sub(r'\d{10,}', '[REDACTED-LONGNUM]', text)

    # 5. (C2) Phone: ddd[-. ]?ddd[-. ]?dddd — covers US formats including dots/spaces
    text = re.sub(
        r'\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b',
        '[REDACTED-PHONE]',
        text,
    )

    # 6. (C2) Email addresses
    text = re.sub(
        r'\b[\w.+\-]+@[\w\-]+\.[\w.\-]+\b',
        '[REDACTED-EMAIL]',
        text,
    )

    # 7. (C2) Date of birth: MM/DD/YYYY or MM/DD/YY
    text = re.sub(
        r'\b\d{1,2}/\d{1,2}/(19|20)\d{2}\b',
        '[REDACTED-DOB]',
        text,
    )

    # 8. (C2) Street address: one or more digits + whitespace + title-cased words +
    #    street suffix. Preserve everything after the comma (city/state).
    #    Pattern: start of string or whitespace, digits, space, words, suffix
    _ADDR_SUFFIXES = (
        r'St|Ave|Rd|Blvd|Ln|Way|Dr|Ct|Pl|Pkwy|Hwy|Cir|Ter|Sq|Loop'
    )
    text = re.sub(
        r'\b\d+\s+(?:[A-Z][a-z]*\s+)+(?:' + _ADDR_SUFFIXES + r')\b\.?',
        '[REDACTED-ADDR]',
        text,
    )

    return text


# ---------------------------------------------------------------------------
# append_breadcrumb() — A6 extended schema with error_class + duration_ms
# ---------------------------------------------------------------------------

def append_breadcrumb(
    state: dict,
    phase: str,
    msg: str,
    error_class: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """
    Write a scrubbed breadcrumb into state["breadcrumbs"].

    A6 extension: supports structured error_class (must be in ERROR_CLASSES)
    and optional duration_ms for phase timing.
    """
    assert error_class is None or error_class in ERROR_CLASSES, (
        f"unknown error_class {error_class!r} — add to ERROR_CLASSES enum first"
    )

    donor_names: list[str] = state.get("key_facts", {}).get("donor_names", [])
    safe_msg = scrub_pii(msg, donor_names)

    entry: dict[str, Any] = {
        "at":    now_iso(),
        "phase": phase,
        "msg":   safe_msg,
    }
    if error_class is not None:
        entry["error_class"] = error_class
    if duration_ms is not None:
        entry["duration_ms"] = duration_ms

    state.setdefault("breadcrumbs", []).append(entry)


# ---------------------------------------------------------------------------
# auto_append_learning() — LEARNINGS.md auto-append on failure
# ---------------------------------------------------------------------------

MACHINE_LEARNINGS_BEGIN = "<!-- BEGIN MACHINE LEARNINGS (auto-appended; do not hand-edit) -->"
MACHINE_LEARNINGS_END   = "<!-- END MACHINE LEARNINGS -->"
MAX_MACHINE_ENTRIES = 100


def _rotate_learnings(
    learnings_path: str,
    entries: list[str],
    text: str,
    begin_idx: int,
    end_idx: int,
) -> None:
    """
    Move oldest entries to LEARNINGS.archive.md when count >= MAX_MACHINE_ENTRIES.
    Keeps the most recent (MAX_MACHINE_ENTRIES - 1) entries in LEARNINGS.md.
    """
    archive_path = pathlib.Path(learnings_path).with_name("LEARNINGS.archive.md")
    overflow = entries[:len(entries) - MAX_MACHINE_ENTRIES + 1]
    kept = entries[len(overflow):]
    archive_header = "# Form 990 Skill — Learnings Archive\n\n"
    archive_text = (
        archive_path.read_text(encoding="utf-8")
        if archive_path.exists()
        else archive_header
    )
    archive_path.write_text(
        archive_text + "\n".join(overflow) + "\n", encoding="utf-8"
    )
    new_inner = "\n".join(kept)
    new_text = (
        text[: begin_idx + len(MACHINE_LEARNINGS_BEGIN)]
        + "\n" + new_inner + "\n"
        + text[end_idx:]
    )
    pathlib.Path(learnings_path).write_text(new_text, encoding="utf-8")


def auto_append_learning(
    learnings_path: str,
    phase_id: str,
    error_class: str,
    message: str,
    donor_names: list[str] | None = None,
) -> None:
    """
    Append a scrubbed failure entry to the MACHINE LEARNINGS section.
    Scrubs BEFORE codepoint-safe truncation (C2 correctness fix: scrub-then-truncate
    so an SSN at chars 195-204 is not split across the truncation boundary).
    Rotates to LEARNINGS.archive.md if count exceeds MAX_MACHINE_ENTRIES.
    """
    # Scrub first, THEN truncate (C2: prevents regex split at truncation boundary)
    scrubbed = scrub_pii(message, donor_names or [])
    safe_msg = _codepoint_safe_tail(scrubbed, 200)

    entry = (
        f"- **{now_iso_date()} - {phase_id} - {error_class}:** "
        f"{safe_msg} _(resolution: pending)_\n"
    )
    text = pathlib.Path(learnings_path).read_text(encoding="utf-8")
    begin_idx = text.find(MACHINE_LEARNINGS_BEGIN)
    end_idx   = text.find(MACHINE_LEARNINGS_END)
    if begin_idx == -1 or end_idx == -1:
        return  # Delimiters missing — do not corrupt file

    inner = text[begin_idx + len(MACHINE_LEARNINGS_BEGIN) : end_idx]
    entries = [e for e in inner.strip().splitlines(keepends=True) if e.strip()]

    if len(entries) >= MAX_MACHINE_ENTRIES:
        _rotate_learnings(learnings_path, entries, text, begin_idx, end_idx)
        text = pathlib.Path(learnings_path).read_text(encoding="utf-8")
        begin_idx = text.find(MACHINE_LEARNINGS_BEGIN)
        end_idx   = text.find(MACHINE_LEARNINGS_END)

    # Preserve existing inner content; append new entry before the END delimiter
    inner_after_rotate = text[begin_idx + len(MACHINE_LEARNINGS_BEGIN) : end_idx]
    new_text = (
        text[: begin_idx + len(MACHINE_LEARNINGS_BEGIN)]
        + inner_after_rotate
        + entry
        + text[end_idx:]
    )
    pathlib.Path(learnings_path).write_text(new_text, encoding="utf-8")


# ---------------------------------------------------------------------------
# atomic_commit() — Content-SHA256 CAS write (Step 7 + C1 fsync chain)
# ---------------------------------------------------------------------------

class ConcurrentModificationError(RuntimeError):
    """Raised when atomic_commit detects a concurrent editor via CAS check."""


def _sha256_file(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_commit(
    state: dict,
    plan_path: str | pathlib.Path,
    pre_image_sha256: str,
    no_sidecar: bool = False,
    max_retries: int = 3,
) -> str:
    """
    Content-SHA256 CAS atomic write of plan file state.

    Protocol (Steps 8a-8g from SKILL.md + C1 fsync chain + C1 retry loop):
      a. pre_image captured by caller before any mutations
      b. Caller has mutated state in memory
      c. Re-read + CAS verify: if disk != pre_image → retry with backoff
         (max_retries attempts; raises ConcurrentModificationError on exhaustion)
      d. Write mutated state to <plan>.tmp.<pid>; fsync(fd); os.replace; fsync(dir)
      e. Sidecar mirror (skipped if no_sidecar); non-fatal on failure
      f. plan_lock updated with current writer identity (informational only)
      g. Temp-file hygiene: unlink temps in finally; sweep orphaned tmps on entry

    Returns: new sha256 of the written plan file (use as next pre_image_sha256).
    """
    plan_path = pathlib.Path(plan_path)
    plan_dir  = plan_path.parent

    # --- (g) sweep orphaned tmp files on entry ---
    _sweep_orphaned_tmps(plan_dir)

    pid = os.getpid()
    tmp_plan = plan_dir / f"{plan_path.name}.tmp.{pid}"

    # Serialize machine state into plan content
    # Plan content is the full file bytes including the JSON block
    new_content = _render_plan_with_state(plan_path, state)
    new_bytes   = new_content.encode("utf-8")

    backoff_s = 1.0
    for attempt in range(max_retries):
        # (c) CAS verify
        if plan_path.exists():
            current_sha = hashlib.sha256(plan_path.read_bytes()).hexdigest()
            if current_sha != pre_image_sha256:
                if attempt < max_retries - 1:
                    # Retry with exponential backoff
                    import time
                    append_breadcrumb(
                        state, "?",
                        f"CAS conflict on attempt {attempt+1} — retrying in {backoff_s:.0f}s",
                        error_class="CasConflict",
                    )
                    time.sleep(backoff_s)
                    backoff_s *= 2.0
                    # Re-read pre_image for next attempt
                    pre_image_sha256 = current_sha
                    continue
                else:
                    raise ConcurrentModificationError(
                        f"concurrent modification detected after {max_retries} retries "
                        f"— another editor touched the plan; reload and retry"
                    )

        # (d) Write to tmp, fsync, replace, fsync dir
        try:
            with open(tmp_plan, "w", encoding="utf-8") as f:
                f.write(new_content)
                f.flush()
                os.fsync(f.fileno())       # C1: fsync file bytes to disk
            os.replace(tmp_plan, plan_path)  # atomic on POSIX
            # C1: fsync parent directory to flush the directory entry
            dir_fd = os.open(str(plan_dir), os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except Exception:
            # (g) cleanup tmp on any abort
            try:
                tmp_plan.unlink(missing_ok=True)
            except OSError:
                pass
            raise

        new_sha = hashlib.sha256(new_bytes).hexdigest()

        # (e) Sidecar mirror (non-fatal)
        if not no_sidecar:
            _write_sidecar(state, plan_path)

        return new_sha

    # Should not reach here (loop always raises or returns)
    raise ConcurrentModificationError("CAS retry loop exhausted without resolving")


def _render_plan_with_state(plan_path: pathlib.Path, state: dict) -> str:
    """
    Replace the fenced JSON block between MACHINE STATE markers with the new
    serialized state. Preserves all other content in the plan file verbatim.
    """
    BEGIN = "<!-- BEGIN MACHINE STATE (do not hand-edit; skill rewrites atomically) -->"
    END   = "<!-- END MACHINE STATE -->"

    text = plan_path.read_text(encoding="utf-8")
    begin_idx = text.find(BEGIN)
    end_idx   = text.find(END)

    if begin_idx == -1 or end_idx == -1:
        raise ValueError(
            f"MACHINE STATE markers not found in {plan_path} — "
            "plan file may be corrupted"
        )

    # Everything after BEGIN marker up to the ``` opening fence, then JSON, then ``` closing fence
    state_json = json.dumps(state, indent=2, sort_keys=False, ensure_ascii=False)
    new_block = f"\n```json\n{state_json}\n```\n"

    # Locate the inner code fence block between BEGIN and END
    inner = text[begin_idx + len(BEGIN) : end_idx]
    # Replace the inner block
    new_text = (
        text[: begin_idx + len(BEGIN)]
        + new_block
        + text[end_idx:]
    )
    return new_text


def _write_sidecar(state: dict, plan_path: pathlib.Path) -> None:
    """Write the sidecar memo cache (~/.claude/.form990-memo-<fy>.json)."""
    fy = state.get("tax_year", "unknown")
    sidecar_path = pathlib.Path.home() / ".claude" / f".form990-memo-{fy}.json"
    pid = os.getpid()
    tmp_sidecar = sidecar_path.with_suffix(f".json.tmp.{pid}")

    sidecar_data = {
        "plan_path":     str(plan_path.resolve()),
        "tax_year":      state.get("tax_year"),
        "current_phase": state.get("current_phase"),
        "key_facts":     state.get("key_facts", {}),
        "artifacts":     state.get("artifacts", {}),
    }
    try:
        with open(tmp_sidecar, "w", encoding="utf-8") as f:
            json.dump(sidecar_data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_sidecar, sidecar_path)
    except Exception:
        try:
            tmp_sidecar.unlink(missing_ok=True)
        except OSError:
            pass
        # Non-fatal: sidecar failure is logged but does not abort the commit


def _sweep_orphaned_tmps(plan_dir: pathlib.Path) -> list[str]:
    """
    Scan plan_dir and ~/.claude/ for orphaned temp files whose PID is not alive.
    Returns list of swept paths for breadcrumb logging.

    Patterns swept:
      - <plan_dir>/*.tmp.<pid>           (plan file temps)
      - ~/.claude/.form990-memo-*.json.tmp.<pid>   (sidecar temps)
      - <plan_dir>/artifacts/**/*.writing.<pid>    (artifact staging — recursive)
      - <plan_dir>/artifacts/**/*.partial.<pid>    (WebFetch partial — recursive)
    """
    swept: list[str] = []
    # Flat patterns (non-recursive): plan dir and sidecar memo dir
    flat_patterns: list[tuple[pathlib.Path, str]] = [
        (plan_dir, "*.tmp.*"),
        (pathlib.Path.home() / ".claude", ".form990-memo-*.json.tmp.*"),
    ]
    # Recursive patterns (rglob): artifact staging/partial per Q-C31 spec (**/*.writing.<pid>)
    rglob_patterns: list[tuple[pathlib.Path, str]] = [
        (plan_dir / "artifacts", "*.writing.*"),
        (plan_dir / "artifacts", "*.partial.*"),
    ]

    def _check_and_sweep(candidate: pathlib.Path) -> None:
        pid_str = candidate.suffix.lstrip(".")
        if pid_str.isdigit():
            pid = int(pid_str)
            if _pid_dead(pid):
                try:
                    candidate.unlink(missing_ok=True)
                    swept.append(str(candidate))
                except OSError:
                    # Log as non-fatal; don't re-raise
                    pass

    for base_dir, glob_pat in flat_patterns:
        if not base_dir.exists():
            continue
        for candidate in base_dir.glob(glob_pat):
            _check_and_sweep(candidate)

    for base_dir, glob_pat in rglob_patterns:
        if not base_dir.exists():
            continue
        for candidate in base_dir.rglob(glob_pat):
            _check_and_sweep(candidate)
    return swept


def _pid_dead(pid: int) -> bool:
    """Return True if pid is not a live process (POSIX only)."""
    try:
        os.kill(pid, 0)
        return False  # No exception → process exists
    except PermissionError:
        return False  # Exists but we can't signal it → alive
    except ProcessLookupError:
        return True   # ESRCH → not alive


# ---------------------------------------------------------------------------
# commit_phase_entry() — Pre-work lifecycle commit (Change 1)
# ---------------------------------------------------------------------------

def commit_phase_entry(
    phase_id: str,
    state: dict,
    plan_path: str | pathlib.Path,
    pre_image_sha256: str,
    no_sidecar: bool = False,
) -> str:
    """
    CAS-write status='running' into machine state before phase work begins.
    Ensures a SIGKILL during Work produces a running+dead-PID state that the
    Step 2 orphan sweep can detect and recover from.

    Returns: new pre_image_sha256 to use for the phase-exit commit.
    """
    state["phase_status"][phase_id] = "running"
    state["plan_lock"] = {
        "pid":         os.getpid(),
        "acquired_at": now_iso(),
        "host":        _hostname(),
        "note":        "informational only — CAS is the concurrency primitive",
    }
    return atomic_commit(state, plan_path, pre_image_sha256, no_sidecar=no_sidecar)


def _hostname() -> str:
    try:
        return os.uname().nodename
    except Exception:
        import socket
        return socket.gethostname()


# ---------------------------------------------------------------------------
# is_plan_lock_stale() — C1 host-check + 24h staleness bound
# ---------------------------------------------------------------------------

_PLAN_LOCK_STALE_HOURS = 24


def is_plan_lock_stale(plan_lock: dict | None) -> bool:
    """
    Return True if plan_lock should be treated as stale, meaning the dispatcher
    should route to crash-recovery rather than treating the phase as concurrently running.

    Staleness criteria (C1):
      1. plan_lock is None or missing pid/acquired_at → stale (nothing to trust)
      2. pid is dead (ESRCH) → stale (crash recovery path)
      3. host != current host AND acquired_at older than 24h → stale
         (avoids PID-reuse false positives across machines / after long suspend)
      4. acquired_at older than 24h regardless of host → stale
         (bounds unbounded "running" state left by a SIGKILL'd process
          even if the PID was later reused by the OS)

    Note: a live pid on the SAME host with acquired_at < 24h ago is NOT stale —
    that is the genuine concurrent-session case that should block.
    """
    if not plan_lock:
        return True

    pid = plan_lock.get("pid")
    acquired_at_str = plan_lock.get("acquired_at")
    host = plan_lock.get("host") or ""

    if pid is None:
        return True

    # Check if acquired_at is older than the staleness threshold
    age_exceeded = False
    if acquired_at_str:
        try:
            acquired_dt = datetime.datetime.strptime(acquired_at_str, "%Y-%m-%dT%H:%M:%SZ")
            age_s = (datetime.datetime.utcnow() - acquired_dt).total_seconds()
            age_exceeded = age_s > _PLAN_LOCK_STALE_HOURS * 3600
        except (ValueError, TypeError):
            age_exceeded = True  # Unparseable → treat as stale
    else:
        age_exceeded = True  # No timestamp → treat as stale

    if age_exceeded:
        return True

    # Check host mismatch — a different host's lock is only trusted if < 24h old
    # (already handled above by age_exceeded). So if we reach here, age < 24h.
    # A different host with recent lock: could be a legitimate concurrent session
    # on another machine. Treat as NOT stale (the CAS will protect against conflicts).
    # A dead PID, however, is always stale regardless of host.
    if _pid_dead(pid):
        return True

    return False


# ---------------------------------------------------------------------------
# ARTIFACT_DEPS — Dependency graph (Change 4)
# ---------------------------------------------------------------------------

ARTIFACT_DEPS: dict[str, dict] = {
    # P2 outputs
    "coa_mapping": {
        "phase": "P2",
        "upstream": [],  # external: Drive budget sheet (verified via input_fingerprint)
    },
    # P3 outputs
    "statement_of_activities": {"phase": "P3", "upstream": ["coa_mapping"]},
    "balance_sheet":           {"phase": "P3", "upstream": ["coa_mapping"]},
    "functional_expense":      {"phase": "P3", "upstream": ["coa_mapping"]},
    # P4 output
    "part_iv_checklist": {
        "phase": "P4",
        "upstream": ["statement_of_activities", "balance_sheet", "functional_expense"],
    },
    # P5 output
    "dataset_core": {
        "phase": "P5",
        "upstream": [
            "coa_mapping", "statement_of_activities", "balance_sheet",
            "functional_expense", "part_iv_checklist",
        ],
    },
    # P6 outputs
    "dataset_schedules": {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_o":        {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_b_filing": {"phase": "P6", "upstream": ["dataset_core"]},
    "schedule_b_public": {"phase": "P6", "upstream": ["dataset_core"]},
    # P7 outputs
    "dataset_rollup":       {"phase": "P7",       "upstream": ["dataset_core"]},
    "reconciliation_report":{"phase": "P7",       "upstream": ["dataset_core"]},
    "dataset_merged":       {"phase": "P7-merge", "upstream": ["dataset_core", "dataset_schedules", "dataset_rollup"]},
    # P8 output
    "cpa_review_report": {
        "phase": "P8",
        "upstream": ["dataset_merged", "reconciliation_report"],
    },
    # P9 outputs
    "reference_pdf": {"phase": "P9", "upstream": ["dataset_merged"]},
    "efile_handoff": {"phase": "P9", "upstream": ["dataset_merged", "cpa_review_report"]},
}


# ---------------------------------------------------------------------------
# verify_ancestors() — Transitive fingerprint verification (Change 4)
# ---------------------------------------------------------------------------

_CYCLE_SENTINEL = object()  # Unique sentinel; identity-checked to detect DAG cycles


def verify_ancestors(
    artifact_name: str,
    state: dict,
    _visited: dict | None = None,
) -> tuple[bool, list[str]]:
    """
    Walk ARTIFACT_DEPS transitively from artifact_name.
    For each ancestor:
      - No output_sha256 in state → regression ("not yet produced")
      - File missing on disk → regression ("file deleted")
      - sha256(disk bytes) != recorded → regression ("hash mismatch")

    Memoizes by artifact_name via _visited to avoid redundant disk reads
    within a single phase entry. (Thread safety: not required — single-threaded.)

    Returns: (ok: bool, regressions: list[str])
    """
    if _visited is None:
        _visited = {}
    if artifact_name in _visited:
        val = _visited[artifact_name]
        if val is _CYCLE_SENTINEL:
            raise RuntimeError(
                f"cycle detected in ARTIFACT_DEPS: artifact '{artifact_name}' "
                f"appears as its own transitive ancestor "
                f"(error_class=ArtifactCycle)"
            )
        return val  # type: ignore[return-value]

    # Cycle detection: mark as in-progress before recursion
    _visited[artifact_name] = _CYCLE_SENTINEL

    deps = ARTIFACT_DEPS.get(artifact_name, {})
    upstream = deps.get("upstream", [])
    regressions: list[str] = []

    for parent in upstream:
        parent_entry = state.get("artifacts", {}).get(parent, {})
        recorded_sha = parent_entry.get("output_sha256")
        artifact_path = parent_entry.get("path")

        if not recorded_sha:
            regressions.append(
                f"{parent}: no output_sha256 recorded "
                f"(produced_in_phase={parent_entry.get('produced_in_phase', '?')}; "
                f"re-run that phase first)"
            )
        elif artifact_path:
            abs_path = pathlib.Path(artifact_path)
            if not abs_path.exists():
                regressions.append(f"{parent}: file missing on disk at {artifact_path}")
            else:
                actual_sha = hashlib.sha256(abs_path.read_bytes()).hexdigest()
                if actual_sha != recorded_sha:
                    regressions.append(
                        f"{parent}: sha256 mismatch "
                        f"(recorded {recorded_sha[:12]}…, disk {actual_sha[:12]}…)"
                    )

        # Recurse into this parent's own ancestors (memoized)
        ok, child_regressions = verify_ancestors(parent, state, _visited)
        regressions.extend(child_regressions)

    result = (len(regressions) == 0, regressions)
    _visited[artifact_name] = result
    return result


# ---------------------------------------------------------------------------
# merge_datasets() — Deterministic disjoint-key merger (Change 5)
# ---------------------------------------------------------------------------

def merge_datasets(
    core_path: str | pathlib.Path,
    schedules_path: str | pathlib.Path,
    rollup_path: str | pathlib.Path,
    output_path: str | pathlib.Path,
) -> str:
    """
    Pure function. Produces form990-dataset.json from three sibling files
    via disjoint-key composition. Halts on key conflict.

    Ownership contract:
      dataset_core      → parts.II..parts.XII + schedule_dependencies
      dataset_rollup    → parts.I + reconciliation
      dataset_schedules → schedules

    Change 5 — positive-ownership assertions added before composition:
      - core.parts.I MUST be null or absent (structural placeholder)
      - rollup.parts.I MUST be populated (not null)
      - rollup.parts MAY only contain "I"
      - schedule_dependencies owned by core only
      - reconciliation owned by rollup only

    Returns: sha256 hex of the serialized merged file.
    """
    with open(core_path, encoding="utf-8")      as f: core      = json.load(f)
    with open(schedules_path, encoding="utf-8") as f: schedules = json.load(f)
    with open(rollup_path, encoding="utf-8")    as f: rollup    = json.load(f)

    merged: dict = {}

    # --- Change 5: Positive-ownership assertions before composition ---
    core_I = core.get("parts", {}).get("I", "__ABSENT__")
    assert core_I in (None, "__ABSENT__"), (
        "merger: dataset_core.parts.I MUST be null or absent (P5 ownership contract)"
    )
    rollup_I = rollup.get("parts", {}).get("I")
    assert rollup_I is not None, (
        "merger: dataset_rollup.parts.I must be populated (not null) — P7 partial-write detected"
    )
    assert set(rollup.get("parts", {}).keys()) <= {"I"}, (
        f"merger: dataset_rollup.parts MAY only contain 'I', "
        f"got {sorted(rollup.get('parts', {}).keys())}"
    )
    assert "schedule_dependencies" not in rollup and "schedule_dependencies" not in schedules, (
        "merger: schedule_dependencies is owned by dataset_core only"
    )
    assert "reconciliation" not in core and "reconciliation" not in schedules, (
        "merger: reconciliation is owned by dataset_rollup only"
    )

    # --- parts from core (II..XII) ---
    for k, v in core.get("parts", {}).items():
        if k == "I" and v is None:
            continue  # structural placeholder; ownership belongs to rollup
        if k in merged.get("parts", {}):
            raise ValueError(f"merger_conflict: parts.{k} appears in both core and another input")
        merged.setdefault("parts", {})[k] = v

    # --- schedule_dependencies from core ---
    if "schedule_dependencies" in core:
        merged["schedule_dependencies"] = core["schedule_dependencies"]

    # --- parts.I + reconciliation from rollup ---
    rollup_parts = rollup.get("parts", {})
    if "I" in rollup_parts:
        if "I" in merged.get("parts", {}):
            raise ValueError(
                "merger_conflict: parts.I appears in both rollup and core (expected null in core)"
            )
        merged.setdefault("parts", {})["I"] = rollup_parts["I"]
    if "reconciliation" in rollup:
        merged["reconciliation"] = rollup["reconciliation"]

    # --- schedules from dataset_schedules ---
    if "schedules" in schedules:
        if "schedules" in merged:
            raise ValueError("merger_conflict: schedules key appears in two inputs")
        merged["schedules"] = schedules["schedules"]

    # Deterministic serialization (sort_keys ensures byte-stability across Python minors)
    serialized = json.dumps(
        merged, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )

    # Write atomically (tmp + replace, not full CAS — output path, not plan path)
    output_path = pathlib.Path(output_path)
    pid = os.getpid()
    tmp_out = output_path.with_suffix(f"{output_path.suffix}.tmp.{pid}")
    try:
        with open(tmp_out, "w", encoding="utf-8") as f:
            f.write(serialized)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_out, output_path)
        dir_fd = os.open(str(output_path.parent), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except Exception:
        try:
            tmp_out.unlink(missing_ok=True)
        except OSError:
            pass
        raise

    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# run_script() — Canonical subprocess runner (Change 3)
# ---------------------------------------------------------------------------

# Allowlist of scripts run_script will invoke (absolute paths, populated at dispatch time).
SCRIPT_ALLOWLIST: set[str] = set()

# Per-phase wall-clock deadlines (Q-C34).
PHASE_DEADLINES_S: dict[str, int] = {
    "P2": 180,
    "P3": 120,
    "P6": 300,
    "gmail_draft": 15,
    "default": 60,
}


def _codepoint_safe_tail(s: str, max_chars: int) -> str:
    """
    Truncate from the right without bisecting a UTF-8 codepoint (Q-C20).
    Python strings are codepoint-indexed — slicing by index is safe.
    """
    if len(s) <= max_chars:
        return s
    return s[-max_chars:]


class ScriptError(Exception):
    """Raised by run_script() on non-zero exit, timeout, or JSON parse failure.

    C2: Raw stderr stored in private _raw_stderr (never serialized/logged).
    Public str(e) and stderr_tail use scrubbed content only.
    """

    def __init__(
        self,
        script: str,
        returncode: int,
        stderr: str,
        stdout: str = "",
    ) -> None:
        # C2: Store raw stderr privately; scrub before exposing publicly.
        # The exception message (str(e)) uses scrubbed content so it is safe
        # to log without an additional scrub pass at the call site.
        self._raw_stderr: str = stderr  # never logged; for internal diagnosis only
        scrubbed_stderr = scrub_pii(_codepoint_safe_tail(stderr, 500))
        super().__init__(f"{script} exit {returncode}: {scrubbed_stderr}")
        self.returncode = returncode
        self.stderr_tail = scrub_pii(_codepoint_safe_tail(stderr, 2000))
        self.stdout_tail = _codepoint_safe_tail(stdout, 2000)
        self.structured_error: dict | None = None


# Public aliases for private helpers (used by tests/verify.py)
sweep_orphaned_tmps = _sweep_orphaned_tmps
pid_dead = _pid_dead


def run_script(
    script_path: str | pathlib.Path,
    args: list,
    phase_id: str | None = None,
    cwd: str | pathlib.Path | None = None,
) -> Any:
    """
    Canonical runner for Programmatic Analysis scripts.

    Contract:
      - argv-only (no shell=True); stdout MUST be pure JSON.
      - script_path MUST be in SCRIPT_ALLOWLIST (absolute path).
      - args reject null-bytes and '..' path-traversal tokens.
      - deadline from PHASE_DEADLINES_S[phase_id] or 'default'.
      - On non-zero exit, inspect stdout for error-JSON; attach as structured_error.
      - On timeout, kill + wait in finally, raise ScriptError.
    Scripts MUST accept --json-only flag (redirects debug prints to stderr).
    """
    abs_path = str(pathlib.Path(script_path).resolve())
    if abs_path not in SCRIPT_ALLOWLIST:
        raise ScriptError(abs_path, -1, f"script not in SCRIPT_ALLOWLIST: {abs_path}")

    for a in args:
        a_str = str(a)
        if "\x00" in a_str:
            raise ScriptError(abs_path, -1, f"rejected arg (null byte): {a!r}")
        if ".." in pathlib.PurePosixPath(a_str).parts:
            raise ScriptError(abs_path, -1, f"rejected arg (path traversal): {a!r}")

    deadline_s = PHASE_DEADLINES_S.get(phase_id or "default", PHASE_DEADLINES_S["default"])

    proc = subprocess.Popen(
        [sys.executable, abs_path, "--json-only", *[str(a) for a in args]],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=cwd,
    )
    try:
        stdout, stderr = proc.communicate(timeout=deadline_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            stdout, stderr = proc.communicate(timeout=5)
        except Exception:
            stdout, stderr = "", "<timeout: no output captured>"
        raise ScriptError(
            abs_path, -2,
            f"timeout after {deadline_s}s\nstderr: {stderr}",
            stdout,
        )
    finally:
        if proc.poll() is None:
            proc.kill()

    if proc.returncode != 0:
        err = ScriptError(abs_path, proc.returncode, stderr, stdout)
        try:
            parsed = json.loads(stdout)
            if isinstance(parsed, dict) and parsed.get("status") == "error":
                err.structured_error = parsed
        except (json.JSONDecodeError, ValueError):
            pass
        raise err

    try:
        return json.loads(stdout)
    except json.JSONDecodeError as e:
        raise ScriptError(
            abs_path, 0,
            f"stdout unparseable: {e}\nstderr tail: {stderr[-500:]}",
            stdout,
        )
