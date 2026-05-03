# Plan: Automated Daily Business Report Pipeline

## Context

The analytics team spends ~45 minutes every morning manually running SQL queries against the data warehouse to compile a daily business report (revenue, signups, churn, top products). This is error-prone and blocks the team's morning. We'll automate this as a Python pipeline that queries PostgreSQL, generates an HTML report with tables and charts, and emails it to stakeholders via SendGrid. Scheduled through the existing Airflow instance at 6 AM UTC.

**Existing infrastructure:**
- Data warehouse: PostgreSQL analytics cluster (`DW_CONNECTION_STRING` env var)
- Email: SendGrid SDK installed in Airflow workers (`SENDGRID_API_KEY` env var)
- Scheduling: Airflow with DAGs in `dags/` directory
- Pipeline packages live in `pipelines/`

## Git Setup

```bash
git checkout -b feat/daily-report-pipeline
```

---

## Phase 1: Core Pipeline Package

> The goal here is a self-contained package that can be run manually from the command line — query the warehouse, build the report, send the email. We want this working end-to-end before touching Airflow so we can iterate quickly and test without deploy cycles.

**Pre-checks:** Verify `DW_CONNECTION_STRING` connects to the analytics cluster. Verify `SENDGRID_API_KEY` is set and valid (send a test email).

### 1. Package scaffolding

Create `pipelines/daily_report/`:

```
pipelines/daily_report/
├── __init__.py
├── queries.py
├── report.py
├── charts.py
├── sender.py
├── main.py
├── templates/
│   └── daily_report.html
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_queries.py
    ├── test_report.py
    ├── test_charts.py
    └── test_sender.py
```

### 2. Data extraction — `pipelines/daily_report/queries.py`

Functions that each take a SQLAlchemy engine and report date, return structured data:

- `get_revenue_summary(engine, date) -> dict` — Query `analytics.transactions` for the given date: total revenue, transaction count, average order value. Also query the same day last week and compute delta percentages for each metric.
- `get_signups(engine, date) -> dict` — New user signups from `analytics.events` where `event_type = 'signup'`. Include current day count and same-day-last-week count with delta %.
- `get_churn(engine, date) -> dict` — Churned users from `analytics.events` where `event_type = 'churn'`. Same structure as signups.
- `get_top_products(engine, date, limit=10) -> list[dict]` — Top products by revenue from `analytics.order_items` joined to `analytics.products`. Return: rank, product name, units sold, revenue.

All queries use `sqlalchemy.text()` with bound parameters — no string interpolation in SQL. Each function creates its own connection from the engine (context manager with `engine.connect()`).

### 3. Chart generation — `pipelines/daily_report/charts.py`

Use matplotlib to generate inline charts as base64-encoded PNGs (embedded directly in the HTML email — no external hosting needed):

- `revenue_comparison_bar(current: float, previous: float) -> str` — Side-by-side bar chart (current week vs last week revenue). Returns base64 data URI string.
- `signups_churn_bar(signups: int, churn: int) -> str` — Grouped bar showing signups vs churn for the day. Green for signups, red for churn.

Keep charts simple — these are summary visuals, not dashboards. Use `matplotlib.use('Agg')` so it works headless on the Airflow worker.

### 4. HTML report — `pipelines/daily_report/templates/daily_report.html`

Jinja2 template. Inline CSS (email clients strip `<style>` blocks). Structure:

- **Header:** "Daily Business Report — {date}" with generation timestamp
- **Revenue section:** Table with Current / Last Week / Delta % columns for total revenue, transaction count, AOV. Delta cells colored green (positive) or red (negative). Revenue comparison bar chart below the table.
- **Signups & Churn section:** Two-column layout — signups count + delta, churn count + delta. Signups/churn bar chart.
- **Top 10 Products:** Styled HTML table — rank, product name, units sold, revenue (formatted as currency). Alternating row colors.
- **Footer:** "This is an automated report generated at {timestamp} UTC. Questions? Contact analytics@company.com"

### 5. Report assembly — `pipelines/daily_report/report.py`

- `generate_report(date: datetime.date) -> tuple[str, dict]` — Creates the SQLAlchemy engine from `DW_CONNECTION_STRING`, runs all four query functions, generates charts, renders the Jinja2 template. Returns `(html_string, raw_data_dict)`.
- Each query is timed and logged: `"Querying revenue_summary... done (1.2s)"`.
- If a query returns empty/None: log a warning, substitute placeholder data so the template renders with "No data available" in that section. Don't fail the whole report because one section has no data.
- The `raw_data_dict` is returned separately so the sender can build a CSV attachment from it.

### 6. Email delivery — `pipelines/daily_report/sender.py`

- `send_report(html: str, raw_data: dict, date: datetime.date) -> None`
- Recipients from `REPORT_RECIPIENTS` env var (comma-separated email addresses). Fail fast with a clear error if this var is missing or empty.
- From address: `reports@company.com` (configurable via `REPORT_FROM_ADDRESS` env var, with that default).
- Subject: `"Daily Business Report — {date:%B %d, %Y}"`
- Body: the HTML report as the email body.
- Attachment: Generate a CSV summary from `raw_data` (revenue, signups, churn, top products as flat rows) using `csv.writer` + `io.StringIO`. Attach as `daily_report_{date}.csv`.
- Use SendGrid's `Mail`, `Attachment`, `FileContent` classes. Let API errors propagate — the caller handles retry logic.

### 7. CLI entry point — `pipelines/daily_report/main.py`

- `run(date: Optional[datetime.date] = None) -> None` — Defaults to yesterday (UTC). Calls `generate_report()` then `send_report()`. Logs total duration.
- `if __name__ == "__main__"` block with `argparse`: `--date YYYY-MM-DD` optional argument.
- Exit code 0 on success, 1 on failure (Airflow uses this for task status).
- Structured logging with `logging.basicConfig(format='%(asctime)s %(levelname)s %(message)s')`.

### 8. Tests — `pipelines/daily_report/tests/`

`conftest.py`:
- Fixture: `mock_engine` — SQLAlchemy engine mock that returns configurable result sets.
- Fixture: `sample_data` — Realistic fixture data for all four query types.
- Fixture: `sample_html` — Pre-rendered report HTML for sender tests.

`test_queries.py`:
- Verify each query function uses parameterized SQL (inspect the `text()` call args — no raw date strings in the query).
- Verify return types match expected schema (dict with correct keys, list of dicts for products).
- Verify empty result sets return empty dict/list (not None, not exception).
- Verify delta % calculation: known inputs (revenue 100 vs 80) should yield +25.0%.

`test_report.py`:
- Provide fixture data, verify generated HTML contains expected values (revenue amount, product names).
- Verify delta cells have correct CSS classes (positive/negative).
- Verify "No data available" placeholder renders when a section has empty data.
- Verify charts are embedded as base64 `<img>` tags.

`test_charts.py`:
- Verify chart functions return valid base64 data URI strings.
- Verify they handle edge cases: zero values, equal current/previous values.

`test_sender.py`:
- Mock `sendgrid.SendGridAPIClient` — verify `send()` is called with correct `Mail` object.
- Verify recipient list parsed correctly from comma-separated env var.
- Verify CSV attachment is present and contains expected headers.
- Verify missing `REPORT_RECIPIENTS` raises a clear `ValueError`.

### 9. Verify Phase 1

```bash
# Run the test suite
pytest pipelines/daily_report/tests/ -v

# Smoke test against real warehouse (use a known date with data)
python -m pipelines.daily_report.main --date 2026-03-30

# Verify: email received, HTML renders correctly in Gmail/Outlook, CSV attachment opens in Excel
```

**Commit:**
```bash
git add pipelines/daily_report/
git commit -m "feat: add daily business report pipeline — queries, charts, HTML report, email delivery"
```

---

## Phase 2: Airflow DAG & Deployment

> Now we wire the tested pipeline into Airflow for automated scheduling. This is deliberately a thin integration layer — all logic stays in the pipeline package, and the DAG just invokes it.

### 10. Airflow DAG — `dags/daily_report_dag.py`

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    "owner": "analytics",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["oncall-analytics@company.com"],
}

with DAG(
    dag_id="daily_business_report",
    default_args=default_args,
    schedule="0 6 * * *",
    start_date=datetime(2026, 4, 1),
    catchup=False,
    tags=["reporting", "daily", "analytics"],
):
    PythonOperator(
        task_id="generate_and_send_report",
        python_callable=lambda: __import__("pipelines.daily_report.main", fromlist=["run"]).run(),
    )
```

Key decisions:
- **Single task, not multi-task:** The pipeline is fast (~30s total) and the operations are tightly coupled — splitting into separate Airflow tasks would add complexity without benefit.
- **`catchup=False`:** Don't generate 200 backfill reports on first deploy. If historical reports are needed, run manually with `--date`.
- **Retries: 2 with 5-minute delay:** Covers transient DB connection issues without spamming SendGrid.
- **`email_on_failure`:** Sends to the on-call alias. This is in addition to whatever alerting (PagerDuty, etc.) is already configured on the Airflow instance.

### 11. Dependencies

Add `jinja2` and `matplotlib` to the Airflow worker requirements (SQLAlchemy and sendgrid are already present):

Update `requirements.txt` (or equivalent — wherever Airflow worker dependencies are declared):
```
jinja2>=3.1
matplotlib>=3.7
```

### 12. Deploy and validate

1. Sync DAG file to Airflow's DAG folder (S3 sync, Git deploy, or however DAGs are deployed in this environment).
2. Wait for Airflow to pick up the new DAG (~30s with default `dag_dir_list_interval`).
3. Verify DAG appears in Airflow UI under `daily_business_report` with correct schedule.
4. Trigger a manual run from the Airflow UI.
5. Verify: task succeeds (green), email arrives with correct report, logs show query timings.

**Commit:**
```bash
git add dags/daily_report_dag.py
git commit -m "feat: add Airflow DAG for daily business report at 6 AM UTC"
```

---

## Verification Checklist

1. **Unit tests pass:** `pytest pipelines/daily_report/tests/ -v` — all green
2. **Happy path:** Manual run for yesterday's date — email received, HTML renders in Gmail and Outlook, CSV opens correctly, charts display
3. **No-data handling:** Run for a future date — report generates with "No data available" placeholders, email still sends, no crash
4. **Delta math spot-check:** Manually verify one day's delta % calculations against raw SQL results
5. **Error handling:** Kill the DB connection string — pipeline exits with code 1, Airflow marks task as failed, failure email fires
6. **Missing recipients:** Unset `REPORT_RECIPIENTS` — clear ValueError before any queries run
7. **DAG schedule:** Visible in Airflow UI with `0 6 * * *` schedule, next run time is correct
8. **Production monitoring:** Watch the first 3 scheduled runs (6 AM UTC) to confirm reliability — check Airflow logs for query timings and successful sends
