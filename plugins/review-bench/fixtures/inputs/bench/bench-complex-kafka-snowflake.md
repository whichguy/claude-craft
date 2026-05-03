# Plan: Event-Driven CDC Data Pipeline: PostgreSQL to Snowflake via Kafka

## Context
Our analytics team requires real-time access to transactional data from our production PostgreSQL database. We need a robust, scalable pipeline that captures changes as they happen (CDC) and streams them into Snowflake with minimal latency. 

The architecture consists of:
1.  **Debezium (on Kafka Connect):** Captures row-level changes from PostgreSQL via logical replication.
2.  **Apache Kafka:** Acts as the durable event backbone.
3.  **Confluent Schema Registry:** Manages Avro schemas and ensures backward compatibility as the source DB evolves.
4.  **Snowflake Sink Connector:** Efficiently ingests events into Snowflake tables.
5.  **Prometheus/Grafana:** Provides observability into connector health, consumer lag, and event throughput.

## Git Setup
Create a new repository or feature branch:
```bash
git checkout -b feat/cdc-pipeline-snowflake
```
All infrastructure and connector configurations will be version-controlled in this repository.

---

## Phase 1: Infrastructure & Schema Evolution Strategy

**Intent:** Set up the local development environment using Docker Compose and define the schema evolution policy. We'll use Avro to handle schema changes gracefully.

### 1.1 Docker Compose for Local Development
**File: `docker-compose.yml`**
```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on: [zookeeper]
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  schema-registry:
    image: confluentinc/cp-schema-registry:7.5.0
    depends_on: [kafka]
    environment:
      SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: kafka:9092
      SCHEMA_REGISTRY_HOST_NAME: schema-registry

  connect:
    image: confluentinc/cp-server-connect:7.5.0
    depends_on: [kafka, schema-registry]
    volumes:
      - ./plugins:/usr/share/confluent-hub-components
    environment:
      CONNECT_BOOTSTRAP_SERVERS: kafka:9092
      CONNECT_REST_ADVERTISED_HOST_NAME: connect
      CONNECT_GROUP_ID: "connect-cluster"
      CONNECT_CONFIG_STORAGE_TOPIC: "connect-configs"
      CONNECT_OFFSET_STORAGE_TOPIC: "connect-offsets"
      CONNECT_STATUS_STORAGE_TOPIC: "connect-status"
      CONNECT_KEY_CONVERTER: "io.confluent.connect.avro.AvroConverter"
      CONNECT_KEY_CONVERTER_SCHEMA_REGISTRY_URL: "http://schema-registry:8081"
      CONNECT_VALUE_CONVERTER: "io.confluent.connect.avro.AvroConverter"
      CONNECT_VALUE_CONVERTER_SCHEMA_REGISTRY_URL: "http://schema-registry:8081"
```

---

## Phase 2: Source Connector - Debezium PostgreSQL

**Intent:** Configure Debezium to capture changes from PostgreSQL. We must ensure the `wal_level` is set to `logical` on the database.

### 2.1 Debezium Connector Configuration
**File: `connectors/source-postgres.json`**
```json
{
  "name": "inventory-source",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres-db",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "dbz",
    "database.dbname": "postgres",
    "topic.prefix": "cdc",
    "table.include.list": "public.orders,public.products",
    "plugin.name": "pgoutput",
    "value.converter": "io.confluent.connect.avro.AvroConverter",
    "value.converter.schema.registry.url": "http://schema-registry:8081"
  }
}
```

---

## Phase 3: Sink Connector - Snowflake Ingestion

**Intent:** Configure the Snowflake Sink Connector to consume events from Kafka and write them to Snowflake. We will use the Snowpipe-based ingestion for near real-time performance.

### 3.1 Snowflake Sink Configuration
**File: `connectors/sink-snowflake.json`**
```json
{
  "name": "snowflake-sink",
  "config": {
    "connector.class": "com.snowflake.kafka.connector.SnowflakeSinkConnector",
    "topics": "cdc.public.orders",
    "snowflake.url.name": "your_account.snowflakecomputing.com",
    "snowflake.user.name": "KAFKA_CONNECTOR_USER",
    "snowflake.private.key": "${file:/secrets/snowflake_key.p8:key}",
    "snowflake.database.name": "ANALYTICS_DB",
    "snowflake.schema.name": "RAW_CDC",
    "key.converter": "io.confluent.connect.avro.AvroConverter",
    "key.converter.schema.registry.url": "http://schema-registry:8081",
    "value.converter": "io.confluent.connect.avro.AvroConverter",
    "value.converter.schema.registry.url": "http://schema-registry:8081",
    "snowflake.role.name": "KAFKA_CONNECTOR_ROLE",
    "snowflake.ingestion.method": "SNOWPIPE"
  }
}
```

---

## Phase 4: Monitoring and Alerting

**Intent:** Deploy Prometheus and Grafana to monitor the pipeline. We'll use the JMX Exporter to pull metrics from Kafka Connect.

### 4.1 Prometheus Configuration
**File: `monitoring/prometheus.yml`**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'kafka-connect'
    static_configs:
      - targets: ['connect:8080']
```

### 4.2 Grafana Dashboard Setup
**Intent:** Import a pre-configured dashboard for Debezium and Kafka Connect.
- **Key Metrics to Track:**
    - `debezium_metrics_MessagesScanned`: Confirm events are being read from WAL.
    - `kafka_consumer_lag`: Ensure the Snowflake sink is keeping up with the stream.
    - `connector_errors`: Alert on connector task failures.

---

## Verification

1.  **Infrastructure Check:** Run `docker-compose up -d` and verify all containers are healthy.
2.  **Source Validation:** Insert a row into the `orders` table in PostgreSQL. Check Kafka for the corresponding Avro message:
    ```bash
    docker-compose exec schema-registry kafka-avro-console-consumer \
      --bootstrap-server kafka:9092 --topic cdc.public.orders --from-beginning
    ```
3.  **Sink Validation:** Query Snowflake to ensure the data arrived:
    ```sql
    SELECT * FROM ANALYTICS_DB.RAW_CDC.ORDERS LIMIT 10;
    ```
4.  **Schema Evolution Test:** Add a column to the `orders` table in PostgreSQL:
    ```sql
    ALTER TABLE orders ADD COLUMN discount_code VARCHAR(20);
    ```
    Verify that the Schema Registry updates the schema and Snowflake handles the new field (or appends it to the `RECORD_CONTENT` JSON column depending on configuration).

---

## Risks and Mitigations

- **Schema Mismatches:** If the source schema changes in a way that is incompatible with Avro (e.g., changing a field type), the connector will fail.
    - *Mitigation:* Set `CONNECT_VALUE_CONVERTER_SCHEMA_REGISTRY_URL` and use `FULL` compatibility mode in Schema Registry.
- **Data Latency:** High volume spikes can lead to Kafka lag.
    - *Mitigation:* Configure Prometheus alerts for consumer lag exceeding 5 minutes and scale Kafka Connect workers horizontally.
- **Snowflake Costs:** Snowpipe can be expensive with many small files.
    - *Mitigation:* Tune `buffer.count.records` and `buffer.flush.time` in the Snowflake Sink configuration to batch data effectively.
