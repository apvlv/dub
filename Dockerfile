# Dub - Multi-stage Dockerfile
# Supports both development and production builds
#
# Build arguments:
#   NODE_ENV - Environment (development or production)
#
# Targets:
#   development - For local development with hot reloading
#   production  - Optimized production build (default)

# ================================
# Base Stage - Common dependencies
# ================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    openssl \
    && corepack enable \
    && corepack prepare pnpm@8.6.10 --activate

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# ================================
# Dependencies Stage
# ================================
FROM base AS dependencies

# Copy all package.json files first for better caching
COPY apps/web/package.json ./apps/web/
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY packages/email/package.json ./packages/email/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/cli/package.json ./packages/cli/
COPY packages/stripe-app/package.json ./packages/stripe-app/
COPY packages/hubspot-app/package.json ./packages/hubspot-app/
COPY packages/embeds/core/package.json ./packages/embeds/core/
COPY packages/embeds/react/package.json ./packages/embeds/react/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ================================
# Development Stage
# ================================
FROM base AS development

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Expose ports
EXPOSE 3000 9229 5555

# Start development server
CMD ["pnpm", "dev"]

# ================================
# Builder Stage - Build production assets
# ================================
FROM base AS builder

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build the application
RUN pnpm build

# Remove development dependencies
RUN pnpm prune --prod

# ================================
# Production Stage - Minimal runtime image
# ================================
FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Install only runtime dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    openssl \
    dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy built assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/packages/prisma ./packages/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma ./node_modules/.prisma

# Set user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/web/server.js"]
