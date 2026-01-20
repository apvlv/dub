# Database Schema Documentation

This document describes the database schema for Dub, including all models, relationships, and enums.

## Overview

- **ORM**: Prisma 6.19.1
- **Database**: MySQL (PlanetScale compatible)
- **Schema Location**: `/packages/prisma/schema/`
- **Schema Files**: 31 modular `.prisma` files

## Schema Organization

The schema is split into modular files for better organization:

| File | Purpose |
|------|---------|
| `schema.prisma` | Main config (datasource, generators) |
| `user.prisma` | User accounts and authentication |
| `workspace.prisma` | Workspaces/projects |
| `link.prisma` | Short links |
| `domain.prisma` | Custom domains |
| `partner.prisma` | Partner/affiliate profiles |
| `program.prisma` | Affiliate programs |
| `commission.prisma` | Commission tracking |
| `payout.prisma` | Partner payouts |
| `customer.prisma` | Customer records |
| `webhook.prisma` | Webhook configurations |
| `oauth.prisma` | OAuth applications |
| `integration.prisma` | Third-party integrations |
| ... | And more |

## Core Models

### User & Authentication

#### User
Primary user account model.

```prisma
model User {
  id                     String   @id @default(cuid())
  name                   String?
  email                  String?  @unique
  emailVerified          DateTime?
  image                  String?
  isMachine              Boolean  @default(false)
  passwordHash           String?
  invalidLoginAttempts   Int      @default(0)
  lockedAt               DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  // Relations
  accounts               Account[]
  sessions               Session[]
  projects               ProjectUsers[]
  links                  Link[]
  tokens                 Token[]
  // ... more relations
}
```

#### Account
OAuth provider accounts linked to users.

```prisma
model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String? @db.Text
  access_token       String? @db.Text
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String? @db.Text

  user               User    @relation(...)
}
```

### Workspace/Project

#### Project
Workspace containing links, domains, and settings.

```prisma
model Project {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String   @unique
  logo                  String?
  plan                  String   @default("free")
  stripeId              String?  @unique
  billingCycleStart     Int?
  usage                 Int      @default(0)
  usageLimit            Int      @default(1000)
  aiUsage               Int      @default(0)
  aiLimit               Int      @default(10)
  linksUsage            Int      @default(0)
  linksLimit            Int      @default(25)
  domainsLimit          Int      @default(3)
  tagsLimit             Int      @default(5)
  foldersLimit          Int      @default(2)
  usersLimit            Int      @default(1)
  salesLimit            Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  users                 ProjectUsers[]
  invites               ProjectInvite[]
  domains               Domain[]
  links                 Link[]
  tags                  Tag[]
  // ... more relations
}
```

### Links

#### Link
Core short link model with tracking and targeting options.

```prisma
model Link {
  id                 String    @id @default(cuid())
  domain             String
  key                String
  url                String    @db.LongText
  trackConversion    Boolean   @default(false)
  archived           Boolean   @default(false)
  expiresAt          DateTime?
  expiredUrl         String?   @db.LongText
  password           String?
  proxy              Boolean   @default(false)
  title              String?
  description        String?   @db.VarChar(500)
  image              String?   @db.LongText
  video              String?   @db.LongText
  utm_source         String?
  utm_medium         String?
  utm_campaign       String?
  utm_term           String?
  utm_content        String?
  rewrite            Boolean   @default(false)
  doIndex            Boolean   @default(false)
  clicks             Int       @default(0)
  leads              Int       @default(0)
  sales              Int       @default(0)
  saleAmount         Int       @default(0)
  publicStats        Boolean   @default(false)

  // Device targeting
  ios                String?   @db.LongText
  android            String?   @db.LongText

  // Geo targeting
  geo                Json?

  // A/B testing
  testVariantId      String?
  testCompletedAt    DateTime?
  testStartedAt      DateTime?

  // Relations
  project            Project?  @relation(...)
  user               User?     @relation(...)
  tags               LinkTag[]
  webhooks           LinkWebhook[]
  // ... more relations

  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@unique([domain, key])
  @@index([projectId])
  @@index([domain])
  // ... more indexes
}
```

#### Domain
Custom domain configuration.

```prisma
model Domain {
  id                String    @id @default(cuid())
  slug              String    @unique
  verified          Boolean   @default(false)
  target            String?   @db.LongText
  type              String    @default("redirect")
  placeholder       String?   @db.LongText
  expiredUrl        String?   @db.LongText
  primary           Boolean   @default(false)
  archived          Boolean   @default(false)
  lastChecked       DateTime  @default(now())

  // Relations
  project           Project?  @relation(...)
  links             Link[]

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### Partner/Affiliate System

#### Partner
Partner profile for affiliate program.

```prisma
model Partner {
  id                  String   @id @default(cuid())
  name                String
  email               String?
  image               String?
  country             String?
  bio                 String?  @db.Text
  website             String?
  youtube             String?
  twitter             String?
  linkedin            String?
  tiktok              String?
  instagram           String?
  facebook            String?
  github              String?
  stripeConnectId     String?  @unique
  payoutMethodId      String?
  showOnLeaderboard   Boolean  @default(true)

  // Verification status
  websiteVerified     DateTime?
  youtubeVerified     DateTime?
  // ... other platform verifications

  // Relations
  users               PartnerUser[]
  programs            ProgramEnrollment[]
  payouts             Payout[]
  links               Link[]
  // ... more relations

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

#### Program
Affiliate program configuration.

```prisma
model Program {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String
  logo                  String?
  brandColor            String?
  url                   String?
  domain                String?
  cookieLength          Int      @default(90)
  minPayoutAmount       Int      @default(100)
  discountCodePrefix    String?

  // Commission settings
  commissionType        CommissionType @default(flat)
  commissionAmount      Int      @default(0)
  recurringCommission   Boolean  @default(false)
  recurringDuration     Int?
  recurringInterval     CommissionInterval?
  isLifetimeRecurring   Boolean  @default(false)

  // Relations
  workspace             Project  @relation(...)
  enrollments           ProgramEnrollment[]
  rewards               Reward[]
  // ... more relations

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([workspaceId, slug])
}
```

#### Commission
Commission tracking for sales.

```prisma
model Commission {
  id              String           @id @default(cuid())
  amount          Int
  type            CommissionType
  earnings        Int              @default(0)
  quantity        Int              @default(1)
  status          CommissionStatus @default(pending)

  // Relations
  programEnrollment ProgramEnrollment @relation(...)
  customer        Customer?        @relation(...)
  sale            Sale?            @relation(...)

  // Payout tracking
  payoutId        String?
  payout          Payout?          @relation(...)

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

#### Payout
Partner payout records.

```prisma
model Payout {
  id              String        @id @default(cuid())
  amount          Int
  fee             Int           @default(0)
  total           Int
  currency        String        @default("usd")
  status          PayoutStatus  @default(pending)
  type            PayoutType    @default(sales)
  description     String?
  periodStart     DateTime?
  periodEnd       DateTime?
  quantity        Int           @default(0)

  // Payment details
  invoiceId       String?       @unique
  stripeTransferId String?
  paypalBatchId   String?

  // Relations
  partner         Partner       @relation(...)
  program         Program       @relation(...)
  commissions     Commission[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}
```

### Customer & Sales

#### Customer
Customer records with sales tracking.

```prisma
model Customer {
  id                  String   @id @default(cuid())
  externalId          String
  name                String?
  email               String?
  avatar              String?
  country             String?
  stripeCustomerId    String?

  // Relations
  project             Project  @relation(...)
  link                Link?    @relation(...)
  partner             Partner? @relation(...)
  sales               Sale[]
  commissions         Commission[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([projectId, externalId])
}
```

### Webhooks & Integrations

#### Webhook
Webhook endpoint configuration.

```prisma
model Webhook {
  id              String   @id @default(cuid())
  name            String
  url             String
  secret          String
  triggers        Json
  disabledAt      DateTime?

  // Relations
  project         Project  @relation(...)
  links           LinkWebhook[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### Integration
Third-party integration configuration.

```prisma
model Integration {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  description     String?
  readme          String?  @db.LongText
  developer       String
  website         String
  logo            String?
  screenshots     Json?
  verified        Boolean  @default(false)

  // OAuth settings
  clientId        String?
  clientSecret    String?  @db.Text

  // Relations
  installations   InstalledIntegration[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## Key Enums

### Commission & Payout

```prisma
enum CommissionStatus {
  pending
  approved
  paid
  refunded
  canceled
  duplicate
  fraud
}

enum CommissionType {
  flat
  percentage
}

enum PayoutStatus {
  pending
  processing
  completed
  failed
  canceled
}

enum PaymentMethod {
  stripe
  paypal
  bank
}
```

### Partner

```prisma
enum PartnerRole {
  owner
  member
}

enum PartnerProfileType {
  youtube
  tiktok
  website
  email
}

enum ProgramEnrollmentStatus {
  pending
  approved
  rejected
  invited
}
```

### Workspace

```prisma
enum WorkspaceRole {
  owner
  member
}
```

### Campaigns & Bounties

```prisma
enum CampaignStatus {
  draft
  active
  paused
  completed
  archived
}

enum CampaignType {
  newSignups
  existingPartners
}

enum BountyType {
  signup
  content
  referral
}

enum BountySubmissionStatus {
  pending
  approved
  rejected
}
```

### Fraud Detection

```prisma
enum FraudEventStatus {
  pending
  approved
  rejected
}

enum FraudRuleType {
  ip
  country
  device
  email
  domain
}
```

## Relationships

### One-to-Many
- User -> Projects (via ProjectUsers)
- Project -> Links
- Project -> Domains
- Partner -> Payouts
- Program -> Enrollments

### Many-to-Many
- Links <-> Tags (via LinkTag)
- Links <-> Webhooks (via LinkWebhook)
- Partners <-> Programs (via ProgramEnrollment)

### Self-Referencing
- Link -> Link (testVariant for A/B testing)
- Partner -> Partner (referrals)

## Indexes

Key indexes for performance:

```prisma
// Link lookups
@@index([projectId])
@@index([domain])
@@index([userId])
@@unique([domain, key])

// Partner lookups
@@index([country])
@@index([email])

// Commission queries
@@index([programEnrollmentId])
@@index([status])
@@index([payoutId])

// Customer lookups
@@unique([projectId, externalId])
@@index([stripeCustomerId])
```

## Migrations

Database changes are managed through Prisma:

```bash
# Generate Prisma client after schema changes
pnpm prisma:generate

# Push schema to database (development)
pnpm prisma:push

# Open Prisma Studio for data browsing
pnpm prisma:studio

# Format schema files
pnpm prisma:format
```

## Self-Hosting Considerations

For self-hosting with standard MySQL (not PlanetScale):

1. Remove `relationMode = "prisma"` from `schema.prisma`
2. Update connection string to standard MySQL format
3. Run migrations: `pnpm prisma migrate deploy`

The schema is designed to work with any MySQL-compatible database.
