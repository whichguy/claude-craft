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
    "HalfWrite",              # Change 2 + crash recovery orphan path
    "RunningDeadPid",         # crash recovery no-orphan branch
    "AncestorRegression",     # verify_ancestors mismatch
    "CasConflict",            # atomic_commit CAS retry exhausted
    "ScriptTimeout",          # run_script deadline exceeded
    "ScriptNonZero",          # run_script non-zero exit
    "PiiLeakSuspected",       # post-scrub defense-in-depth canary
    "SchemaUnknown",          # unknown schema_version on resume
    "ArtifactCycle",          # ARTIFACT_DEPS cycle detected
    "PreImageStale",          # pre_image_sha256 mismatch (dev error)
    "OrphanSweepFailed",      # unlink on staging/tmp raised non-ENOENT
    "WebFetchFailed",         # P9 blank PDF fetch failed after retry
    "PlaybookMissing",        # P6 dispatched to schedule with no playbook
    # Phase 2 — fetch helper error classes (raise-on-failure contract)
    "IRSXMLUnavailable",      # IRS e-file XML fetch failed after retry
    "CitizenAuditUnavailable", # CitizenAudit fetch or parse failed
    "PDFExtractionFailed",    # pypdf AcroForm field extraction failed
    # Phase 1 — profile + ladder additions
    "TEOSUnavailable",        # IRS TEOS fetch failed after retry
    "ProPublicaUnavailable",  # ProPublica fetch failed after retry
    "StateAGUnavailable",     # State AG charity registry fetch failed
    "KeychainLocked",         # macOS Keychain locked
    "KeychainPermissionDenied", # Keychain permission denied
    "KeychainMissingEntry",   # Credential not found in Keychain or env
    "PortalAuthFailed",       # Candid/Benevity login rejected
    "PortalAntiBot",          # Anti-bot interception detected
    "PortalNetwork",          # Portal network error
    "PortalSchemaDrift",      # Portal page layout changed; extraction failed
    "PortalCleanup",          # chrome-devtools close_page failed
    "OrgAccountBoundary",     # Org-account Drive read via GAS bridge failed
    "LegacyNoProfile",        # In-flight plan lacks profile_path (migration path)
})

# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------

def now_iso() -> str:
    """Return current UTC timestamp as ISO 8601 string."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def now_iso_date() -> str:
    """Return current UTC date as YYYY-MM-DD."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# scrub_pii() — PII redaction helper (A1 basic rules; C2 extends this)
# ---------------------------------------------------------------------------

def scrub_pii(
    text: str,
    donor_names: list[str] | None = None,
    officer_names: list[str] | None = None,
    ca_sos_entity_ids: list[str] | None = None,
) -> str:
    """
    Redact PII before writing to plan file breadcrumbs or LEARNINGS.

    Rules applied in order (A1 basic + C2 extensions + Phase-1 profile-sourced PII):
      1.  SSN/ITIN: ddd-dd-dddd → [REDACTED-SSN]
      2.  EIN: dd-ddddddd → [REDACTED-EIN]              (Phase 1: profile-sourced)
      3.  CA RCT number: CTddddddd → [REDACTED-CA-RCT]  (Phase 1: profile-sourced)
      4.  Bare 9-digit run → [REDACTED-9DIGIT]
      5.  Officer names list (longest first, word-boundary, ≥4 chars) → [REDACTED-OFFICER]
      6.  CA SOS entity ID list → [REDACTED-CA-SOS]
      7.  Donor names list (longest first, word-boundary, ≥4 chars) → [REDACTED-DONOR]
      8.  Long numeric run >= 10 digits → [REDACTED-LONGNUM] (bank accts)
      9.  (C2) Phone numbers: ddd[-.]ddd[-.]dddd → [REDACTED-PHONE]
      10. (C2) Email addresses → [REDACTED-EMAIL]  (covers portal account_hints)
      11. (C2) Date of birth MM/DD/YYYY → [REDACTED-DOB]
      12. (C2) Street address: "<number> <words> <suffix>" → [REDACTED-ADDR]
    """
    if donor_names is None:
        donor_names = []
    if officer_names is None:
        officer_names = []
    if ca_sos_entity_ids is None:
        ca_sos_entity_ids = []

    # 1. SSN/ITIN (hyphenated) — must come before EIN and bare-9
    text = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED-SSN]', text)
    # 2. EIN (XX-XXXXXXX) — must come before bare-9 (bare-9 would miss hyphen)
    text = re.sub(r'\b\d{2}-\d{7}\b', '[REDACTED-EIN]', text)
    # 3. CA RCT registration number (CT + 7 digits, e.g. CT0272348)
    text = re.sub(r'\bCT\d{7}\b', '[REDACTED-CA-RCT]', text)
    # 4. Bare 9-digit run (EINs already caught above)
    text = re.sub(r'(?<![-\d])\b\d{9}\b(?![-\d])', '[REDACTED-9DIGIT]', text)

    # 5. Officer names: longest first, word boundary, minimum 4 chars
    for name in sorted(officer_names, key=len, reverse=True):
        if name and len(name) >= 4:
            text = re.sub(r'\b' + re.escape(name) + r'\b', '[REDACTED-OFFICER]', text, flags=re.IGNORECASE)

    # 6. CA SOS entity IDs
    for entity_id in sorted(ca_sos_entity_ids, key=len, reverse=True):
        if entity_id and len(str(entity_id)) >= 4:
            text = re.sub(r'\b' + re.escape(str(entity_id)) + r'\b', '[REDACTED-CA-SOS]', text, flags=re.IGNORECASE)

    # 7. Donor names: longest first, word boundary, minimum 4 chars
    for name in sorted(donor_names, key=len, reverse=True):
        if name and len(name) >= 4:
            pattern = r'\b' + re.escape(name) + r'\b'
            text = re.sub(pattern, '[REDACTED-DONOR]', text, flags=re.IGNORECASE)

    # 8. Long numeric run >= 10 digits (bank acct, ITIN without dashes, etc.)
    text = re.sub(r'\d{10,}', '[REDACTED-LONGNUM]', text)

    # 9. (C2) Phone: ddd[-. ]?ddd[-. ]?dddd — covers US formats including dots/spaces
    text = re.sub(r'\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b', '[REDACTED-PHONE]', text)

    # 10. (C2) Email addresses (also covers portal_credentials.*.account_hint)
    text = re.sub(r'\b[\w.+\-]+@[\w\-]+\.[\w.\-]+\b', '[REDACTED-EMAIL]', text)

    # 11. (C2) Date of birth: MM/DD/YYYY or MM/DD/YY
    text = re.sub(r'\b\d{1,2}/\d{1,2}/(19|20)\d{2}\b', '[REDACTED-DOB]', text)

    # 12. (C2) Street address: digits + words + suffix
    _ADDR_SUFFIXES = r'St|Ave|Rd|Blvd|Ln|Way|Dr|Ct|Pl|Pkwy|Hwy|Cir|Ter|Sq|Loop'
    text = re.sub(
        r'\b\d+\s+(?:[A-Za-z]+\.?\s+)+(?:' + _ADDR_SUFFIXES + r')\b\.?',
        '[REDACTED-ADDR]',
        text,
        flags=re.IGNORECASE,
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

    key_facts = state.get("key_facts", {})
    donor_names: list[str] = key_facts.get("donor_names", [])
    officers = key_facts.get("people", {}).get("officers", []) if isinstance(key_facts.get("people"), dict) else []
    officer_names = [o.get("name") for o in officers if isinstance(o, dict) and o.get("name")]
    reg = key_facts.get("registrations", {})
    ca_sos_ids = [reg["ca_sos_entity_id"]] if isinstance(reg, dict) and reg.get("ca_sos_entity_id") else []
    safe_msg = scrub_pii(msg, donor_names=donor_names, officer_names=officer_names, ca_sos_entity_ids=ca_sos_ids)

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
        archive_text + f"\n--- Rotation batch {now_iso_date()} ---\n\n"
        + "\n".join(overflow) + "\n",
        encoding="utf-8",
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
    if begin_idx == -1 or end_idx == -1 or begin_idx >= end_idx:
        return  # Delimiters missing or reversed — do not corrupt file

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

    if begin_idx == -1 or end_idx == -1 or begin_idx >= end_idx:
        raise ValueError(
            f"MACHINE STATE markers invalid in {plan_path} — "
            f"begin_idx={begin_idx}, end_idx={end_idx}"
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
            acquired_dt = datetime.datetime.strptime(acquired_at_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
            age_s = (datetime.datetime.now(datetime.timezone.utc) - acquired_dt).total_seconds()
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
_SCRIPT_ALLOWLIST: set[str] = set()

def register_script(path: str) -> None:
    """Add a script to the allowlist. Resolves to absolute path; rejects '..' traversal."""
    abs_path = str(pathlib.Path(path).resolve())
    if ".." in pathlib.PurePosixPath(abs_path).parts:
        raise ValueError(f"rejected script path (traversal): {abs_path}")
    _SCRIPT_ALLOWLIST.add(abs_path)

def is_script_allowed(path: str) -> bool:
    return str(pathlib.Path(path).resolve()) in _SCRIPT_ALLOWLIST

SCRIPT_ALLOWLIST = _SCRIPT_ALLOWLIST  # backward compat

# Per-phase wall-clock deadlines (Q-C34).
PHASE_DEADLINES_S: dict[str, int] = {
    "P2": 180,
    "P3": 120,
    "P6": 300,
    "gmail_draft": 15,
    "default": 60,
    # Phase 1/2/3 — profile + ladder additions
    "p0_public_lookup_s": 15,   # each of 3 parallel fetches (TEOS, ProPublica, CA RCT), 1 retry
    "p1_gas_bridge_s": 20,      # Tier-2 GAS bridge DriveApp call
    "p1_portal_auth_s": 45,     # Tier-3 full flow: navigate(15) + fill(7) + snapshot(15) + parse(5) + buffer(3)
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
    if not is_script_allowed(abs_path):
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


# ---------------------------------------------------------------------------
# Secret — PII-safe credential wrapper (Phase 1)
# ---------------------------------------------------------------------------

class PiiLeakSuspected(ValueError):
    """Raised when a Secret value reaches a serialization boundary."""


class Secret:
    """
    Wraps a sensitive value. __repr__/__str__ always return '***'.
    JSON serializer raises PiiLeakSuspected if a Secret instance is encountered.
    Use Secret.reveal() only at trust boundaries (e.g. passing to subprocess argv).
    """

    def __init__(self, value: str | bytes | None) -> None:
        self._value = value

    def __repr__(self) -> str:
        return "***"

    def __str__(self) -> str:
        return "***"

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Secret):
            return self._value == other._value
        return NotImplemented

    def reveal(self) -> str | bytes | None:
        """Expose the raw value — call only at trust boundaries."""
        return self._value

    @staticmethod
    def _json_default(obj: object) -> object:
        if isinstance(obj, Secret):
            raise PiiLeakSuspected(
                "Secret value encountered in JSON serializer — "
                "credentials must never reach breadcrumbs or LEARNINGS"
            )
        raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


# ---------------------------------------------------------------------------
# Keychain exception classes (Phase 1)
# ---------------------------------------------------------------------------

class KeychainLocked(RuntimeError):
    """macOS Keychain is locked — unlock first (error_class=KeychainLocked)."""


class KeychainPermissionDenied(RuntimeError):
    """Keychain permission denied — check entitlements (error_class=KeychainPermissionDenied)."""


class KeychainMissingEntry(RuntimeError):
    """Credential not found in Keychain or env var (error_class=KeychainMissingEntry)."""


# ---------------------------------------------------------------------------
# Fetch exception classes (Phase 2 helpers — declared here for ERROR_CLASSES
# consistency; implementations land in Phase 2)
# ---------------------------------------------------------------------------

class TEOSUnavailable(RuntimeError):
    """IRS TEOS fetch failed after retry (error_class=TEOSUnavailable)."""


class ProPublicaUnavailable(RuntimeError):
    """ProPublica Nonprofit Explorer fetch failed (error_class=ProPublicaUnavailable)."""


class StateAGUnavailable(RuntimeError):
    """State AG charity registry fetch failed (error_class=StateAGUnavailable)."""


# ---------------------------------------------------------------------------
# Portal credential helpers (Phase 1)
# ---------------------------------------------------------------------------

_PORTAL_CRED_ALLOWLIST: frozenset[str] = frozenset({
    "form990-candid",
    "form990-benevity",
})


def get_portal_creds(service: str) -> "Secret":
    """
    Retrieve portal credentials from macOS Keychain or env var fallback.

    service MUST be in _PORTAL_CRED_ALLOWLIST — validated before any shell call.
    Returns Secret wrapping the password; Secret.__repr__ → '***' (never logged).

    Darwin: calls `security find-generic-password -s <service> -w` with shell=False.
    Non-Darwin: reads $FORM990_<SERVICE>_PW (e.g. $FORM990_CANDID_PW).

    Error classes:
      KeychainLocked           — Keychain locked (exit 36)
      KeychainPermissionDenied — permission denied (exit 44)
      KeychainMissingEntry     — not found (silent on non-Darwin env-var path)
    """
    if service not in _PORTAL_CRED_ALLOWLIST:
        raise ValueError(
            f"service {service!r} not in portal credential allowlist "
            f"{sorted(_PORTAL_CRED_ALLOWLIST)} — TC34 guards this path"
        )
    if sys.platform == "darwin":
        return _get_creds_keychain(service)
    return _get_creds_env(service)


def _get_creds_keychain(service: str) -> "Secret":
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", service, "-w"],
            capture_output=True,
            text=True,
            shell=False,  # TC34: must never be shell=True
            timeout=10,
        )
    except FileNotFoundError:
        raise KeychainMissingEntry(f"security binary not found for service {service!r}")

    if result.returncode == 0:
        return Secret(result.stdout.strip())
    elif result.returncode == 36:
        raise KeychainLocked(f"Keychain locked for service {service!r}")
    elif result.returncode == 44:
        raise KeychainPermissionDenied(f"Keychain permission denied for service {service!r}")
    else:
        raise KeychainMissingEntry(
            f"Credential not found for service {service!r} (exit {result.returncode})"
        )


def _get_creds_env(service: str) -> "Secret":
    env_suffix = service.replace("form990-", "").replace("-", "_").upper()
    env_key = f"FORM990_{env_suffix}_PW"
    val = os.environ.get(env_key)
    if val is None:
        raise KeychainMissingEntry(
            f"Credential not found for service {service!r}: "
            f"set ${env_key} or add to macOS Keychain (error_class=KeychainMissingEntry)"
        )
    return Secret(val)


# ---------------------------------------------------------------------------
# Profile YAML frontmatter parser (stdlib-only, Phase 1)
# ---------------------------------------------------------------------------

def _yaml_scalar(s: str) -> Any:
    """Parse a YAML scalar string into a Python value."""
    s = s.strip()
    # Strip inline comment
    if "#" in s and not (s.startswith('"') or s.startswith("'")):
        s = s[: s.index("#")].strip()
    # Strip surrounding quotes
    if len(s) >= 2 and s[0] in ('"', "'") and s[-1] == s[0]:
        return s[1:-1]
    if s in ("null", "~", ""):
        return None
    if s == "true":
        return True
    if s == "false":
        return False
    try:
        return int(s)
    except ValueError:
        pass
    return s


def _yaml_split_csv(s: str) -> list[str]:
    """Split s on commas respecting quoted strings."""
    parts: list[str] = []
    buf: list[str] = []
    in_quote: str | None = None
    for ch in s:
        if in_quote:
            buf.append(ch)
            if ch == in_quote:
                in_quote = None
        elif ch in ('"', "'"):
            in_quote = ch
            buf.append(ch)
        elif ch == ",":
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf))
    return parts


def _yaml_inline_obj(s: str) -> dict:
    """Parse YAML inline object: { key: val, key: "val", key: null }"""
    s = s.strip()
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1]
    result: dict = {}
    for part in _yaml_split_csv(s):
        part = part.strip()
        if not part:
            continue
        colon_idx = part.find(":")
        if colon_idx == -1:
            continue
        key = part[:colon_idx].strip()
        val = _yaml_scalar(part[colon_idx + 1 :])
        result[key] = val
    return result


def _yaml_inline_list(s: str) -> list:
    """Parse YAML inline list: ["a", "b", "c"] or [a, b]"""
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    return [_yaml_scalar(p.strip()) for p in _yaml_split_csv(s) if p.strip()]


def _yaml_parse_block(lines: list[str], indent: int = 0) -> dict | list | None:
    """Parse indented YAML lines at given base indent into dict or list."""
    # Determine if this is a list block
    non_empty = [l for l in lines if l.strip() and not l.strip().startswith("#")]
    if not non_empty:
        return None
    first_content = non_empty[0].lstrip()
    if first_content.startswith("- "):
        return _yaml_parse_list_block(lines, indent)

    result: dict = {}
    i = 0
    while i < len(lines):
        raw = lines[i].rstrip()
        if not raw.strip() or raw.strip().startswith("#"):
            i += 1
            continue
        line_indent = len(raw) - len(raw.lstrip())
        if line_indent < indent:
            break
        if line_indent > indent:
            i += 1
            continue
        content = raw[indent:]
        m = re.match(r'^([\w][\w_-]*):\s*(.*?)(?:\s*#.*)?$', content)
        if not m:
            i += 1
            continue
        key = m.group(1)
        val_raw = m.group(2).strip()
        if val_raw == "" or val_raw == "{}":
            # Nested block — collect child lines
            child_lines: list[str] = []
            j = i + 1
            while j < len(lines):
                child = lines[j].rstrip()
                if not child.strip():
                    child_lines.append("")
                    j += 1
                    continue
                child_indent = len(child) - len(child.lstrip())
                if child_indent <= indent:
                    break
                child_lines.append(child)
                j += 1
            result[key] = _yaml_parse_block(child_lines, indent + 2) if child_lines else None
            i = j
        elif val_raw.startswith("{"):
            result[key] = _yaml_inline_obj(val_raw)
            i += 1
        elif val_raw.startswith("["):
            result[key] = _yaml_inline_list(val_raw)
            i += 1
        else:
            result[key] = _yaml_scalar(val_raw)
            i += 1
    return result


def _yaml_parse_list_block(lines: list[str], indent: int = 0) -> list:
    """Parse a YAML list block (lines starting with '- ') at given indent."""
    items: list = []
    for raw in lines:
        stripped = raw.rstrip()
        if not stripped.strip() or stripped.strip().startswith("#"):
            continue
        line_indent = len(stripped) - len(stripped.lstrip())
        if line_indent < indent:
            break
        content = stripped[indent:].lstrip()
        if content.startswith("- "):
            item_content = content[2:].strip()
            if item_content.startswith("{"):
                items.append(_yaml_inline_obj(item_content))
            elif item_content.startswith("["):
                items.append(_yaml_inline_list(item_content))
            else:
                items.append(_yaml_scalar(item_content))
    return items


def _parse_profile_frontmatter(text: str) -> dict:
    """Extract and parse the YAML frontmatter block from a profile markdown file."""
    lines = text.splitlines()
    delim_idx = [i for i, l in enumerate(lines) if l.strip() == "---"]
    if len(delim_idx) < 2:
        raise ValueError("Profile missing YAML frontmatter (need two '---' lines)")
    yaml_lines = lines[delim_idx[0] + 1 : delim_idx[1]]
    result = _yaml_parse_block(yaml_lines, 0)
    return result if isinstance(result, dict) else {}


# ---------------------------------------------------------------------------
# Company profile loader + validator (Phase 1)
# ---------------------------------------------------------------------------

_PROFILE_KNOWN_KEYS: frozenset[str] = frozenset({
    "schema", "org_slug", "legal_name", "ein", "formation_state", "formation_date",
    "fiscal_year_end", "accounting_method", "public_charity_basis", "form_variant_hint",
    "addresses", "auth_accounts", "known_resources", "registrations", "providers",
    "people", "portal_credentials",
})

_PROFILE_DIR: pathlib.Path = pathlib.Path.home() / ".claude" / "form990"


def _validate_slug(slug: str) -> None:
    """Validate org_slug matches ^[a-z0-9][a-z0-9-]*$ (rejects path traversal)."""
    if not re.match(r"^[a-z0-9][a-z0-9-]*$", str(slug)):
        raise ValueError(
            f"org_slug {slug!r} must match ^[a-z0-9][a-z0-9-]*$ "
            "(only lowercase alphanumeric and hyphens allowed — rejects path traversal)"
        )


def load_profile(path: str) -> dict:
    """
    Load and validate a company profile from ~/.claude/form990/<slug>.md (or direct path).

    Resolution order for `path` argument:
      - Bare slug (no '/' or '~'): validate slug → open ~/.claude/form990/<slug>.md
      - Otherwise: treat as direct path; validate no '..' traversal in resolved path

    Returns dict with:
      profile_path, profile_sha256, org_slug, and all frontmatter fields merged flat.
      Key 'profile_raw' holds the full parsed frontmatter dict for downstream use.

    Raises ValueError on: unknown frontmatter keys (with stderr warning), bad EIN/slug/
    state/date format, missing schema:1 version field.
    Raises FileNotFoundError if the resolved file does not exist.
    """
    path_str = str(path)

    # Resolve to absolute path
    if "/" not in path_str and not path_str.startswith("~"):
        # Bare slug — validate BEFORE opening any file
        _validate_slug(path_str)
        path_obj = _PROFILE_DIR / f"{path_str}.md"
    else:
        path_obj = pathlib.Path(path_str).expanduser().resolve()
        # Reject path traversal
        if ".." in path_obj.parts:
            raise ValueError(f"Path traversal rejected in profile path: {path!r}")
        # Verify resolved path stays within ~/.claude/form990/ for slug-like names
        # (direct absolute paths are allowed as long as they don't traverse)

    if not path_obj.exists():
        raise FileNotFoundError(f"Profile not found: {path_obj}")

    text = path_obj.read_text(encoding="utf-8")
    raw = _parse_profile_frontmatter(text)

    # schema version required
    if raw.get("schema") != 1:
        raise ValueError(
            f"Profile requires 'schema: 1' frontmatter field (got {raw.get('schema')!r})"
        )

    # Unknown key check — warn + drop (prevents typos like ein_number silently merging)
    for key in list(raw.keys()):
        if key not in _PROFILE_KNOWN_KEYS:
            print(f"[load_profile] warning key={key!r} — unknown frontmatter key, ignoring", file=sys.stderr)
            del raw[key]

    # Validate specific fields
    ein = raw.get("ein")
    if ein is not None and not re.match(r"^\d{2}-\d{7}$", str(ein)):
        raise ValueError(f"Profile ein must match XX-XXXXXXX format, got {ein!r}")

    org_slug = raw.get("org_slug")
    if org_slug is not None:
        _validate_slug(str(org_slug))

    formation_state = raw.get("formation_state")
    if formation_state is not None and not re.match(r"^[A-Z]{2}$", str(formation_state)):
        raise ValueError(f"Profile formation_state must be 2-letter ISO code, got {formation_state!r}")

    fiscal_year_end = raw.get("fiscal_year_end")
    if fiscal_year_end is not None and not re.match(r"^\d{2}-\d{2}$", str(fiscal_year_end)):
        raise ValueError(f"Profile fiscal_year_end must match MM-DD format, got {fiscal_year_end!r}")

    formation_date = raw.get("formation_date")
    if formation_date is not None:
        try:
            datetime.date.fromisoformat(str(formation_date))
        except (ValueError, TypeError):
            raise ValueError(f"Profile formation_date must be ISO-8601 date, got {formation_date!r}")

    # Validate address state fields
    for addr_key in ("principal", "mailing"):
        addr = (raw.get("addresses") or {}).get(addr_key) or {}
        if isinstance(addr, dict) and addr.get("state"):
            if not re.match(r"^[A-Z]{2}$", str(addr["state"])):
                raise ValueError(
                    f"Profile addresses.{addr_key}.state must be 2-letter ISO code"
                )

    # Build result
    result: dict = {
        "profile_path": str(path_obj),
        "profile_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "org_slug": org_slug,
        "profile_raw": raw,
    }

    # Merge frontmatter fields into result for key_facts integration
    for key in (
        "ein", "legal_name", "accounting_method", "public_charity_basis",
        "fiscal_year_end", "formation_state", "formation_date", "form_variant_hint",
        "auth_accounts", "known_resources", "registrations", "providers",
        "people", "portal_credentials", "addresses",
    ):
        val = raw.get(key)
        if val is not None:
            result[key] = val

    return result


# ---------------------------------------------------------------------------
# Startup validation (module-level, runs at import time)
# ---------------------------------------------------------------------------

def _startup_validate() -> None:
    """Validate PHASE_DEADLINES_S entries are positive ints; check $FORM990_PROFILE."""
    for key, val in PHASE_DEADLINES_S.items():
        if not isinstance(val, int) or val <= 0:
            raise ValueError(
                f"PHASE_DEADLINES_S[{key!r}] must be a positive int, got {val!r}"
            )
    profile_env = os.environ.get("FORM990_PROFILE")
    if profile_env and not pathlib.Path(profile_env).expanduser().exists():
        raise FileNotFoundError(
            f"$FORM990_PROFILE={profile_env!r} points to a non-existent file — "
            "fix the path or unset the variable (do not fall through to resolution step 3)"
        )


_startup_validate()


# ---------------------------------------------------------------------------
# Phase 2 — Public fetch helpers (stdlib + urllib only)
# ---------------------------------------------------------------------------

import csv as _csv
import io as _io
import struct as _struct
import urllib.request as _urllib_request
import xml.etree.ElementTree as _ET

# IRS e-file XML base URL (Spike S0: apps.irs.gov replaces defunct S3 bucket)
_IRS_XML_BASE = "https://apps.irs.gov/pub/epostcard/990/xml"

# Per-source request timeouts (seconds)
_IRS_XML_INDEX_TIMEOUT = 60   # index CSV download (10-50MB)
_IRS_XML_RANGE_TIMEOUT = 30   # HTTP Range request for ZIP partial
_PROPUBLICA_TIMEOUT    = 20
_TEOS_TIMEOUT          = 15
_STATE_AG_TIMEOUT      = 15


def _urllib_get(url: str, timeout: int, headers: dict | None = None) -> bytes:
    """Simple urllib GET; raises on non-200."""
    req = _urllib_request.Request(url, headers=headers or {
        "User-Agent": "form990-skill/2.0 (nonprofit tax prep)"
    })
    with _urllib_request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _urllib_range(url: str, start: int, end: int, timeout: int) -> bytes:
    """HTTP Range request; returns the byte slice [start, end] inclusive."""
    req = _urllib_request.Request(url, headers={
        "User-Agent": "form990-skill/2.0",
        "Range": f"bytes={start}-{end}",
    })
    with _urllib_request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _urllib_head_size(url: str, timeout: int) -> int:
    """HTTP HEAD; returns Content-Length as int (0 if unavailable)."""
    req = _urllib_request.Request(url, method="HEAD", headers={"User-Agent": "form990-skill/2.0"})
    with _urllib_request.urlopen(req, timeout=timeout) as resp:
        return int(resp.headers.get("Content-Length", 0))


def _zip_range_extract(zip_url: str, target_name: str) -> bytes:
    """
    Extract a single file from a remote ZIP using HTTP Range requests.
    Avoids downloading the full archive (100MB+) by reading only the
    ZIP central directory and the target file's compressed bytes.
    """
    total_size = _urllib_head_size(zip_url, _IRS_XML_RANGE_TIMEOUT)
    if total_size == 0:
        raise IRSXMLUnavailable(f"Cannot determine ZIP size for {zip_url}")

    # Read last 65KB — contains EOCD record + most central directory entries
    tail_size = min(65536, total_size)
    tail = _urllib_range(zip_url, total_size - tail_size, total_size - 1, _IRS_XML_RANGE_TIMEOUT)

    # Find End-of-Central-Directory signature
    eocd_pos = tail.rfind(b"PK\x05\x06")
    if eocd_pos == -1:
        raise IRSXMLUnavailable(f"ZIP EOCD not found in tail of {zip_url}")
    eocd = tail[eocd_pos:]
    if len(eocd) < 22:
        raise IRSXMLUnavailable("ZIP EOCD record too short")

    cd_size   = _struct.unpack_from("<I", eocd, 12)[0]
    cd_offset = _struct.unpack_from("<I", eocd, 16)[0]

    # Download central directory
    cd_bytes = _urllib_range(zip_url, cd_offset, cd_offset + cd_size - 1, _IRS_XML_RANGE_TIMEOUT)

    # Scan central directory for target file
    local_file_offset: int | None = None
    compressed_size:   int | None = None
    compress_method:   int = 8  # assume deflate default
    pos = 0
    while pos < len(cd_bytes) - 4:
        if cd_bytes[pos:pos+4] != b"PK\x01\x02":
            pos += 1
            continue
        comp_meth    = _struct.unpack_from("<H", cd_bytes, pos + 10)[0]
        comp_sz      = _struct.unpack_from("<I", cd_bytes, pos + 20)[0]
        fname_len    = _struct.unpack_from("<H", cd_bytes, pos + 28)[0]
        extra_len    = _struct.unpack_from("<H", cd_bytes, pos + 30)[0]
        comment_len  = _struct.unpack_from("<H", cd_bytes, pos + 32)[0]
        local_offset = _struct.unpack_from("<I", cd_bytes, pos + 42)[0]
        fname = cd_bytes[pos+46 : pos+46+fname_len].decode("utf-8", errors="replace")
        if fname == target_name or fname.endswith("/" + target_name):
            local_file_offset = local_offset
            compressed_size   = comp_sz
            compress_method   = comp_meth
            break
        pos += 46 + fname_len + extra_len + comment_len

    if local_file_offset is None:
        raise IRSXMLUnavailable(f"File {target_name!r} not found in ZIP central directory")

    # Read local file header to find actual data offset
    lfh = _urllib_range(zip_url, local_file_offset, local_file_offset + 29, _IRS_XML_RANGE_TIMEOUT)
    lfh_fname_len = _struct.unpack_from("<H", lfh, 26)[0]
    lfh_extra_len = _struct.unpack_from("<H", lfh, 28)[0]
    data_offset   = local_file_offset + 30 + lfh_fname_len + lfh_extra_len

    # Fetch compressed file data
    compressed = _urllib_range(zip_url, data_offset, data_offset + compressed_size - 1, _IRS_XML_RANGE_TIMEOUT)

    if compress_method == 0:   # stored (no compression)
        return compressed
    elif compress_method == 8:  # deflate
        import zlib as _zlib
        return _zlib.decompress(compressed, -15)
    else:
        raise IRSXMLUnavailable(f"Unsupported ZIP compression method {compress_method}")


def _parse_irs990_xml(xml_bytes: bytes) -> dict:
    """Parse IRS 990/990-EZ XML bytes into structured dict."""
    root = _ET.fromstring(xml_bytes)

    form_el   = None
    form_type = None
    for ns in ("", "{http://www.irs.gov/efile}"):
        for tag in ("IRS990", "IRS990EZ"):
            el = root.find(f".//{ns}{tag}")
            if el is not None:
                form_el   = el
                form_type = tag
                break
        if form_el is not None:
            break

    if form_el is None:
        raise IRSXMLUnavailable("No IRS990/IRS990EZ element found in XML")

    def _val(*tags) -> float | None:
        for tag in tags:
            for ns in ("", "{http://www.irs.gov/efile}"):
                child = form_el.find(f"{ns}{tag}")
                if child is not None and child.text:
                    try:
                        return float(child.text.strip())
                    except (ValueError, AttributeError):
                        pass
        return None

    # Tax period from ReturnHeader
    tax_period_str = None
    for ns in ("", "{http://www.irs.gov/efile}"):
        hdr = root.find(f".//{ns}ReturnHeader")
        if hdr is not None:
            tp = hdr.find(f"{ns}TaxPeriodEndDt")
            if tp is not None and tp.text:
                tax_period_str = tp.text.strip()
                break

    tax_year = None
    if tax_period_str and len(tax_period_str) >= 4:
        try:
            tax_year = int(tax_period_str[:4])
        except ValueError:
            pass

    if form_type == "IRS990":
        return {
            "year":           tax_year,
            "form_type":      "990",
            "total_revenue":  _val("CYTotalRevenueAmt"),
            "contributions":  _val("CYContributionsGrantsAmt"),
            "total_expenses": _val("TotalFunctionalExpensesAmt"),
            "eoy_net_assets": _val("NetAssetOrFundBalancesEOYAmt"),
            "boy_net_assets": _val("NetAssetOrFundBalancesBOYAmt"),
            "source":         "irs_xml",
        }
    else:
        return {
            "year":           tax_year,
            "form_type":      "990-EZ",
            "total_revenue":  _val("TotalRevenueAmt"),
            "contributions":  _val("ContributionsGiftsGrantsEtcAmt"),
            "total_expenses": _val("TotalExpensesAmt"),
            "eoy_net_assets": _val("NetAssetsOrFundBalancesEOYAmt"),
            "boy_net_assets": _val("NetAssetsOrFundBalancesBOYAmt"),
            "source":         "irs_xml",
        }


class IRSXMLUnavailable(RuntimeError):
    """IRS e-file XML fetch failed (error_class=IRSXMLUnavailable)."""


class CitizenAuditUnavailable(RuntimeError):
    """CitizenAudit fetch or parse failed (error_class=CitizenAuditUnavailable)."""


class PDFExtractionFailed(RuntimeError):
    """pypdf AcroForm field extraction failed (error_class=PDFExtractionFailed)."""


def fetch_irs_xml(ein_nodash: str, filing_year: int) -> "list[dict]":
    """
    Fetch IRS e-file 990 XML for an EIN across calendar years
    (filing_year-1)..(filing_year+1).

    Uses HTTP Range approach: downloads only ZIP central directory + target
    file bytes — avoids full ~100MB archive download.

    Returns list[dict] with keys: year, form_type, total_revenue,
    contributions, total_expenses, eoy_net_assets, boy_net_assets,
    source="irs_xml", object_id.
    Raises IRSXMLUnavailable if all years fail.
    """
    results: list[dict] = []
    errors:  list[str]  = []

    for cal_year in range(filing_year - 1, filing_year + 2):
        index_url = f"{_IRS_XML_BASE}/{cal_year}/index_{cal_year}.csv"
        try:
            raw = _urllib_get(index_url, _IRS_XML_INDEX_TIMEOUT)
            reader = _csv.DictReader(_io.StringIO(raw.decode("utf-8", errors="replace")))
            for row in reader:
                row_ein = row.get("EIN", "").replace("-", "").strip()
                if row_ein != ein_nodash:
                    continue
                object_id  = row.get("OBJECT_ID", row.get("ObjectId", "")).strip()
                batch_file = row.get("BATCH_FILE", "").strip()
                if not object_id:
                    continue

                # Build ZIP URL from batch filename or derive from YYYYMM prefix
                if batch_file:
                    zip_url = f"{_IRS_XML_BASE}/{cal_year}/{batch_file}"
                else:
                    ym = object_id[:6] if len(object_id) >= 6 else ""
                    yr, mo = ym[:4], ym[4:6].zfill(2)
                    zip_url = f"{_IRS_XML_BASE}/{yr}/{yr}_TEOS_XML_{mo}A.zip"

                try:
                    xml_bytes = _zip_range_extract(zip_url, f"{object_id}_public.xml")
                    parsed = _parse_irs990_xml(xml_bytes)
                    parsed["object_id"] = object_id
                    results.append(parsed)
                except Exception as e:
                    errors.append(f"{object_id}: {e}")

        except Exception as e:
            errors.append(f"index {cal_year}: {e}")

    if not results and errors:
        raise IRSXMLUnavailable(
            f"IRS XML failed for EIN {ein_nodash}: " + "; ".join(errors[:3])
        )
    return results


def fetch_propublica(ein_nodash: str) -> dict:
    """
    Fetch ProPublica Nonprofit Explorer API.

    Returns {"filings": [{year, pdf_url, total_revenue, total_expenses,
    eoy_net_assets, source:"propublica"}, ...]}.
    Raises ProPublicaUnavailable on failure.
    """
    url = f"https://projects.propublica.org/nonprofits/api/v2/organizations/{ein_nodash}.json"
    try:
        raw = _urllib_get(url, _PROPUBLICA_TIMEOUT)
        data = json.loads(raw)
    except Exception as e:
        raise ProPublicaUnavailable(f"ProPublica failed for {ein_nodash}: {e}") from e

    filings = []
    for f in data.get("filings_with_data", []):
        filings.append({
            "year":           f.get("tax_prd_yr"),
            "pdf_url":        f.get("pdf_url"),
            "total_revenue":  f.get("totrevenue"),
            "total_expenses": f.get("totfuncexpns"),
            "eoy_net_assets": f.get("totnetassetend"),
            "source":         "propublica",
        })
    return {"filings": filings}


def fetch_teos(ein: str) -> dict:
    """
    Scrape IRS TEOS web UI for exempt status and last-return metadata.

    Raises TEOSUnavailable on HTTP error, CAPTCHA, or empty response.
    """
    ein_nd = ein.replace("-", "")
    url = (
        "https://apps.irs.gov/app/eos/detailsPage"
        f"?ein={ein_nd}&country=US&deductibility=all"
        "&dispatchMethod=displayGeneral"
        f"&ID={ein_nd}"
    )
    try:
        raw = _urllib_get(url, _TEOS_TIMEOUT)
    except Exception as e:
        raise TEOSUnavailable(f"TEOS fetch failed for {ein}: {e}") from e

    html = raw.decode("utf-8", errors="replace")
    if "captcha" in html.lower() or len(html) < 200:
        raise TEOSUnavailable(f"TEOS returned captcha/short response for {ein}")

    import re as _re_t
    def _x(pat: str) -> str | None:
        m = _re_t.search(pat, html, _re_t.IGNORECASE | _re_t.DOTALL)
        return m.group(1).strip() if m else None

    yr = _x(r'Tax\s+Period[^>]*>\s*([0-9]{4})')
    return {
        "exempt_status":               _x(r'Exemption\s+Type[^>]*>\s*([^<]+)'),
        "last_return_year":            int(yr) if yr and yr.isdigit() else None,
        "last_return_form":            _x(r'Form\s+(990\S*)'),
        "determination_letter_status": _x(r'Determination\s+Letter[^>]*>\s*([^<]+)'),
        "source":                      "teos",
    }


def fetch_ca_rct(rct_number: str) -> dict:
    """
    Scrape CA DOJ RCT charity registry for registration status.

    Raises StateAGUnavailable on failure.
    """
    url = f"https://rct.doj.ca.gov/Verification/Web/Search.aspx?Id={rct_number}"
    try:
        raw = _urllib_get(url, _STATE_AG_TIMEOUT)
    except Exception as e:
        raise StateAGUnavailable(f"CA AG fetch failed for {rct_number}: {e}") from e

    html = raw.decode("utf-8", errors="replace")
    if len(html) < 200:
        raise StateAGUnavailable(f"CA AG returned empty response for {rct_number}")

    import re as _re_c
    def _x(pat: str) -> str | None:
        m = _re_c.search(pat, html, _re_c.IGNORECASE | _re_c.DOTALL)
        return m.group(1).strip() if m else None

    yr = _x(r'Renewal\s+Due\s+Date[^>]*>\s*([0-9]{4})')
    return {
        "registration_status": _x(r'Registration\s+Status[^>]*>\s*([^<]+)'),
        "last_rrf1_year":      int(yr) if yr and yr.isdigit() else None,
        "source":              "ca_ag",
    }


def fetch_citizenaudit_pdfs(ein: str) -> "list[dict]":
    """
    Fetch CitizenAudit.org 990 PDF listings for an EIN.
    Rate: ≤0.5 QPS (sequential, 2s sleep between PDF fetches).
    Raises CitizenAuditUnavailable on failure.
    """
    import re as _re_ca
    import time as _time

    ein_nodash = ein.replace("-", "")
    url = f"https://www.citizenaudit.org/organization/{ein_nodash}/"
    try:
        raw = _urllib_get(url, _STATE_AG_TIMEOUT)
    except Exception as e:
        raise CitizenAuditUnavailable(f"CitizenAudit failed for {ein}: {e}") from e

    html = raw.decode("utf-8", errors="replace")
    pdf_links = _re_ca.findall(r'href="([^"]+\.pdf)"', html, _re_ca.IGNORECASE)

    results: list[dict] = []
    for pdf_url in pdf_links[:10]:
        if not pdf_url.startswith("http"):
            pdf_url = "https://www.citizenaudit.org" + pdf_url
        year_m = _re_ca.search(r"(20[12]\d)", pdf_url)
        results.append({
            "year":    int(year_m.group(1)) if year_m else None,
            "pdf_url": pdf_url,
            "source":  "citizenaudit",
        })
        _time.sleep(2.0)   # ≤0.5 QPS
    return results


def fetch_pdf_line_items(pdf_path: str) -> dict:
    """
    Extract Part I Lines 8/12/22 from a 990 PDF using pypdf AcroForm.

    Cached by PDF sha256 (function-level dict).
    Raises PDFExtractionFailed if pypdf unavailable or extraction fails.

    IMPORTANT: AcroForm field keys below are placeholders derived from
    f990-field-map-2025.json structure. Implementer must Read that file
    and replace these keys with the confirmed XFA full-path keys before shipping.
    """
    cache: dict = getattr(fetch_pdf_line_items, "_sha_cache", {})
    fetch_pdf_line_items._sha_cache = cache  # type: ignore[attr-defined]

    pdf_bytes = pathlib.Path(pdf_path).read_bytes()
    key = hashlib.sha256(pdf_bytes).hexdigest()
    if key in cache:
        return cache[key]

    try:
        import pypdf as _pypdf  # type: ignore[import]
    except ImportError:
        raise PDFExtractionFailed("pypdf not installed; run: pip install pypdf")

    try:
        reader = _pypdf.PdfReader(_io.BytesIO(pdf_bytes))
        fields = reader.get_form_text_fields() or {}
    except Exception as e:
        raise PDFExtractionFailed(f"pypdf read failed for {pdf_path}: {e}") from e

    # Field keys: verify against templates/f990-field-map-2025.json before shipping
    # These are XFA full-path field names (format: topmostSubform[0].PageN[0].fX_Y[0])
    FIELD_CANDIDATES: dict[str, list[str]] = {
        "total_revenue":  [],   # Part I Line 12 — fill from field map
        "contributions":  [],   # Part I Line 8  — fill from field map
        "total_expenses": [],   # Part I Line 18 — fill from field map
        "eoy_net_assets": [],   # Part I Line 22 col B — fill from field map
        "boy_net_assets": [],   # Part I Line 22 col A — fill from field map
    }

    result: dict = {}
    for field_name, candidates in FIELD_CANDIDATES.items():
        for k in candidates:
            val = fields.get(k, "").strip()
            if val:
                try:
                    result[field_name] = float(val.replace(",", "").replace("$", ""))
                    break
                except (ValueError, AttributeError):
                    pass
        result.setdefault(field_name, None)

    cache[key] = result
    return result


def _merge_prior_years(
    results: dict,
    priority_order: "list[str] | None" = None,
) -> "list[dict]":
    """
    Merge multi-source prior-year 990 data by priority, deduped by year.

    results: {source_name: list[dict] | {"filings": list[dict]}}
    priority_order: sources from highest to lowest authority.
    Returns: list[dict] newest-first; highest-priority source wins per year.
    """
    if priority_order is None:
        priority_order = ["irs_xml", "propublica", "citizenaudit", "teos"]

    by_year: dict[int, dict] = {}
    for source in priority_order:
        raw = results.get(source)
        if not raw:
            continue
        filings = raw.get("filings", raw) if isinstance(raw, dict) else raw
        for f in (filings if isinstance(filings, list) else []):
            yr = f.get("year")
            if yr is not None and yr not in by_year:
                by_year[yr] = dict(f)

    return [v for _, v in sorted(by_year.items(), reverse=True)]
