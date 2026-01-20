# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working on this codebase.

## Project Overview

Dub is a modern, open-source link attribution platform for short links, conversion tracking, and affiliate programs. It's built as a Turborepo monorepo with Next.js 15, React 19, and TypeScript.

## Documentation References

When making changes, update the relevant documentation files:

- **docs/IMPLEMENTATION.md** - Implementation details and self-hosting status
- **docs/DATABASE.md** - Database schema and models documentation
- **docs/CHANGELOG.md** - Record of changes made to the codebase
- **docs/ARCHITECTURE.md** - System architecture and service dependencies

## Quick Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (port 8888) + Prisma Studio
pnpm build                # Production build
pnpm test                 # Run tests

# Database
pnpm prisma:generate      # Generate Prisma client
pnpm prisma:push          # Push schema to database
pnpm prisma:studio        # Open Prisma Studio
pnpm prisma:format        # Format schema files

# Linting & Formatting
pnpm lint                 # Lint all packages
pnpm format               # Format code with Prettier

# Docker (Self-Hosting)
docker compose up -d                                              # Start all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up # Development mode
docker compose exec app pnpm prisma:push                          # Initialize database
docker compose down                                               # Stop services
```

## Project Structure

```
dub/
├── apps/
│   └── web/                    # Main Next.js application
│       ├── app/                # Next.js App Router pages
│       ├── lib/                # Business logic and utilities
│       ├── ui/                 # UI components
│       └── tests/              # Vitest test files
├── packages/
│   ├── prisma/                 # Database schema (31 .prisma files)
│   ├── ui/                     # Shared UI components (@dub/ui)
│   ├── utils/                  # Utility functions (@dub/utils)
│   ├── email/                  # Email templates (@dub/email)
│   ├── cli/                    # CLI tool (@dub/cli)
│   ├── tailwind-config/        # Shared Tailwind config
│   ├── tsconfig/               # Shared TypeScript configs
│   ├── tinybird/               # Analytics integration
│   ├── stripe-app/             # Stripe integration
│   ├── hubspot-app/            # HubSpot integration
│   └── embeds/                 # Embed libraries
│       ├── core/               # Core embed (@dub/embed-core)
│       └── react/              # React embed (@dub/embed-react)
└── docs/                       # Documentation
```

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `apps/web/lib/` | Core business logic (54 directories) |
| `apps/web/app/api/` | API routes |
| `apps/web/lib/actions/` | Server actions |
| `apps/web/tests/` | Test files (54 test files) |
| `packages/prisma/schema/` | Database models (31 files) |

## Cloud Services (Self-Hosting Project)

The project is being made independent from cloud services. See `docs/IMPLEMENTATION.md` for current status.

| Service | Purpose | Local Alternative | Status |
|---------|---------|-------------------|--------|
| Tinybird | Analytics (ClickHouse) | Self-hosted ClickHouse | **Complete** (USE_LOCAL_CLICKHOUSE=true) |
| Upstash Redis | Caching, rate limiting | Self-hosted Redis | **Complete** (USE_LOCAL_REDIS=true) |
| Upstash QStash | Background jobs | BullMQ + Redis | Pending |
| PlanetScale | MySQL database | Self-hosted MySQL | **Docker Ready** |
| Cloudflare R2 | Object storage | MinIO | **Complete** (STORAGE_PUBLIC_ENDPOINT) |
| Resend | Email | Nodemailer + SMTP | **Docker Ready** |
| Vercel | Platform, domains | Docker + Nginx | **Docker Ready** |
| Vercel Edge Config | Feature flags | Database/Redis | Pending |
| Axiom | Logging | File logs/Loki | Pending |
| Plain | Customer support | Optional/disabled | Pending |

**Docker Compose Setup**: Complete! See `docker-compose.yml` and `docker/README.md`.

## Testing

- **Framework**: Vitest 4.0.8
- **Location**: `/apps/web/tests/`
- **Config**: `/apps/web/vitest.config.ts`
- **Timeout**: 50,000ms per test

```bash
pnpm test                 # Run all tests (stops on first failure)
```

## Database

- **ORM**: Prisma 6.19.1
- **Database**: MySQL (PlanetScale compatible)
- **Schema Files**: 31 modular .prisma files in `/packages/prisma/schema/`

Key models: User, Project, Link, Domain, Partner, Program, Commission, Payout, Customer, Webhook

See `docs/DATABASE.md` for full schema documentation.

## Code Style Guidelines

1. **TypeScript**: Use strict typing, avoid `any`
2. **Components**: Functional components with React hooks
3. **Styling**: Tailwind CSS with `@dub/ui` components
4. **Naming**:
   - Files: kebab-case for files, PascalCase for components
   - Variables: camelCase for variables, UPPER_SNAKE_CASE for constants
5. **Imports**: Use path aliases (`@/`, `@dub/utils`, etc.)

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Database
DATABASE_URL=mysql://...

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:8888

# Cloud Services (optional for self-hosting)
TINYBIRD_API_KEY=...
UPSTASH_REDIS_REST_URL=...
STORAGE_ACCESS_KEY_ID=...
RESEND_API_KEY=...
```

## Recommended Versions

| Package | Version |
|---------|---------|
| Node.js | v23.11.0 |
| pnpm | 9.15.9 |

## Common Issues

1. **`The table <table-name> does not exist`** - Run `pnpm prisma:push`
2. **Build failures** - Verify node/pnpm versions, delete `node_modules`, `.next`, `.turbo` and reinstall
3. **Type errors after schema change** - Run `pnpm prisma:generate`

## Making Changes

1. Create a feature branch from `main`
2. Make changes following code style guidelines
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint`
5. Update relevant documentation in `/docs/`
6. Create a pull request

## License

- **Core**: AGPL-3.0-or-later (open source)
- **Enterprise** (`/apps/web/app/(ee)`): Commercial license
