# Technology Decision: Real-Time Data Pipeline & Analytics
**Patient Monitoring Platform — Decision Summary for Stakeholders**
**Date: 2026-03-22 | Budget: $180K/year**

---

## Recommendation: Stack A — Full GCP Native

| Layer | Technology | Alternative Considered |
|---|---|---|
| Stream Ingestion | **Google Pub/Sub** | Kafka, Redpanda, Pulsar |
| Stream Processing | **Apache Beam / Dataflow** | Kafka Streams, PyFlink |
| Analytics Database | **BigQuery** | ClickHouse, Druid, TimescaleDB |
| Batch Orchestration | **Dagster+** | Cloud Composer, Prefect |
| MQTT Bridge | Custom GKE pod (unavoidable) | N/A |

---

## Why This Stack

**HIPAA compliance is the deciding factor.** Every component in Stack A is covered under Google's existing Business Associate Agreement. No additional vendor BAA negotiations. No data leaving GCP. VPC Service Controls wraps the entire pipeline.

**Your team can operate it.** All four components are fully managed or serverless. There are no brokers to tune, no ZooKeeper to manage, no JVM heap to configure. Your 2 data engineers will spend time building pipelines, not debugging distributed systems.

**It fits the budget.** Estimated $9K-18K/year at current scale (12K devices), scaling to $60K-120K/year at 200K devices — within the $180K budget.

**It handles Python ML natively.** The Apache Beam Python SDK runs your scikit-learn and TensorFlow models directly inside the Dataflow streaming job. This is the single most important technical constraint, and it eliminates Kafka Streams from consideration entirely.

---

## On the CTO's "Just Use Kafka" Position

The instinct is understandable but technically flawed for this specific use case. Here is the evidence-based assessment:

**What is correct about the Kafka instinct:**
- Kafka is the industry standard for streaming infrastructure
- Kafka's ecosystem (200+ connectors) is unmatched
- Kafka API compatibility means future portability

**What makes it wrong for your situation:**

1. **Kafka Streams cannot run Python.** It is a Java/Scala library with no Python equivalent. Your ML models live in Python. The alerting path would require: Kafka → external Python service → Kafka. This adds latency, complexity, and operational overhead.

2. **Kafka + Confluent Cloud costs 10x more than Pub/Sub** for equivalent ingestion volume. At $500-1,200/month vs $40-80/month, this matters at your scale.

3. **Your GCP committed spend doesn't cover Confluent.** Every dollar spent on Confluent is outside your GCP commitment; Pub/Sub, Dataflow, and BigQuery costs count toward it.

4. **Self-managed Kafka on GKE requires expertise your team doesn't have.** Nobody on your 8-person team has deep streaming experience.

**The correct interpretation of "standardize on Kafka":** If portability is the real concern, Pub/Sub now supports Kafka-compatible endpoints. You get the ecosystem compatibility without Kafka's operational burden.

---

## The Sub-3-Second Alerting Guarantee

The most common concern is whether Pub/Sub + Dataflow can meet a sub-3-second alerting SLA. It can, with one configuration requirement:

Dataflow's default behavior batches elements into windows. For alerting, configure the pipeline with **per-element triggers** (fire immediately on each record, don't wait for a window). With this:

- Pub/Sub acknowledgment latency: ~100ms
- Dataflow element processing (ML inference): ~200-500ms
- Alert dispatch to downstream service: ~100ms
- **Total: ~400-700ms** — 4-7x faster than the 3-second SLA

---

## When Stack B (ClickHouse) Becomes Right

Stack B adds ClickHouse Cloud as a high-speed query tier alongside BigQuery. Choose it if:

- Clinician dashboard queries consistently exceed 2-3 seconds in production
- Real-time cohort comparisons across hundreds of simultaneous patients are required
- Budget can absorb an additional $20-40K/year

Start with Stack A. If BigQuery query latency proves insufficient for the dashboard UX after 3-6 months of production use, add ClickHouse as a hot query tier at that point. BigQuery remains the system of record.

---

## Implementation Roadmap (First 90 Days)

**Days 1-30: Foundation**
- Sign Google BAA (if not already signed)
- Configure VPC Service Controls perimeter for PHI
- Deploy MQTT-to-Pub/Sub bridge on GKE (estimate: 1 data engineer, 1 week)
- Set up BigQuery dataset with partitioning and HIPAA column security

**Days 31-60: Streaming Pipeline**
- Build Dataflow pipeline: Pub/Sub → anomaly detection → alerts + BigQuery
- Integrate existing Python ML models via Beam Python SDK
- Validate sub-3s latency SLA with load testing at 12K device scale
- Set up Datadog integration for pipeline monitoring

**Days 61-90: Analytics & Orchestration**
- Deploy Dagster+ and build nightly retraining DAG as Dagster assets
- Build clinician dashboard API on top of BigQuery (parameterized queries for 1hr/24hr/7d/30d windows)
- Compliance audit: verify Cloud Audit Logs capture all PHI access
- Disaster recovery drill: validate 6-year retention and restore procedures

**Days 91+: Scale Preparation**
- Load test at simulated 50K and 100K device scale
- Implement BigQuery partition expiry aligned to 6-year HIPAA retention requirement
- Evaluate BigQuery BI Engine for dashboard query acceleration if needed

---

## Key Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pub/Sub ordering issues for biometric sequences | Medium | Enable message ordering with device_id as ordering key |
| Dataflow streaming latency spikes during scale events | Low | Configure Streaming Engine; set up autoscaling |
| BigQuery dashboard latency unacceptable for UX | Medium | Add BigQuery BI Engine cache layer ($250/month) or add ClickHouse (Stack B) |
| MQTT bridge becomes a single point of failure | Medium | Deploy 2 replicas with GKE disruption budget |
| Dagster+ HIPAA BAA not available | Low | Fall back to Cloud Composer (GCP BAA covered natively) |

---

## Budget Summary

| Scale | Annual Cost | Budget Remaining |
|---|---|---|
| 12K devices (current) | $9K-18K | $162K-171K buffer |
| 50K devices (6 months) | ~$20K-35K | $145K-160K buffer |
| 200K devices (2 years) | $60K-120K | $60K-120K buffer |

The $60K-120K buffer at 200K scale can be used to add ClickHouse for dashboard performance or BigQuery reservations for query cost predictability.
