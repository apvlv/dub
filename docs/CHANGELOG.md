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

### Planned
- Replace Tinybird with self-hosted ClickHouse
- Replace Upstash Redis with self-hosted Redis
- Replace Upstash QStash with BullMQ
- Replace Cloudflare R2 with MinIO
- Replace Resend with Nodemailer + SMTP
- Replace Vercel Edge Config with database/Redis config
- Replace Vercel domain management with local DNS
- Replace Axiom logging with local logging
- Replace Vercel Functions (geolocation) with GeoLite2
- Make Plain customer support optional
- Create Docker Compose setup

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
