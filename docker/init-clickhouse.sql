-- Dub ClickHouse Initialization Script
-- Creates tables for analytics data (replaces Tinybird)
--
-- This schema is based on the Tinybird datasource definitions in packages/tinybird/

-- Create database
CREATE DATABASE IF NOT EXISTS dub;

-- ================================
-- Click Events Table
-- Stores all link click events for analytics
-- ================================
CREATE TABLE IF NOT EXISTS dub.click_events
(
    `timestamp` DateTime64(3),
    `click_id` String,
    `link_id` String,
    `alias_link_id` Nullable(String),
    `url` String,
    `country` LowCardinality(String),
    `city` String,
    `region` String,
    `latitude` String,
    `longitude` String,
    `device` LowCardinality(String),
    `device_model` LowCardinality(String),
    `device_vendor` LowCardinality(String),
    `browser` LowCardinality(String),
    `browser_version` String,
    `os` LowCardinality(String),
    `os_version` String,
    `engine` LowCardinality(String),
    `engine_version` String,
    `cpu_architecture` LowCardinality(String),
    `ua` String,
    `bot` UInt8,
    `referer` String,
    `referer_url` String,
    `user_id` Nullable(Int64),
    `identity_hash` Nullable(String),
    `ip` String,
    `qr` UInt8,
    `continent` LowCardinality(String),
    `vercel_region` Nullable(String),
    `trigger` String,
    `workspace_id` Nullable(String),
    `domain` Nullable(String),
    `key` Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, link_id, click_id)
TTL toDateTime(timestamp) + INTERVAL 2 YEAR;

-- ================================
-- Lead Events Table
-- Stores conversion lead events
-- ================================
CREATE TABLE IF NOT EXISTS dub.lead_events
(
    `timestamp` DateTime64(3) DEFAULT now(),
    `event_id` String,
    `event_name` String,
    `customer_id` String,
    `click_id` String,
    `link_id` String,
    `url` String,
    `continent` LowCardinality(String),
    `country` LowCardinality(String),
    `city` String,
    `region` String,
    `latitude` String,
    `longitude` String,
    `device` LowCardinality(String),
    `device_model` LowCardinality(String),
    `device_vendor` LowCardinality(String),
    `browser` LowCardinality(String),
    `browser_version` String,
    `os` LowCardinality(String),
    `os_version` String,
    `engine` LowCardinality(String),
    `engine_version` String,
    `cpu_architecture` LowCardinality(String),
    `ua` String,
    `bot` UInt8,
    `referer` String,
    `referer_url` String,
    `ip` String,
    `qr` UInt8,
    `metadata` String,
    `trigger` String,
    `domain` Nullable(String),
    `key` Nullable(String),
    `workspace_id` Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, link_id, customer_id)
TTL toDateTime(timestamp) + INTERVAL 2 YEAR;

-- ================================
-- Sale Events Table
-- Stores conversion sale/purchase events
-- ================================
CREATE TABLE IF NOT EXISTS dub.sale_events
(
    `timestamp` DateTime64(3) DEFAULT now(),
    `event_id` String,
    `event_name` String,
    `customer_id` String,
    `payment_processor` LowCardinality(String),
    `invoice_id` String,
    `amount` UInt32,
    `currency` LowCardinality(String),
    `click_id` String,
    `link_id` String,
    `url` String,
    `continent` LowCardinality(String),
    `country` LowCardinality(String),
    `city` String,
    `region` String,
    `latitude` String,
    `longitude` String,
    `device` LowCardinality(String),
    `device_model` LowCardinality(String),
    `device_vendor` LowCardinality(String),
    `browser` LowCardinality(String),
    `browser_version` String,
    `os` LowCardinality(String),
    `os_version` String,
    `engine` LowCardinality(String),
    `engine_version` String,
    `cpu_architecture` LowCardinality(String),
    `ua` String,
    `bot` UInt8,
    `referer` String,
    `referer_url` String,
    `ip` String,
    `qr` UInt8,
    `metadata` String,
    `trigger` String,
    `domain` Nullable(String),
    `key` Nullable(String),
    `workspace_id` Nullable(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, link_id)
TTL toDateTime(timestamp) + INTERVAL 2 YEAR;

-- ================================
-- Links Metadata Table
-- Stores link metadata for analytics joins
-- ================================
CREATE TABLE IF NOT EXISTS dub.links_metadata
(
    `timestamp` DateTime DEFAULT now(),
    `link_id` String,
    `domain` String,
    `key` String,
    `url` String,
    `tag_ids` Array(String),
    `workspace_id` String,
    `created_at` DateTime64(3),
    `deleted` UInt8,
    `program_id` String,
    `tenant_id` String,
    `partner_id` String,
    `folder_id` String,
    `partner_group_id` String
)
ENGINE = MergeTree()
PARTITION BY toYear(timestamp)
ORDER BY (timestamp, link_id, workspace_id);

-- Latest links metadata view (deduplication)
CREATE TABLE IF NOT EXISTS dub.links_metadata_latest
(
    `link_id` String,
    `domain` String,
    `key` String,
    `url` String,
    `tag_ids` Array(String),
    `workspace_id` String,
    `created_at` DateTime64(3),
    `deleted` UInt8,
    `program_id` String,
    `tenant_id` String,
    `partner_id` String,
    `folder_id` String,
    `partner_group_id` String
)
ENGINE = ReplacingMergeTree()
ORDER BY (link_id);

-- ================================
-- Webhook Events Table
-- Stores webhook delivery logs
-- ================================
CREATE TABLE IF NOT EXISTS dub.webhook_events
(
    `timestamp` DateTime64(3) DEFAULT now(),
    `event_id` String,
    `webhook_id` String,
    `url` String,
    `event` LowCardinality(String),
    `http_status` UInt16,
    `request_body` String,
    `response_body` String,
    `message_id` String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, webhook_id, event_id)
TTL toDateTime(timestamp) + INTERVAL 90 DAY;

-- ================================
-- Audit Logs Table
-- Stores workspace activity logs
-- ================================
CREATE TABLE IF NOT EXISTS dub.audit_logs
(
    `id` String,
    `timestamp` DateTime64(3),
    `workspace_id` String,
    `program_id` String,
    `action` LowCardinality(String),
    `actor_id` String,
    `actor_type` LowCardinality(String),
    `actor_name` String,
    `targets` String,
    `description` String,
    `ip_address` String,
    `user_agent` String,
    `metadata` String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (workspace_id, program_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 1 YEAR;

-- ================================
-- Import Error Logs Table
-- Stores link import error logs
-- ================================
CREATE TABLE IF NOT EXISTS dub.import_error_logs
(
    `timestamp` DateTime64(3) DEFAULT now(),
    `workspace_id` String,
    `link_id` String,
    `domain` String,
    `key` String,
    `url` String,
    `error` String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, workspace_id)
TTL toDateTime(timestamp) + INTERVAL 30 DAY;

-- ================================
-- Materialized Views for Aggregations
-- ================================

-- Click events aggregated by link
CREATE MATERIALIZED VIEW IF NOT EXISTS dub.click_events_by_link_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, link_id, workspace_id)
AS SELECT
    toDate(timestamp) AS date,
    link_id,
    workspace_id,
    count() AS clicks,
    countIf(qr = 1) AS qr_clicks,
    uniqExact(click_id) AS unique_clicks
FROM dub.click_events
GROUP BY date, link_id, workspace_id;

-- Lead events aggregated
CREATE MATERIALIZED VIEW IF NOT EXISTS dub.lead_events_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, link_id, workspace_id)
AS SELECT
    toDate(timestamp) AS date,
    link_id,
    workspace_id,
    count() AS leads,
    uniqExact(customer_id) AS unique_customers
FROM dub.lead_events
GROUP BY date, link_id, workspace_id;

-- Sale events aggregated
CREATE MATERIALIZED VIEW IF NOT EXISTS dub.sale_events_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, link_id, workspace_id, currency)
AS SELECT
    toDate(timestamp) AS date,
    link_id,
    workspace_id,
    currency,
    count() AS sales,
    sum(amount) AS total_amount,
    uniqExact(customer_id) AS unique_customers
FROM dub.sale_events
GROUP BY date, link_id, workspace_id, currency;

-- ================================
-- Create default user (if needed)
-- ================================
-- Note: User creation is handled by ClickHouse environment variables
-- CLICKHOUSE_USER and CLICKHOUSE_PASSWORD

-- ================================
-- Health check query
-- ================================
SELECT 'ClickHouse initialization complete' AS status, now() AS timestamp;
