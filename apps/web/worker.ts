/**
 * BullMQ Worker Entry Point
 *
 * This is the main entry point for the BullMQ worker process.
 * Run this as a separate process when using USE_LOCAL_QUEUE=true.
 *
 * Usage:
 *   npx tsx apps/web/worker.ts
 *   # or in Docker:
 *   node apps/web/worker.js
 */

import type { Worker } from "bullmq";
import { createWorker, QUEUE_NAMES, getRedisConnection } from "./lib/queue/client";
import { processWebhookJob } from "./lib/queue/workers/webhook-worker";
import { processWorkflowJob } from "./lib/queue/workers/workflow-worker";
import { processBatchJob } from "./lib/queue/workers/batch-worker";
import { WebhookJobData, WorkflowJobData, BatchJobData } from "./lib/queue/types";

const USE_LOCAL_QUEUE = process.env.USE_LOCAL_QUEUE === "true";

if (!USE_LOCAL_QUEUE) {
  console.error(
    "[Worker] USE_LOCAL_QUEUE is not enabled. Set USE_LOCAL_QUEUE=true to use the worker.",
  );
  process.exit(1);
}

console.log("[Worker] Starting BullMQ workers...");

// Keep track of workers for graceful shutdown
const workers: Worker[] = [];

/**
 * Start all workers
 */
async function startWorkers() {
  // Webhook worker - high concurrency for webhook delivery
  const webhookWorker = await createWorker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOKS,
    processWebhookJob,
    {
      concurrency: 20,
      limiter: {
        max: 100,
        duration: 1000, // 100 jobs per second
      },
    },
  );

  if (webhookWorker) {
    workers.push(webhookWorker);
    console.log("[Worker] Webhook worker started");
  }

  // Workflow worker - moderate concurrency for complex workflows
  const workflowWorker = await createWorker<WorkflowJobData>(
    QUEUE_NAMES.WORKFLOWS,
    processWorkflowJob,
    {
      concurrency: 10,
      limiter: {
        max: 20,
        duration: 1000, // 20 workflows per second
      },
    },
  );

  if (workflowWorker) {
    workers.push(workflowWorker);
    console.log("[Worker] Workflow worker started");
  }

  // Batch job worker - lower concurrency for resource-intensive jobs
  const batchWorker = await createWorker<BatchJobData>(
    QUEUE_NAMES.BATCH_JOBS,
    processBatchJob,
    {
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // 10 batch jobs per second
      },
    },
  );

  if (batchWorker) {
    workers.push(batchWorker);
    console.log("[Worker] Batch job worker started");
  }

  console.log(`[Worker] ${workers.length} workers started successfully`);
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}, shutting down gracefully...`);

  // Close all workers
  await Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
      } catch (error) {
        console.error("[Worker] Error closing worker:", error);
      }
    }),
  );

  // Close Redis connection
  try {
    const redis = await getRedisConnection();
    await redis.quit();
  } catch (error) {
    console.error("[Worker] Error closing Redis connection:", error);
  }

  console.log("[Worker] Shutdown complete");
  process.exit(0);
}

// Handle signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Worker] Unhandled rejection at:", promise, "reason:", reason);
});

// Start workers
startWorkers().catch((error) => {
  console.error("[Worker] Failed to start workers:", error);
  process.exit(1);
});

// Keep the process running
console.log("[Worker] Worker process is running. Press Ctrl+C to stop.");
