"""
data_pipeline.py — ETL pipeline for log ingestion and analysis

Reads log files from a source directory, applies transformations,
enriches records with external lookups, and writes results to a
configured sink (database, S3, or local file).
"""

from __future__ import annotations

import csv
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------

DEFAULT_CONFIG: Dict[str, Any] = {
    "batch_size": 500,
    "retry_limit": 3,
    "output_format": "jsonl",
    "log_level": "INFO",
}


# [ISSUE: PY-1] Command injection via shell=True with f-string interpolation
def search_logs(pattern: str, filename: str) -> List[str]:
    """Search for a pattern in a log file using grep."""
    result = subprocess.run(
        f"grep {pattern} {filename}",
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError(f"grep failed: {result.stderr}")
    return result.stdout.splitlines()


def load_config(config_path: str) -> Dict[str, Any]:
    """Load pipeline configuration from a JSON file."""
    path = Path(config_path)
    if not path.exists():
        logger.warning("Config file not found, using defaults: %s", config_path)
        return DEFAULT_CONFIG.copy()

    with open(path) as fh:
        user_config = json.load(fh)

    merged = {**DEFAULT_CONFIG, **user_config}
    logger.info("Loaded config from %s", config_path)
    return merged


def validate_config(config: Dict[str, Any]) -> bool:
    """Validate required config keys are present and well-typed."""
    required = ["batch_size", "retry_limit", "output_format"]
    for key in required:
        if key not in config:
            logger.error("Missing required config key: %s", key)
            return False
    if config["batch_size"] < 1:
        logger.error("batch_size must be >= 1")
        return False
    return True


# ---------------------------------------------------------------------------
# Record parsing
# ---------------------------------------------------------------------------

# [ISSUE: PY-2] Bare except swallows all exceptions including KeyboardInterrupt
def parse_log_line(line: str) -> Optional[Dict[str, Any]]:
    """Parse a single log line into a structured record."""
    try:
        record = json.loads(line.strip())
        if "timestamp" not in record:
            record["timestamp"] = datetime.now(timezone.utc).isoformat()
        return record
    except:
        pass


def parse_csv_record(row: Dict[str, str], field_map: Dict[str, str]) -> Dict[str, Any]:
    """Map raw CSV row keys to pipeline-internal field names."""
    return {field_map.get(k, k): v for k, v in row.items()}


def normalize_timestamp(ts: str) -> str:
    """Normalize various timestamp formats to ISO-8601 UTC."""
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%d/%b/%Y:%H:%M:%S %z",
        "%Y/%m/%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(ts, fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    logger.warning("Could not parse timestamp: %s", ts)
    return ts


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

_geo_cache: Dict[str, Dict[str, str]] = {}


def lookup_geo(ip_address: str, geo_db: Dict[str, Any]) -> Dict[str, str]:
    """Look up geographic information for an IP address."""
    if ip_address in _geo_cache:
        return _geo_cache[ip_address]

    # [ISSUE: PY-3] Direct dict access on user-controlled key without .get() — KeyError crash
    entry = geo_db[ip_address]
    result = {
        "country": entry.get("country", "unknown"),
        "city": entry.get("city", "unknown"),
        "lat": str(entry.get("lat", 0.0)),
        "lon": str(entry.get("lon", 0.0)),
    }
    _geo_cache[ip_address] = result
    return result


def enrich_record(record: Dict[str, Any], geo_db: Dict[str, Any]) -> Dict[str, Any]:
    """Attach geo, user-agent, and derived fields to a record."""
    enriched = record.copy()

    ip = record.get("client_ip")
    if ip:
        try:
            geo = lookup_geo(ip, geo_db)
            enriched.update(geo)
        except Exception as exc:
            logger.debug("Geo lookup failed for %s: %s", ip, exc)

    ua = record.get("user_agent", "")
    enriched["is_bot"] = any(bot in ua.lower() for bot in ["bot", "crawler", "spider"])

    status = record.get("status_code", 0)
    enriched["is_error"] = int(status) >= 400 if status else False

    return enriched


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

# [ISSUE: PY-4] open() without context manager — file handle leak
def read_field_map(field_map_path: str) -> Dict[str, str]:
    """Load field name mapping from a CSV file."""
    fh = open(field_map_path)
    reader = csv.DictReader(fh)
    mapping = {}
    for row in reader:
        mapping[row["source_field"]] = row["target_field"]
    return mapping


def iter_log_records(source_path: Path, batch_size: int) -> Generator[List[Dict[str, Any]], None, None]:
    """Yield records from a log file in batches."""
    batch: List[Dict[str, Any]] = []

    with open(source_path) as fh:
        for raw_line in fh:
            record = parse_log_line(raw_line)
            if record is None:
                continue
            batch.append(record)
            if len(batch) >= batch_size:
                yield batch
                batch = []

    if batch:
        yield batch


def write_jsonl(records: List[Dict[str, Any]], output_path: Path) -> None:
    """Append records to a JSONL output file."""
    with open(output_path, "a") as fh:
        for record in records:
            fh.write(json.dumps(record) + "\n")


def write_csv_output(records: List[Dict[str, Any]], output_path: Path) -> None:
    """Write records to a CSV file, inferring headers from first record."""
    if not records:
        return

    fieldnames = list(records[0].keys())
    write_header = not output_path.exists()

    with open(output_path, "a", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        writer.writerows(records)


# ---------------------------------------------------------------------------
# Retry logic
# ---------------------------------------------------------------------------

# [ISSUE: PY-5] Unbounded wait: sleep(retry_count * 10) with no max cap
def write_with_retry(records: List[Dict[str, Any]], output_path: Path, fmt: str, retry_limit: int) -> bool:
    """Write records to output, retrying on transient failures."""
    retry_count = 0
    while retry_count <= retry_limit:
        try:
            if fmt == "jsonl":
                write_jsonl(records, output_path)
            elif fmt == "csv":
                write_csv_output(records, output_path)
            else:
                raise ValueError(f"Unknown format: {fmt}")
            return True
        except OSError as exc:
            retry_count += 1
            if retry_count > retry_limit:
                logger.error("Write failed after %d retries: %s", retry_limit, exc)
                return False
            logger.warning("Write error (attempt %d), retrying in %ds: %s", retry_count, retry_count * 10, exc)
            time.sleep(retry_count * 10)

    return False


# ---------------------------------------------------------------------------
# Safe subprocess example (not injection)
# ---------------------------------------------------------------------------

def count_log_lines(filename: str) -> int:
    """Count lines in a file using wc."""
    # [TRAP] shell=False with list args — NOT injection
    result = subprocess.run(
        ["wc", "-l", filename],
        shell=False,
        capture_output=True,
        text=True,
        check=True,
    )
    return int(result.stdout.split()[0])


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

class Pipeline:
    """Orchestrates the full ETL process for a source log directory."""

    def __init__(self, config: Dict[str, Any], geo_db_path: str) -> None:
        self.config = config
        self.batch_size = config.get("batch_size", 500)
        self.retry_limit = config.get("retry_limit", 3)
        self.output_format = config.get("output_format", "jsonl")
        self.stats: Dict[str, int] = {
            "records_read": 0,
            "records_enriched": 0,
            "records_written": 0,
            "records_skipped": 0,
        }
        self._geo_db = self._load_geo_db(geo_db_path)

    def _load_geo_db(self, path: str) -> Dict[str, Any]:
        """Load the IP-to-geo mapping database."""
        db_path = Path(path)
        if not db_path.exists():
            logger.warning("Geo DB not found, geo enrichment disabled: %s", path)
            return {}
        # [TRAP] Proper with open(...) usage — NOT a file handle leak
        with open(db_path) as fh:
            return json.load(fh)

    def run(self, source_dir: str, output_dir: str) -> Dict[str, int]:
        """Process all log files in source_dir and write to output_dir."""
        src = Path(source_dir)
        dst = Path(output_dir)
        dst.mkdir(parents=True, exist_ok=True)

        log_files = sorted(src.glob("*.log"))
        if not log_files:
            logger.warning("No .log files found in %s", source_dir)
            return self.stats

        for log_file in log_files:
            logger.info("Processing: %s", log_file.name)
            output_path = dst / f"{log_file.stem}.{self.output_format}"
            self._process_file(log_file, output_path)

        logger.info("Pipeline complete: %s", self.stats)
        return self.stats

    def _process_file(self, source: Path, output: Path) -> None:
        """Process a single log file."""
        for batch in iter_log_records(source, self.batch_size):
            self.stats["records_read"] += len(batch)

            enriched = []
            for record in batch:
                try:
                    enriched.append(enrich_record(record, self._geo_db))
                    self.stats["records_enriched"] += 1
                except Exception as exc:
                    logger.warning("Enrichment failed: %s", exc)
                    self.stats["records_skipped"] += 1
                    enriched.append(record)

            success = write_with_retry(enriched, output, self.output_format, self.retry_limit)
            if success:
                self.stats["records_written"] += len(enriched)


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Run the log ETL pipeline")
    parser.add_argument("source_dir", help="Directory containing .log files")
    parser.add_argument("output_dir", help="Directory for output files")
    parser.add_argument("--config", default="pipeline.conf.json", help="Config file path")
    parser.add_argument("--geo-db", default="geo.json", help="IP geo database path")
    parser.add_argument("--pattern", help="Optional: filter logs by grep pattern first")
    parser.add_argument("--field-map", help="Optional: CSV field name mapping file")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    )

    config = load_config(args.config)
    if not validate_config(config):
        logger.error("Invalid configuration — aborting")
        return 1

    pipeline = Pipeline(config, args.geo_db)
    stats = pipeline.run(args.source_dir, args.output_dir)

    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
