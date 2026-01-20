# Changelog

All notable changes to the self-hosting capabilities of Dub are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Initial documentation for self-hosting project
  - `CLAUDE.md` - Development guidance
  - `docs/IMPLEMENTATION.md` - Implementation status tracking
  - `docs/DATABASE.md` - Database schema documentation
  - `docs/CHANGELOG.md` - Change tracking
  - `docs/ARCHITECTURE.md` - System architecture

- **Docker Compose setup for self-hosting** (2026-01-20)
  - `docker-compose.yml` - Production configuration with all services:
    - Next.js application
    - MySQL 8.0 database
    - Redis 7 for caching
    - ClickHouse 24.3 for analytics
    - MinIO for S3-compatible storage
    - MailHog for email testing
    - Traefik reverse proxy (optional)
  - `docker-compose.dev.yml` - Development overrides with hot reloading
  - `Dockerfile` - Multi-stage build (development and production targets)
  - `.env.docker.example` - Environment variable template
  - `docker/init-mysql.sql` - MySQL database initialization
  - `docker/init-clickhouse.sql` - ClickHouse schema (replaces Tinybird)
  - `docker/nginx.conf` - Nginx reverse proxy configuration
  - `docker/README.md` - Setup documentation

- **Upstash Redis replacement** (2026-01-20)
  - Redis abstraction layer in `/apps/web/lib/upstash/redis.ts`
    - `LocalRedisClient` class using `ioredis` with same API as Upstash
    - Supports: get, set, del, hget, hset, hgetall, lpush, rpush, sadd, smembers, sismember, zincrby, xadd, xdel, xrange, xrevrange, mget, scan, pipeline
    - Toggle via `USE_LOCAL_REDIS=true` environment variable
    - Timeout support with `redisWithTimeout` export
  - Local rate limiting in `/apps/web/lib/upstash/ratelimit.ts`
    - Sliding window algorithm using Redis sorted sets
    - Atomic operations via Lua script
    - Same API as Upstash Ratelimit
  - Added `ioredis` dependency
  - Updated Docker Compose with `USE_LOCAL_REDIS=true`
  - Unit tests in `/apps/web/tests/upstash/redis.test.ts`

- **MinIO storage replacement** (2026-01-20)
  - Updated `/apps/web/lib/storage.ts` to support MinIO
    - Added `STORAGE_PUBLIC_ENDPOINT` for client-accessible signed URLs
    - Server-side operations use internal `STORAGE_ENDPOINT`
    - Client-side signed URLs use `STORAGE_PUBLIC_ENDPOINT`
  - No code toggle needed - same `aws4fetch` library works with both R2 and MinIO
  - MinIO service in Docker Compose with health checks and auto bucket creation
  - Unit tests in `/apps/web/tests/storage/storage.test.ts`

- **Tinybird ClickHouse replacement** (2026-01-20)
  - ClickHouse abstraction layer in `/apps/web/lib/clickhouse/client.ts`
    - `LocalClickHouseClient` class with same API pattern as Tinybird's zod-bird
    - `buildIngestEndpoint()` method for data ingestion with Zod schema validation
    - `buildPipe()` method for query execution with SQL translation
    - `query()` and `insert()` methods for direct ClickHouse access
    - Automatic datasource-to-table name mapping
    - SQL query generation for all existing pipes
  - `AnalyticsClient` class that wraps both Tinybird and local ClickHouse
    - Toggle via `USE_LOCAL_CLICKHOUSE=true` environment variable
    - Seamless switching between backends without code changes
  - Updated all tinybird files to use the abstraction layer
  - Updated `docker-compose.yml` with ClickHouse environment variables
  - Updated `docker/init-clickhouse.sql` schema with all required tables
  - Unit tests in `/apps/web/tests/clickhouse/client.test.ts`

### Planned
- Replace Upstash QStash with BullMQ
- Replace Resend with Nodemailer + SMTP
- Replace Vercel Edge Config with database/Redis config
- Replace Vercel domain management with local DNS
- Replace Axiom logging with local logging
- Replace Vercel Functions (geolocation) with GeoLite2
- Make Plain customer support optional

## How to Update This File

When making changes related to self-hosting, add an entry under `[Unreleased]`:

```markdown
### Added
- New feature description

### Changed
- Changed feature description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

Categories:
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Features to be removed in future
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

## Release Process

When a release is made:

1. Move items from `[Unreleased]` to a new version section
2. Add the release date
3. Create a new empty `[Unreleased]` section

Example:
```markdown
## [1.0.0] - 2026-01-20

### Added
- Self-hosted Redis support
- Docker Compose configuration
```

## Related Documents

- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Detailed implementation status
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DATABASE.md](./DATABASE.md) - Database schema
