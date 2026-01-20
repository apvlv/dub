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
| Upstash Redis | Caching, rate limiting | Self-hosted Redis | Pending | Used for session cache, link metadata, rate limiting |

**Files to modify:**
- `/apps/web/lib/upstash/redis.ts`
- `/apps/web/lib/upstash/ratelimit.ts`
- `/apps/web/lib/upstash/redis-streams.ts`

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

A Docker Compose configuration will be provided for self-hosting:

```yaml
services:
  dub:
    # Main application
  mysql:
    # Database
  redis:
    # Caching & jobs
  clickhouse:
    # Analytics
  minio:
    # Object storage
  mailhog:
    # Email testing (dev)
```

See `/docker-compose.yml` (to be created) for full configuration.

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

None yet.

## In Progress

None yet.

## Next Steps

1. Create Docker Compose configuration
2. Implement Redis abstraction layer
3. Add environment variable toggles
