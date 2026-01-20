# Implementation Status

This document tracks the implementation progress of making Dub independent from cloud services for self-hosting.

## Overview

The goal is to replace all proprietary cloud services with self-hostable alternatives, allowing users to run Dub entirely on their own infrastructure.

## Cloud Service Replacement Status

### Analytics

| Service | Purpose | Replacement | Status | Notes |
|---------|---------|-------------|--------|-------|
| Tinybird | ClickHouse analytics | Self-hosted ClickHouse | Pending | Stores click events, conversions, analytics data |

**Files to modify:**
- `/apps/web/lib/tinybird/client.ts`
- `/apps/web/lib/tinybird/record-click.ts`
- `/apps/web/lib/tinybird/record-link.ts`
- `/apps/web/lib/tinybird/record-lead.ts`
- `/apps/web/lib/tinybird/record-sale.ts`

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
| Upstash QStash | Job queue, workflows | BullMQ + Redis | Pending | Async tasks, webhook delivery, workflow orchestration |

**Files to modify:**
- `/apps/web/lib/cron/qstash-workflow.ts`
- `/apps/web/lib/cron/verify-qstash.ts`
- `/apps/web/lib/webhook/qstash.ts`

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
| Cloudflare R2 | File storage | MinIO (S3-compatible) | Pending | Project logos, avatars, custom images |

**Files to modify:**
- `/apps/web/lib/storage.ts`

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
| Vercel Edge Config | Feature flags | Database/Redis config | Pending | Blacklists, feature flags, admin config |
| Vercel Functions | Geolocation, IP | GeoLite2 + local | Pending | IP geolocation for analytics |

**Files to modify:**
- `/apps/web/lib/api/domains/add-domain-vercel.ts`
- `/apps/web/lib/api/domains/remove-domain-vercel.ts`
- `/apps/web/lib/edge-config/*.ts`
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

# Use local ClickHouse instead of Tinybird
USE_LOCAL_CLICKHOUSE=true
CLICKHOUSE_URL=http://localhost:8123

# Use local SMTP instead of Resend
USE_LOCAL_SMTP=true
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Use local MinIO instead of R2
USE_LOCAL_STORAGE=true
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
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

## In Progress

- Storage abstraction layer

## Next Steps

1. ~~Create Docker Compose configuration~~ **DONE**
2. ~~Implement Redis abstraction layer~~ **DONE**
3. ~~Add environment variable toggles~~ **DONE**
4. Implement ClickHouse client to replace Tinybird
5. Add BullMQ worker for background jobs (replace QStash)
