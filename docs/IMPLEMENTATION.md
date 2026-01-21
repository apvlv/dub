# Implementation Status

This document tracks the implementation progress of making Dub independent from cloud services for self-hosting.

## Overview

The goal is to replace all proprietary cloud services with self-hostable alternatives, allowing users to run Dub entirely on their own infrastructure.

## Cloud Service Replacement Status

### Analytics

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Tinybird | ClickHouse analytics | Self-hosted ClickHouse | **Complete** | Uses `@chronark/zod-bird` API pattern with `USE_LOCAL_CLICKHOUSE=true` toggle |

**Files modified:**
- `/apps/web/lib/clickhouse/client.ts` - Abstraction layer supporting both Tinybird and local ClickHouse
- `/apps/web/lib/clickhouse/index.ts` - Module exports
- `/apps/web/lib/tinybird/client.ts` - Updated to use ClickHouse abstraction
- `/apps/web/lib/tinybird/record-click.ts` - Uses `ingestClickEvent()` helper for both backends
- `/apps/web/tests/clickhouse/client.test.ts` - Unit tests for environment toggle and configuration

### Caching & Rate Limiting

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Upstash Redis | Caching, rate limiting | Self-hosted Redis | **Complete** | Uses `ioredis` with `USE_LOCAL_REDIS=true` toggle |

**Files modified:**
- `/apps/web/lib/upstash/redis.ts` - Abstraction layer supporting both Upstash REST API and standard Redis
- `/apps/web/lib/upstash/ratelimit.ts` - Rate limiting with sliding window algorithm for local Redis
- `/apps/web/tests/upstash/redis.test.ts` - Unit tests for duration parsing and environment toggle

### Background Jobs

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Upstash QStash | Job queue, workflows | BullMQ + Redis | **Complete** | Uses `USE_LOCAL_QUEUE=true` toggle, separate worker process |

**Files modified:**
- `/apps/web/lib/queue/` - New queue abstraction layer
  - `index.ts` - Module exports
  - `client.ts` - Queue client with BullMQ/QStash toggle
  - `types.ts` - Type definitions for jobs
  - `jobs.ts` - Helper functions for enqueueing jobs
  - `workers/` - BullMQ worker processors
    - `webhook-worker.ts` - Webhook delivery with retry
    - `workflow-worker.ts` - Workflow orchestration
    - `batch-worker.ts` - Batch job processing
    - `handlers/partner-approved.ts` - Partner workflow implementation
- `/apps/web/lib/cron/qstash-workflow.ts` - Updated with BullMQ toggle
- `/apps/web/lib/cron/verify-qstash.ts` - Updated to allow local queue requests
- `/apps/web/lib/cron/enqueue-batch-jobs.ts` - Updated with BullMQ toggle
- `/apps/web/lib/webhook/qstash.ts` - Updated webhook delivery with BullMQ toggle
- `/apps/web/worker.ts` - Worker process entry point
- `/apps/web/tests/queue/client.test.ts` - Unit tests for queue types

### Database

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| PlanetScale | MySQL database | Self-hosted MySQL/MariaDB | Pending | Already uses standard MySQL via Prisma |

**Files to modify:**
- `/packages/prisma/schema/schema.prisma` (datasource config)
- Connection string configuration

### Object Storage

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Cloudflare R2 | File storage | MinIO (S3-compatible) | **Complete** | Uses `aws4fetch` with path-style URLs |

**Files modified:**
- `/apps/web/lib/storage.ts` - Added `STORAGE_PUBLIC_ENDPOINT` support for signed URLs
- `/apps/web/tests/storage/storage.test.ts` - Unit tests for configuration

### Email

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Resend | Transactional email | Nodemailer + SMTP | Pending | Magic link auth, notifications, partner invites |

**Files to modify:**
- `/packages/email/src/resend/client.ts`
- `/packages/email/src/resend/index.ts`
- `/packages/email/src/send-via-resend.ts`

### Platform & Deployment

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Vercel | Hosting, domains | Docker + Nginx/Traefik | Pending | Edge functions, domain management |
| Vercel Edge Config | Feature flags | Database/Redis config | **Complete** | Uses `USE_LOCAL_CONFIG=true` toggle with DB + Redis caching |
| Vercel Functions | Geolocation, IP | GeoLite2 + local | Pending | IP geolocation for analytics |

**Files modified:**
- `/apps/web/lib/config/` - New config abstraction layer
  - `types.ts` - Type definitions for config keys and values
  - `local-client.ts` - Local implementation with DB + Redis caching
  - `client.ts` - Abstraction layer with environment toggle
  - `index.ts` - Module exports
- `/packages/prisma/schema/config.prisma` - Database schema for ConfigEntry model
- `/apps/web/lib/edge-config/*.ts` - Updated all files with local config toggle
- `/apps/web/app/api/admin/config/route.ts` - Admin API for config management
- `/apps/web/tests/config/client.test.ts` - Unit tests

**Files to modify:**
- `/apps/web/lib/api/domains/add-domain-vercel.ts`
- `/apps/web/lib/api/domains/remove-domain-vercel.ts`
- `/apps/web/lib/middleware/utils/parse-request.ts`

### Logging & Monitoring

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Axiom | Logging | File logs / Loki / Grafana | Pending | Request logging, error tracking |

**Files to modify:**
- `/apps/web/lib/axiom/axiom.ts`
- `/apps/web/lib/axiom/server.ts`

### Customer Support

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Plain | Support tickets | Optional/disabled | Pending | Can be made optional for self-hosting |

**Files to modify:**
- `/apps/web/lib/plain/client.ts`
- `/apps/web/lib/plain/*.ts`

## Implementation Approach

Each cloud service replacement follows this pattern:

1. **Create abstraction layer** - Interface that both cloud and local implementations satisfy
2. **Environment variable toggle** - `USE_LOCAL_*=true` to switch between implementations
3. **Local implementation** - Self-hosted alternative
4. **Tests** - Ensure both implementations work correctly
5. **Documentation** - Update docs with configuration options

Example environment variable pattern:
```bash
# Use local Redis instead of Upstash
USE_LOCAL_REDIS=true
REDIS_URL=redis://localhost:6379

# Use local BullMQ queue instead of QStash
USE_LOCAL_QUEUE=true
# Note: Uses the same REDIS_URL as above

# Use local ClickHouse instead of Tinybird
USE_LOCAL_CLICKHOUSE=true
CLICKHOUSE_URL=http://localhost:8123

# Use local config instead of Vercel Edge Config
USE_LOCAL_CONFIG=true
# Note: Uses database for storage and Redis for caching
# Admin API key for managing config (optional)
ADMIN_API_KEY=your-secure-admin-key

# Use local SMTP instead of Resend
USE_LOCAL_SMTP=true
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Use MinIO instead of R2 (no toggle needed, just configure endpoints)
# Internal endpoint for server-side operations (Docker network)
STORAGE_ENDPOINT=http://minio:9000
# Public endpoint for client-side signed URLs (browser-accessible)
STORAGE_PUBLIC_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY_ID=minio
STORAGE_SECRET_ACCESS_KEY=miniosecret
# Base URL for accessing stored files
STORAGE_BASE_URL=http://localhost:9000/dub-public
STORAGE_PUBLIC_BUCKET=dub-public
STORAGE_PRIVATE_BUCKET=dub-private
```

## Docker Compose Setup

A comprehensive Docker Compose configuration is now available for self-hosting. See the files in the root directory:

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production configuration with all services |
| `docker-compose.dev.yml` | Development overrides with hot reloading |
| `Dockerfile` | Multi-stage build for the Next.js app |
| `.env.docker.example` | Environment variable template |
| `docker/init-mysql.sql` | MySQL initialization script |
| `docker/init-clickhouse.sql` | ClickHouse schema (replaces Tinybird) |
| `docker/nginx.conf` | Nginx reverse proxy configuration |
| `docker/README.md` | Docker setup documentation |

### Quick Start

```bash
# 1. Copy environment template
cp .env.docker.example .env.docker

# 2. Generate NEXTAUTH_SECRET
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env.docker

# 3. Start services
docker compose up -d

# 4. Initialize database
docker compose exec app pnpm prisma:push
```

### Services

```yaml
services:
  app:           # Next.js application (port 8888)
  mysql:         # MySQL 8.0 database (port 3306)
  redis:         # Redis 7 for caching & queues (port 6379)
  clickhouse:    # ClickHouse 24.3 for analytics (port 8123)
  minio:         # MinIO for S3-compatible storage (ports 9000, 9001)
  mailhog:       # Email testing (SMTP 1025, UI 8025)
  worker:        # BullMQ background worker (optional)
  traefik:       # Reverse proxy with SSL (optional, ports 80, 443)
```

### Development Mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Development mode adds:
- Hot reloading with mounted source code
- Prisma Studio at http://localhost:5555
- Redis Commander at http://localhost:8081
- Debug logging enabled

## Priority Order

1. **Docker Compose setup** - Foundation for all local services
2. **Redis replacement** - Most critical, used by many features
3. **MinIO (storage)** - Minimal code changes needed
4. **ClickHouse** - Analytics can work independently
5. **QStash to BullMQ** - Depends on Redis being ready
6. **Email (SMTP)** - Standalone service
7. **Edge Config** - Can use Redis/DB
8. **Vercel Functions** - GeoLite2 for geolocation
9. **Domain management** - Requires DNS integration
10. **Axiom logging** - Lower priority
11. **Plain support** - Make optional
12. **Documentation** - Final step

## Testing Requirements

Each replacement must include:

- Unit tests for the abstraction layer
- Integration tests for local implementation
- E2E tests to verify feature parity
- Performance benchmarks

## Progress Tracking

See Vibe Kanban for detailed task tracking:
- Project: `dub`
- Parent Task: "Make project independent from cloud services"

## Completed Tasks

### Docker Compose Setup (2026-01-20)
- Created `docker-compose.yml` with all required services
- Created `docker-compose.dev.yml` for development with hot reloading
- Created multi-stage `Dockerfile` for production builds
- Created `.env.docker.example` environment template
- Created `docker/init-mysql.sql` for database initialization
- Created `docker/init-clickhouse.sql` with full analytics schema
- Created `docker/nginx.conf` for reverse proxy
- Created `docker/README.md` with setup documentation

### Upstash Redis Replacement (2026-01-20)
- Created Redis abstraction layer in `/apps/web/lib/upstash/redis.ts`
  - `LocalRedisClient` class wrapping `ioredis` with same API as Upstash
  - Supports all Redis operations: get, set, del, hget, hset, hgetall, lpush, rpush, sadd, smembers, sismember, zincrby, xadd, xdel, xrange, xrevrange, mget, scan, pipeline
  - Timeout support with `redisWithTimeout` export
  - Toggle via `USE_LOCAL_REDIS=true` environment variable
- Created local rate limiting implementation in `/apps/web/lib/upstash/ratelimit.ts`
  - `LocalRatelimitWithRedis` class using sliding window algorithm
  - Atomic operations via Lua script for thread safety
  - Fallback implementation if Lua script fails
  - Same API as Upstash Ratelimit: `limit(identifier)` returns `{ success, limit, remaining, reset }`
- Added `ioredis` dependency to web app
- Updated `docker-compose.yml` to include `USE_LOCAL_REDIS=true`
- Updated `.env.docker.example` with Redis toggle documentation
- Added unit tests in `/apps/web/tests/upstash/redis.test.ts`

### MinIO Storage Replacement (2026-01-20)
- Updated `/apps/web/lib/storage.ts` to support MinIO:
  - Added `STORAGE_PUBLIC_ENDPOINT` for client-accessible signed URLs
  - Server-side operations (upload, delete) use internal `STORAGE_ENDPOINT`
  - Client-side signed URLs use `STORAGE_PUBLIC_ENDPOINT` (falls back to `STORAGE_ENDPOINT`)
  - No code toggle needed - same `aws4fetch` library works with both R2 and MinIO
- Docker Compose already includes MinIO setup:
  - `minio` service with health checks
  - `minio-init` service for automatic bucket creation
  - Buckets: `dub-public` (public download) and `dub-private` (restricted)
- Updated environment configuration:
  - `docker-compose.yml` - Added `STORAGE_PUBLIC_ENDPOINT` variable
  - `.env.docker.example` - Documented MinIO configuration
  - `apps/web/.env.example` - Added `STORAGE_PUBLIC_ENDPOINT` documentation
- Added unit tests in `/apps/web/tests/storage/storage.test.ts`

### Tinybird ClickHouse Replacement (2026-01-20)
- Created ClickHouse abstraction layer in `/apps/web/lib/clickhouse/client.ts`
  - `LocalClickHouseClient` class with same API pattern as Tinybird's zod-bird
  - `buildIngestEndpoint()` method for data ingestion with Zod schema validation
  - `buildPipe()` method for query execution with SQL translation
  - `query()` and `insert()` methods for direct ClickHouse access
  - Automatic datasource-to-table name mapping (e.g., `dub_click_events` → `click_events`)
  - SQL query generation for all existing pipes: `get_click_event`, `get_lead_event`, `get_lead_events`, `get_webhook_events`, `get_import_error_logs`, `v2_customer_events`, `v3_group_by_link_country`
  - Proper SQL escaping for query parameters
- `AnalyticsClient` class that wraps both Tinybird and local ClickHouse
  - Toggle via `USE_LOCAL_CLICKHOUSE=true` environment variable
  - Seamless switching between backends without code changes
- Updated `/apps/web/lib/tinybird/client.ts` to use the abstraction
  - Exports `tb` that automatically uses the correct backend
  - All existing tinybird imports continue to work
- Updated `/apps/web/lib/tinybird/record-click.ts`
  - Created `ingestClickEvent()` helper function
  - Routes to local ClickHouse or Tinybird based on environment
- Updated `docker-compose.yml` with ClickHouse environment variables:
  - `USE_LOCAL_CLICKHOUSE=true`
  - `CLICKHOUSE_URL`, `CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`
  - `CLICKHOUSE_DATABASE`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`
- Updated `docker/init-clickhouse.sql` schema:
  - Added `conversion_events_log` table
  - Updated `import_error_logs` schema to match code expectations
  - Added `partner_tag_ids` to `links_metadata` tables
- Updated `.env.docker.example` with ClickHouse configuration
- Added unit tests in `/apps/web/tests/clickhouse/client.test.ts`

### Upstash QStash Replacement (2026-01-21)
- Created queue abstraction layer in `/apps/web/lib/queue/`
  - `QueueClient` class supporting both QStash and BullMQ
  - `getQueue()` and `createWorker()` helpers for BullMQ
  - Toggle via `USE_LOCAL_QUEUE=true` environment variable
  - Shares Redis connection with caching (`REDIS_URL`)
- Created job types and helper functions:
  - `enqueueWebhook()` / `enqueueWebhooks()` - Webhook delivery
  - `enqueueWorkflow()` / `enqueueWorkflows()` - Workflow triggering
  - `enqueueBatchJob()` / `enqueueBatchJobs()` - Batch job processing
- Created BullMQ workers:
  - `webhook-worker.ts` - Delivers webhooks with retry, records events
  - `workflow-worker.ts` - Executes workflow steps (e.g., partner-approved)
  - `batch-worker.ts` - Processes batch jobs via HTTP to internal endpoints
- Worker entry point:
  - `/apps/web/worker.ts` - Standalone process for BullMQ workers
  - Configurable concurrency and rate limiting per queue
  - Graceful shutdown handling
- Updated existing code to support both backends:
  - `/apps/web/lib/webhook/qstash.ts` - Webhook delivery toggle
  - `/apps/web/lib/cron/qstash-workflow.ts` - Workflow triggering toggle
  - `/apps/web/lib/cron/enqueue-batch-jobs.ts` - Batch jobs toggle
  - `/apps/web/lib/cron/verify-qstash.ts` - Allows local queue requests
- Updated Docker Compose:
  - Added `USE_LOCAL_QUEUE=true` to app and worker services
  - Worker service already configured with `--profile worker`
- Added unit tests in `/apps/web/tests/queue/client.test.ts`

### Vercel Edge Config Replacement (2026-01-21)
- Created config abstraction layer in `/apps/web/lib/config/`
  - `types.ts` - Type definitions for all config keys (domains, emails, keys, referrers, betaFeatures, etc.)
  - `local-client.ts` - `LocalConfigClient` class using database as source of truth with Redis caching
  - `client.ts` - Abstraction layer that switches between Edge Config and local config
  - `index.ts` - Module exports
- Created database schema in `/packages/prisma/schema/config.prisma`
  - `ConfigEntry` model with `key` (unique) and `value` (JSON) fields
  - Stores all config types: blacklists, feature flags, whitelists
- Updated all edge-config functions with local config toggle:
  - `/apps/web/lib/edge-config/get-feature-flags.ts` - Beta feature flags
  - `/apps/web/lib/edge-config/is-blacklisted-domain.ts` - Domain blacklisting
  - `/apps/web/lib/edge-config/is-blacklisted-email.ts` - Email blacklisting
  - `/apps/web/lib/edge-config/is-blacklisted-key.ts` - Short link key blacklisting
  - `/apps/web/lib/edge-config/is-blacklisted-referrer.ts` - Referrer whitelisting
  - `/apps/web/lib/edge-config/is-reserved-username.ts` - Reserved usernames for Pro+
  - `/apps/web/lib/edge-config/update.ts` - Config updates with new helper functions
- Created admin API for config management:
  - `/apps/web/app/api/admin/config/route.ts` - CRUD operations (GET, POST, PATCH, DELETE)
  - `/apps/web/app/api/admin/config/cache/route.ts` - Cache invalidation endpoint
  - Secured with `ADMIN_API_KEY` environment variable
- Toggle via `USE_LOCAL_CONFIG=true` environment variable
- Added unit tests in `/apps/web/tests/config/client.test.ts`

## In Progress

- None

## Next Steps

1. ~~Create Docker Compose configuration~~ **DONE**
2. ~~Implement Redis abstraction layer~~ **DONE**
3. ~~Add environment variable toggles~~ **DONE**
4. ~~MinIO storage replacement~~ **DONE**
5. ~~Implement ClickHouse client to replace Tinybird~~ **DONE**
6. ~~Add BullMQ worker for background jobs (replace QStash)~~ **DONE**
7. ~~Implement Edge Config replacement with Redis/DB~~ **DONE**
8. Replace Resend with Nodemailer + SMTP
9. Add GeoLite2 for IP geolocation
