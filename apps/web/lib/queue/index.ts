/**
 * Queue Abstraction Layer
 *
 * This module provides a unified API for background job processing that supports:
 * - QStash (Upstash's serverless queue - used in production with Vercel)
 * - BullMQ (self-hosted Redis-based queue - used in Docker deployments)
 *
 * Toggle between them using:
 * - USE_LOCAL_QUEUE=true - Use BullMQ with local Redis
 * - USE_LOCAL_QUEUE=false (default) - Use QStash
 *
 * Environment variables:
 * - REDIS_URL - Redis connection URL for BullMQ (default: redis://localhost:6379)
 * - QSTASH_TOKEN - QStash authentication token
 */

export * from "./client";
export * from "./types";
export * from "./jobs";
