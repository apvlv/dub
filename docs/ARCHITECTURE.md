# System Architecture

This document describes the architecture of Dub, including service dependencies and data flow.

## Overview

Dub is a modern link attribution platform built as a Turborepo monorepo. It consists of a Next.js web application supported by various cloud services for database, caching, analytics, and more.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Web Browser    │    Mobile App    │    API Clients    │    Embeds          │
└────────┬────────┴────────┬─────────┴─────────┬─────────┴────────┬───────────┘
         │                 │                   │                  │
         ▼                 ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Next.js 15 (App Router)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Pages     │  │ API Routes  │  │  Middleware │  │   Actions   │        │
│  │   (SSR)     │  │   (REST)    │  │   (Edge)    │  │  (Server)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────┬────────────────┬────────────────┬─────────────────┬────────────────┘
         │                │                │                 │
         ▼                ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Database │  │  Cache   │  │ Analytics│  │ Storage  │  │  Email   │      │
│  │ (MySQL)  │  │ (Redis)  │  │(ClickHse)│  │  (S3)    │  │ (SMTP)   │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Jobs    │  │ Logging  │  │ Features │  │   Auth   │  │ Payments │      │
│  │ (Queue)  │  │ (Logs)   │  │ (Config) │  │(NextAuth)│  │ (Stripe) │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
dub/
├── apps/
│   └── web/                    # Main Next.js application
│       ├── app/                # App Router (pages, API routes)
│       ├── lib/                # Business logic
│       ├── ui/                 # UI components
│       └── tests/              # Test files
├── packages/
│   ├── prisma/                 # Database ORM & schema
│   ├── ui/                     # Shared UI components
│   ├── utils/                  # Utility functions
│   ├── email/                  # Email templates
│   ├── cli/                    # Command-line tool
│   ├── embeds/                 # Embed libraries
│   ├── tailwind-config/        # Shared Tailwind config
│   ├── tsconfig/               # Shared TypeScript config
│   ├── tinybird/               # Analytics integration
│   ├── stripe-app/             # Stripe integration
│   └── hubspot-app/            # HubSpot integration
└── docs/                       # Documentation
```

## Service Architecture

### Current Cloud Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DUB APPLICATION                                 │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   PlanetScale   │       │  Upstash Redis  │       │    Tinybird     │
│    (MySQL)      │       │   (Caching)     │       │  (ClickHouse)   │
│                 │       │                 │       │                 │
│ - User data     │       │ - Session cache │       │ - Click events  │
│ - Links         │       │ - Rate limiting │       │ - Analytics     │
│ - Domains       │       │ - Link metadata │       │ - Conversions   │
│ - Partners      │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                           │                           │
         │                           ▼                           │
         │                ┌─────────────────┐                    │
         │                │  Upstash QStash │                    │
         │                │   (Job Queue)   │                    │
         │                │                 │                    │
         │                │ - Webhooks      │                    │
         │                │ - Workflows     │                    │
         │                │ - Async tasks   │                    │
         │                └─────────────────┘                    │
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Cloudflare R2  │       │     Resend      │       │     Vercel      │
│   (Storage)     │       │    (Email)      │       │   (Platform)    │
│                 │       │                 │       │                 │
│ - Logos         │       │ - Magic links   │       │ - Hosting       │
│ - Avatars       │       │ - Notifications │       │ - Edge config   │
│ - Images        │       │ - Partner mail  │       │ - Domain mgmt   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Target Self-Hosted Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DUB APPLICATION                                 │
│                            (Docker Container)                                │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     MySQL       │       │     Redis       │       │   ClickHouse    │
│   (Container)   │       │   (Container)   │       │   (Container)   │
│                 │       │                 │       │                 │
│ - User data     │       │ - Session cache │       │ - Click events  │
│ - Links         │       │ - Rate limiting │       │ - Analytics     │
│ - Domains       │       │ - Link metadata │       │ - Conversions   │
│ - Partners      │       │ - Job queue     │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
               ┌─────────────────┐   ┌─────────────────┐
               │     BullMQ      │   │   File Logs     │
               │  (Job Worker)   │   │   or Loki       │
               │                 │   │                 │
               │ - Webhooks      │   │ - Request logs  │
               │ - Workflows     │   │ - Error logs    │
               │ - Async tasks   │   │ - Analytics     │
               └─────────────────┘   └─────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
│     MinIO       │ │   SMTP    │ │  Nginx/Traefik  │
│   (Container)   │ │  Server   │ │   (Container)   │
│                 │ │           │ │                 │
│ - Logos         │ │ - Email   │ │ - Routing       │
│ - Avatars       │ │ - Alerts  │ │ - SSL           │
│ - Images        │ │           │ │ - Domain proxy  │
└─────────────────┘ └───────────┘ └─────────────────┘
```

## Data Flow

### Link Click Flow

```
User clicks short link
         │
         ▼
┌─────────────────┐
│    Middleware   │──────► Check Redis cache
│   (Edge/Node)   │           │
└────────┬────────┘           │
         │◄───────────────────┘
         │
         ▼
┌─────────────────┐
│  Parse Request  │──────► Extract: IP, User-Agent, Geo
└────────┬────────┘
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Record Click    │          │    Redirect     │
│  (Tinybird)     │          │  to Target URL  │
│                 │          └─────────────────┘
│ - timestamp     │
│ - link_id       │
│ - ip_hash       │
│ - country       │
│ - device        │
│ - browser       │
│ - referer       │
└─────────────────┘
```

### Link Creation Flow

```
User creates link via API/UI
         │
         ▼
┌─────────────────┐
│   Validate      │──────► Check permissions
│   Request       │──────► Validate URL
└────────┬────────┘──────► Check domain ownership
         │
         ▼
┌─────────────────┐
│  Store in DB    │──────► MySQL (Prisma)
│   (Link)        │
└────────┬────────┘
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│  Cache Link     │          │ Record Event    │
│   (Redis)       │          │  (Tinybird)     │
└─────────────────┘          └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Trigger Webhook │──────► QStash (async)
│  (if configured)│
└─────────────────┘
```

### Conversion Tracking Flow

```
Customer converts (lead/sale)
         │
         ▼
┌─────────────────┐
│  Track Event    │──────► API endpoint or embed
│   /api/track    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Validate       │──────► Check link attribution
│  Attribution    │──────► Cookie/click_id lookup
└────────┬────────┘
         │
         ├──────────────────────────────┐
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Record Event    │          │  Create/Update  │
│  (Tinybird)     │          │   Customer      │
│                 │          │   (MySQL)       │
│ - event_type    │          └─────────────────┘
│ - customer_id   │
│ - amount        │
│ - metadata      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Commission    │──────► Calculate partner earnings
│  Calculation    │──────► Create commission record
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Trigger Events  │──────► Webhooks
│                 │──────► Partner notifications
└─────────────────┘
```

## Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         NextAuth.js                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│   │   Email     │   │   Google    │   │   GitHub    │           │
│   │ (Magic Link)│   │   OAuth     │   │   OAuth     │           │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘           │
│          │                 │                 │                   │
│          └─────────────────┼─────────────────┘                   │
│                            │                                     │
│                            ▼                                     │
│                   ┌─────────────────┐                            │
│                   │ Session Handler │                            │
│                   │                 │                            │
│                   │ - JWT tokens    │                            │
│                   │ - Database      │                            │
│                   │   sessions      │                            │
│                   └────────┬────────┘                            │
│                            │                                     │
│   ┌────────────────────────┼────────────────────────┐           │
│   │                        │                        │           │
│   ▼                        ▼                        ▼           │
│ ┌──────────┐         ┌──────────┐          ┌──────────┐        │
│ │  Prisma  │         │  Redis   │          │   SAML   │        │
│ │ Adapter  │         │  Cache   │          │(BoxyHQ)  │        │
│ └──────────┘         └──────────┘          └──────────┘        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Package Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/web                                  │
│         Main Next.js application with all features               │
└───────────┬───────────┬───────────┬───────────┬─────────────────┘
            │           │           │           │
            ▼           ▼           ▼           ▼
┌───────────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐
│  @dub/prisma  │ │  @dub/ui  │ │@dub/utils │ │  @dub/email   │
│               │ │           │ │           │ │               │
│ Prisma client │ │    UI     │ │ Helpers & │ │React Email +  │
│ + schema      │ │components │ │ constants │ │   Resend      │
└───────┬───────┘ └─────┬─────┘ └───────────┘ └───────────────┘
        │               │
        │               ▼
        │         ┌───────────┐
        │         │@dub/utils │
        │         └───────────┘
        │               │
        │               ▼
        │    ┌────────────────────┐
        │    │@dub/tailwind-config│
        │    └────────────────────┘
        │
        ▼
┌───────────────────────────┐
│   @prisma/client          │
│   @planetscale/database   │
└───────────────────────────┘
```

## API Architecture

### REST API

```
/api/
├── links/              # Link management
│   ├── [linkId]/       # Single link operations
│   ├── bulk/           # Bulk operations
│   └── count/          # Link counts
├── domains/            # Domain management
├── analytics/          # Analytics endpoints
├── track/              # Conversion tracking
│   ├── lead/           # Lead tracking
│   └── sale/           # Sale tracking
├── customers/          # Customer management
├── partners/           # Partner API
├── programs/           # Program management
├── webhooks/           # Webhook configuration
├── tokens/             # API token management
└── workspaces/         # Workspace management
```

### Authentication Methods

| Method | Use Case |
|--------|----------|
| Session (cookie) | Web application |
| API Key (Bearer) | Programmatic access |
| OAuth | Third-party integrations |
| Publishable Key | Client-side embeds |

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      CACHE LAYERS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Edge/CDN                                              │
│  ├── Static assets (images, JS, CSS)                            │
│  ├── Public pages (marketing)                                   │
│  └── TTL: minutes to hours                                      │
│                                                                  │
│  Layer 2: Redis                                                  │
│  ├── Link metadata (domain + key → URL)                         │
│  ├── Session data                                               │
│  ├── Rate limiting counters                                     │
│  ├── Feature flags                                              │
│  └── TTL: seconds to minutes                                    │
│                                                                  │
│  Layer 3: Database                                               │
│  ├── Primary data store                                         │
│  ├── Indexed queries                                            │
│  └── TTL: none (persistent)                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Background Jobs

### Current (QStash)

```
┌─────────────────┐       ┌─────────────────┐
│   Application   │──────►│    QStash       │
│                 │       │                 │
│ - Enqueue job   │       │ - Reliable      │
│ - Set callback  │       │ - Retry logic   │
│                 │       │ - Scheduling    │
└─────────────────┘       └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Webhook URL    │
                          │  (callback)     │
                          │                 │
                          │ - Process job   │
                          │ - Update state  │
                          └─────────────────┘
```

### Target (BullMQ)

```
┌─────────────────┐       ┌─────────────────┐
│   Application   │──────►│     Redis       │
│                 │       │    (Queue)      │
│ - Enqueue job   │       │                 │
│                 │       │ - Job storage   │
└─────────────────┘       │ - Priorities    │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  BullMQ Worker  │
                          │   (Container)   │
                          │                 │
                          │ - Process jobs  │
                          │ - Retry logic   │
                          │ - Scheduling    │
                          └─────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Edge Layer                                                   │
│     ├── Rate limiting (per IP/key)                              │
│     ├── Bot detection                                           │
│     ├── Geo blocking                                            │
│     └── DDoS protection                                         │
│                                                                  │
│  2. Application Layer                                            │
│     ├── Authentication (NextAuth)                               │
│     ├── Authorization (RBAC)                                    │
│     ├── CSRF protection                                         │
│     ├── Input validation (Zod)                                  │
│     └── XSS prevention                                          │
│                                                                  │
│  3. Data Layer                                                   │
│     ├── Encrypted connections (TLS)                             │
│     ├── Password hashing (bcrypt)                               │
│     ├── API key hashing                                         │
│     └── Sensitive data encryption                               │
│                                                                  │
│  4. Fraud Detection                                              │
│     ├── Click fraud rules                                       │
│     ├── Conversion fraud detection                              │
│     ├── IP/device fingerprinting                                │
│     └── Anomaly detection                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Scaling Considerations

### Horizontal Scaling

| Component | Scaling Method |
|-----------|----------------|
| Web Application | Multiple containers behind load balancer |
| Redis | Redis Cluster or Sentinel |
| MySQL | Read replicas, ProxySQL |
| ClickHouse | Sharding, distributed tables |
| MinIO | Distributed mode with multiple nodes |
| Workers | Multiple worker containers |

### Vertical Scaling

| Component | Key Resources |
|-----------|---------------|
| Web Application | CPU, Memory |
| Redis | Memory |
| MySQL | Storage IOPS, Memory |
| ClickHouse | Storage, Memory, CPU |
| MinIO | Storage, Network |

## Related Documents

- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Implementation status
- [DATABASE.md](./DATABASE.md) - Database schema details
- [CHANGELOG.md](./CHANGELOG.md) - Change history
