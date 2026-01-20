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

### Planned
- Replace Tinybird with self-hosted ClickHouse (schema done, client pending)
- Replace Upstash Redis with self-hosted Redis (server done, abstraction layer pending)
- Replace Upstash QStash with BullMQ
- Replace Cloudflare R2 with MinIO (server done, abstraction layer pending)
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
