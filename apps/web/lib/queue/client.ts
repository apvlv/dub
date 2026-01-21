/**
 * Queue Client Abstraction
 *
 * Provides a unified interface for both QStash and BullMQ.
 */

import { Queue, QueueEvents, Worker, ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { log } from "@dub/utils";
import {
  JobOptions,
  JobResult,
  QueueName,
  QUEUE_NAMES,
  JobProcessor,
} from "./types";

// Environment configuration
const USE_LOCAL_QUEUE = process.env.USE_LOCAL_QUEUE === "true";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Singleton Redis connection for BullMQ
let redisConnection: IORedis | null = null;

/**
 * Get or create the Redis connection for BullMQ
 */
export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisConnection.on("error", (err) => {
      console.error("[Queue] Redis connection error:", err.message);
    });

    redisConnection.on("connect", () => {
      console.log("[Queue] Redis connected");
    });
  }

  return redisConnection;
}

// BullMQ queues cache
const queues = new Map<QueueName, Queue>();
const queueEvents = new Map<QueueName, QueueEvents>();

/**
 * Get or create a BullMQ queue
 */
export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!queues.has(name)) {
    const queue = new Queue<T>(name, {
      connection: getRedisConnection() as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days
          count: 5000,
        },
      },
    });

    queues.set(name, queue);
  }

  return queues.get(name)! as Queue<T>;
}

/**
 * Get queue events for a queue (for monitoring)
 */
export function getQueueEvents(name: QueueName): QueueEvents {
  if (!queueEvents.has(name)) {
    const events = new QueueEvents(name, {
      connection: getRedisConnection() as unknown as ConnectionOptions,
    });

    queueEvents.set(name, events);
  }

  return queueEvents.get(name)!;
}

/**
 * Check if local queue is enabled
 */
export function isLocalQueueEnabled(): boolean {
  return USE_LOCAL_QUEUE;
}

/**
 * Abstract Queue Client
 * Provides a unified interface for both QStash and BullMQ
 */
export class QueueClient {
  private qstash: typeof import("@upstash/qstash").Client.prototype | null =
    null;

  constructor() {
    if (USE_LOCAL_QUEUE) {
      console.log("[Queue] Using local BullMQ queue at", REDIS_URL);
    } else {
      console.log("[Queue] Using QStash cloud queue");
    }
  }

  /**
   * Get QStash client (lazy loaded)
   */
  private async getQStashClient() {
    if (!this.qstash) {
      const { Client } = await import("@upstash/qstash");
      this.qstash = new Client({
        token: process.env.QSTASH_TOKEN || "",
      });
    }
    return this.qstash;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T extends Record<string, unknown>>(
    queueName: QueueName,
    data: T,
    options?: JobOptions,
  ): Promise<JobResult> {
    if (USE_LOCAL_QUEUE) {
      return this.addJobLocal(queueName, data, options);
    } else {
      return this.addJobQStash(queueName, data, options);
    }
  }

  /**
   * Add job using BullMQ
   */
  private async addJobLocal<T extends Record<string, unknown>>(
    queueName: QueueName,
    data: T,
    options?: JobOptions,
  ): Promise<JobResult> {
    const queue = getQueue<T>(queueName);

    const job = await queue.add(queueName, data, {
      jobId: options?.jobId,
      delay: options?.delay,
      attempts: options?.attempts,
      backoff: options?.backoff,
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail,
      priority: options?.priority,
    });

    if (process.env.NODE_ENV === "development") {
      console.debug("[Queue] Job added to BullMQ", {
        queue: queueName,
        jobId: job.id,
        data,
      });
    }

    return {
      messageId: job.id!,
    };
  }

  /**
   * Add job using QStash
   */
  private async addJobQStash<T extends Record<string, unknown>>(
    queueName: QueueName,
    data: T,
    options?: JobOptions,
  ): Promise<JobResult> {
    const qstash = await this.getQStashClient();
    const { APP_DOMAIN_WITH_NGROK } = await import("@dub/utils");

    // Map queue name to endpoint
    const endpoint = this.getQStashEndpoint(queueName, data);

    const response = await qstash.publishJSON({
      url: `${APP_DOMAIN_WITH_NGROK}${endpoint}`,
      body: data,
      deduplicationId: options?.jobId,
      delay: options?.delay ? Math.floor(options.delay / 1000) : undefined, // Convert ms to seconds
      retries: options?.attempts,
    });

    if (process.env.NODE_ENV === "development") {
      console.debug("[Queue] Job added to QStash", {
        queue: queueName,
        messageId: response.messageId,
        data,
      });
    }

    return {
      messageId: response.messageId,
      deduplicated: response.deduplicated,
    };
  }

  /**
   * Add multiple jobs in a batch
   */
  async addJobs<T extends Record<string, unknown>>(
    jobs: Array<{
      queueName: QueueName;
      data: T;
      options?: JobOptions;
    }>,
  ): Promise<JobResult[]> {
    if (USE_LOCAL_QUEUE) {
      return this.addJobsLocal(jobs);
    } else {
      return this.addJobsQStash(jobs);
    }
  }

  /**
   * Add batch jobs using BullMQ
   */
  private async addJobsLocal<T extends Record<string, unknown>>(
    jobs: Array<{
      queueName: QueueName;
      data: T;
      options?: JobOptions;
    }>,
  ): Promise<JobResult[]> {
    const results: JobResult[] = [];

    // Group jobs by queue
    const jobsByQueue = new Map<QueueName, typeof jobs>();
    for (const job of jobs) {
      if (!jobsByQueue.has(job.queueName)) {
        jobsByQueue.set(job.queueName, []);
      }
      jobsByQueue.get(job.queueName)!.push(job);
    }

    // Add jobs to each queue
    for (const [queueName, queueJobs] of jobsByQueue) {
      const queue = getQueue<T>(queueName);

      const bulkJobs = queueJobs.map((job) => ({
        name: queueName,
        data: job.data,
        opts: {
          jobId: job.options?.jobId,
          delay: job.options?.delay,
          attempts: job.options?.attempts,
          backoff: job.options?.backoff,
          removeOnComplete: job.options?.removeOnComplete,
          removeOnFail: job.options?.removeOnFail,
          priority: job.options?.priority,
        },
      }));

      const addedJobs = await queue.addBulk(bulkJobs);

      for (const addedJob of addedJobs) {
        results.push({ messageId: addedJob.id! });
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[Queue] Batch jobs added to BullMQ", {
        count: results.length,
      });
    }

    return results;
  }

  /**
   * Add batch jobs using QStash
   */
  private async addJobsQStash<T extends Record<string, unknown>>(
    jobs: Array<{
      queueName: QueueName;
      data: T;
      options?: JobOptions;
    }>,
  ): Promise<JobResult[]> {
    const qstash = await this.getQStashClient();
    const { APP_DOMAIN_WITH_NGROK } = await import("@dub/utils");

    const batchJobs = jobs.map((job) => ({
      url: `${APP_DOMAIN_WITH_NGROK}${this.getQStashEndpoint(job.queueName, job.data)}`,
      body: job.data,
      deduplicationId: job.options?.jobId,
      delay: job.options?.delay
        ? Math.floor(job.options.delay / 1000)
        : undefined,
      retries: job.options?.attempts,
    }));

    const responses = await qstash.batchJSON(batchJobs);

    if (process.env.NODE_ENV === "development") {
      console.debug("[Queue] Batch jobs added to QStash", {
        count: responses.length,
      });
    }

    return responses.map((r) => ({
      messageId: r.messageId,
      deduplicated: r.deduplicated,
    }));
  }

  /**
   * Map queue name to QStash endpoint
   */
  private getQStashEndpoint(
    queueName: QueueName,
    data: Record<string, unknown>,
  ): string {
    switch (queueName) {
      case QUEUE_NAMES.WEBHOOKS:
        return "/api/webhooks/deliver";
      case QUEUE_NAMES.WORKFLOWS:
        return `/api/workflows/${data.workflowId || "unknown"}`;
      case QUEUE_NAMES.BATCH_JOBS:
        return (data.url as string) || "/api/cron/process";
      case QUEUE_NAMES.CRON:
        return (data.url as string) || "/api/cron/process";
      default:
        return "/api/queue/process";
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (USE_LOCAL_QUEUE) {
      // Close all queues
      for (const queue of queues.values()) {
        await queue.close();
      }

      // Close all queue events
      for (const events of queueEvents.values()) {
        await events.close();
      }

      // Close Redis connection
      if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
      }

      queues.clear();
      queueEvents.clear();
    }
  }
}

// Singleton instance
let queueClient: QueueClient | null = null;

/**
 * Get the queue client singleton
 */
export function getQueueClient(): QueueClient {
  if (!queueClient) {
    queueClient = new QueueClient();
  }
  return queueClient;
}

/**
 * Create a BullMQ worker for a queue
 * Only used when USE_LOCAL_QUEUE=true
 */
export function createWorker<T>(
  queueName: QueueName,
  processor: JobProcessor<T>,
  options?: {
    concurrency?: number;
    limiter?: {
      max: number;
      duration: number;
    };
  },
): Worker<T> | null {
  if (!USE_LOCAL_QUEUE) {
    console.warn(
      "[Queue] createWorker called but USE_LOCAL_QUEUE is not enabled",
    );
    return null;
  }

  const worker = new Worker<T>(
    queueName,
    async (job) => {
      const ctx = {
        job,
        runId: `${queueName}-${job.id}-${Date.now()}`,
        attemptsMade: job.attemptsMade,
      };

      try {
        await processor(ctx);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);

        console.error(`[Queue] Job ${job.id} failed:`, message);

        await log({
          message: `[Queue] Job failed in ${queueName}: ${message}`,
          type: "errors",
        });

        throw error;
      }
    },
    {
      connection: getRedisConnection() as unknown as ConnectionOptions,
      concurrency: options?.concurrency ?? 10,
      limiter: options?.limiter,
    },
  );

  worker.on("completed", (job) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[Queue] Job ${job.id} completed in ${queueName}`);
    }
  });

  worker.on("failed", (job, error) => {
    console.error(`[Queue] Job ${job?.id} failed in ${queueName}:`, error);
  });

  worker.on("error", (error) => {
    console.error(`[Queue] Worker error in ${queueName}:`, error);
  });

  return worker;
}

// Export queue names
export { QUEUE_NAMES };
