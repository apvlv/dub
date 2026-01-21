/**
 * Type definitions for the queue abstraction layer
 */

import { Job as BullMQJob } from "bullmq";

// Job status types
export type JobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed";

// Base job options
export interface JobOptions {
  /** Unique job ID for deduplication */
  jobId?: string;
  /** Delay in milliseconds before processing */
  delay?: number;
  /** Number of retry attempts */
  attempts?: number;
  /** Backoff strategy */
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  /** Remove job on completion */
  removeOnComplete?: boolean | number;
  /** Remove job on failure */
  removeOnFail?: boolean | number;
  /** Priority (lower = higher priority) */
  priority?: number;
}

// Job result from adding to queue
export interface JobResult {
  /** Unique message/job ID */
  messageId: string;
  /** Whether the job was deduplicated */
  deduplicated?: boolean;
}

// Webhook job data
export interface WebhookJobData {
  webhookId: string;
  webhookUrl: string;
  webhookSecret: string;
  payload: Record<string, unknown>;
  eventId: string;
  event: string;
  receiver?: string;
}

// Workflow job data
export interface WorkflowJobData {
  workflowId: string;
  body?: Record<string, unknown>;
}

// Batch job types
export type BatchJobType = "ban-partner" | "send-partner-summary";

// Batch job data
export interface BatchJobData {
  queueName: BatchJobType;
  url: string;
  body?: Record<string, unknown>;
  deduplicationId?: string;
}

// Generic cron job data
export interface CronJobData {
  url: string;
  body?: Record<string, unknown>;
  method?: "GET" | "POST";
}

// Job context passed to processors
export interface JobContext<T = unknown> {
  job: BullMQJob<T> | { id: string; data: T };
  /** Unique run ID for logging */
  runId: string;
  /** Number of attempts made */
  attemptsMade: number;
}

// Processor function type
export type JobProcessor<T> = (ctx: JobContext<T>) => Promise<void>;

// Queue names
export const QUEUE_NAMES = {
  WEBHOOKS: "webhooks",
  WORKFLOWS: "workflows",
  BATCH_JOBS: "batch-jobs",
  CRON: "cron",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
