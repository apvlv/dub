# Dub Self-Hosted Docker Setup

This directory contains configuration files for running Dub in a self-hosted Docker environment.

## Quick Start

### 1. Configure Environment

```bash
# Copy the example environment file
cp .env.docker.example .env.docker

# Generate a secure secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> .env.docker
```

### 2. Start Services

```bash
# Production mode
docker compose up -d

# Development mode (with hot reloading)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 3. Initialize Database

```bash
# Run Prisma migrations
docker compose exec app pnpm prisma:push
```

### 4. Access the Application

- **App**: http://localhost:8888
- **MailHog (Email)**: http://localhost:8025
- **MinIO Console**: http://localhost:9001

## Services Overview

| Service | Purpose | Ports |
|---------|---------|-------|
| `app` | Next.js application | 8888 |
| `mysql` | MySQL database | 3306 |
| `redis` | Caching & queues | 6379 |
| `clickhouse` | Analytics database | 8123, 9000 |
| `minio` | Object storage (S3) | 9000, 9001 |
| `mailhog` | Email testing | 1025, 8025 |

## Configuration Files

| File | Description |
|------|-------------|
| `docker-compose.yml` | Main services configuration |
| `docker-compose.dev.yml` | Development overrides |
| `Dockerfile` | Application container build |
| `.env.docker.example` | Environment template |
| `docker/init-mysql.sql` | MySQL initialization |
| `docker/init-clickhouse.sql` | ClickHouse schema |
| `docker/nginx.conf` | Nginx reverse proxy example |

## Production Deployment

### Using Traefik (Recommended)

```bash
# Enable Traefik reverse proxy
docker compose --profile proxy up -d
```

Configure your domain in `.env.docker`:
```env
APP_DOMAIN=dub.yourdomain.com
ACME_EMAIL=admin@yourdomain.com
```

### Using Nginx

See `docker/nginx.conf` for configuration. Install on host or add as a Docker service.

### SSL Certificates

**Option A: Traefik (automatic)**
- Traefik handles Let's Encrypt certificates automatically

**Option B: Certbot (manual)**
```bash
certbot certonly --webroot -w /var/www/certbot -d dub.yourdomain.com
```

## Data Persistence

All data is stored in named Docker volumes:
- `mysql-data` - MySQL database
- `redis-data` - Redis data
- `clickhouse-data` - ClickHouse analytics
- `minio-data` - Object storage

### Backup

```bash
# Backup MySQL
docker compose exec mysql mysqldump -u root -p dub > backup.sql

# Backup volumes
docker run --rm -v dub_mysql-data:/data -v $(pwd):/backup alpine tar czf /backup/mysql-data.tar.gz /data
```

## Development

### Hot Reloading

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This mounts source code and enables:
- Hot module replacement
- Prisma Studio at http://localhost:5555
- Redis Commander at http://localhost:8081

### Debug Mode

```bash
# Enable Node.js debugger on port 9229
docker compose -f docker-compose.yml -f docker-compose.dev.yml up app
```

### Running Tests

```bash
docker compose exec app pnpm test
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `NEXTAUTH_SECRET` | Authentication secret (32+ chars) |
| `NEXTAUTH_URL` | Public URL of the app |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | rootpassword | MySQL root password |
| `MYSQL_PASSWORD` | dubpassword | MySQL app password |

### Storage (MinIO - S3 Compatible)

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ROOT_USER` | minio | MinIO access key |
| `MINIO_ROOT_PASSWORD` | miniosecret | MinIO secret key |
| `STORAGE_ENDPOINT` | http://minio:9000 | Internal endpoint (Docker network) |
| `STORAGE_PUBLIC_ENDPOINT` | http://localhost:9000 | Public endpoint (browser-accessible signed URLs) |
| `STORAGE_BASE_URL` | http://localhost:9000/dub-public | Base URL for stored files |
| `STORAGE_PUBLIC_BUCKET` | dub-public | Public files bucket |
| `STORAGE_PRIVATE_BUCKET` | dub-private | Private files bucket |

**Note:** `STORAGE_ENDPOINT` is used for server-side operations (upload, delete) within the Docker network. `STORAGE_PUBLIC_ENDPOINT` is used for generating signed URLs that browsers can access.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs app

# Check health
docker compose ps
```

### Database connection issues

```bash
# Verify MySQL is healthy
docker compose exec mysql mysqladmin ping -u root -p

# Reset database
docker compose down -v
docker compose up -d
```

### ClickHouse not initializing

```bash
# Check ClickHouse logs
docker compose logs clickhouse

# Manually run init script
docker compose exec clickhouse clickhouse-client --query "$(cat docker/init-clickhouse.sql)"
```

## Migrating from Cloud Services

This Docker setup replaces:

| Cloud Service | Self-Hosted Replacement |
|---------------|------------------------|
| PlanetScale | MySQL container |
| Upstash Redis | Redis container |
| Tinybird | ClickHouse container |
| Cloudflare R2 | MinIO container |
| Resend | MailHog (dev) / SMTP (prod) |
| Vercel | Docker + Nginx/Traefik |

## Architecture

```
                    ┌─────────────┐
                    │   Traefik   │
                    │  (optional) │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │    App    │    │   MinIO   │    │  MailHog  │
    │ (Next.js) │    │   (S3)    │    │  (Email)  │
    └─────┬─────┘    └───────────┘    └───────────┘
          │
    ┌─────┼─────────────┬─────────────┐
    │     │             │             │
┌───▼───┐ │     ┌───────▼───────┐ ┌───▼───┐
│ MySQL │ │     │  ClickHouse   │ │ Redis │
│       │ │     │  (Analytics)  │ │       │
└───────┘ │     └───────────────┘ └───────┘
          │
    ┌─────▼─────┐
    │  Worker   │
    │ (BullMQ)  │
    └───────────┘
```

## License

See the main project LICENSE file for licensing information.
