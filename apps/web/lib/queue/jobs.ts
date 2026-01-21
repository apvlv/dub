/**
 * Job helper functions for common queue operations
 */

import { log } from "@dub/utils";
import { getQueueClient, isLocalQueueEnabled, QUEUE_NAMES } from "./client";
import {
  WebhookJobData,
  WorkflowJobData,
  BatchJobData,
  BatchJobType,
  JobOptions,
  JobResult,
} from "./types";

const queueClient = getQueueClient();

/**
 * Send a webhook to a URL
 */
export async function enqueueWebhook(
  data: WebhookJobData,
  options?: JobOptions,
): Promise<JobResult> {
  return queueClient.addJob(
    QUEUE_NAMES.WEBHOOKS,
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      ...options,
      jobId: options?.jobId || `webhook-${data.webhookId}-${data.eventId}`,
      attempts: options?.attempts ?? 5,
      backoff: options?.backoff ?? {
        type: "exponential",
        delay: 1000,
      },
    },
  );
}

/**
 * Send multiple webhooks
 */
export async function enqueueWebhooks(
  webhooks: WebhookJobData[],
  options?: JobOptions,
): Promise<JobResult[]> {
  return queueClient.addJobs(
    webhooks.map((data) => ({
      queueName: QUEUE_NAMES.WEBHOOKS,
      data: {
        ...data,
        timestamp: Date.now(),
      },
      options: {
        ...options,
        jobId: options?.jobId || `webhook-${data.webhookId}-${data.eventId}`,
        attempts: options?.attempts ?? 5,
        backoff: options?.backoff ?? {
          type: "exponential",
          delay: 1000,
        },
      },
    })),
  );
}

/**
 * Trigger a workflow
 */
export async function enqueueWorkflow(
  data: WorkflowJobData,
  options?: JobOptions,
): Promise<JobResult> {
  return queueClient.addJob(
    QUEUE_NAMES.WORKFLOWS,
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      ...options,
      jobId:
        options?.jobId ||
        `workflow-${data.workflowId}-${JSON.stringify(data.body || {})}-${Date.now()}`,
      attempts: options?.attempts ?? 3,
    },
  );
}

/**
 * Trigger multiple workflows
 */
export async function enqueueWorkflows(
  workflows: WorkflowJobData[],
  options?: JobOptions,
): Promise<JobResult[]> {
  return queueClient.addJobs(
    workflows.map((data) => ({
      queueName: QUEUE_NAMES.WORKFLOWS,
      data: {
        ...data,
        timestamp: Date.now(),
      },
      options: {
        ...options,
        jobId:
          options?.jobId ||
          `workflow-${data.workflowId}-${JSON.stringify(data.body || {})}-${Date.now()}`,
        attempts: options?.attempts ?? 3,
      },
    })),
  );
}

/**
 * Enqueue a batch job (for cron-like processing)
 */
export async function enqueueBatchJob(
  data: BatchJobData,
  options?: JobOptions,
): Promise<JobResult> {
  return queueClient.addJob(
    QUEUE_NAMES.BATCH_JOBS,
    {
      ...data,
      timestamp: Date.now(),
    },
    {
      ...options,
      jobId: options?.jobId || data.deduplicationId,
      attempts: options?.attempts ?? 3,
    },
  );
}

/**
 * Enqueue multiple batch jobs
 */
export async function enqueueBatchJobs(
  jobs: BatchJobData[],
  options?: JobOptions,
): Promise<JobResult[]> {
  try {
    const results = await queueClient.addJobs(
      jobs.map((data) => ({
        queueName: QUEUE_NAMES.BATCH_JOBS,
        data: {
          ...data,
          timestamp: Date.now(),
        },
        options: {
          ...options,
          jobId: options?.jobId || data.deduplicationId,
          attempts: options?.attempts ?? 3,
        },
      })),
    );

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[enqueueBatchJobs] ${results.length} batch jobs enqueued successfully.`,
        { jobs },
      );
    }

    return results;
  } catch (error) {
    console.error("[enqueueBatchJobs] Failed to enqueue batch jobs", {
      error: JSON.stringify(error, null, 2),
      jobs,
    });

    await log({
      message: `[enqueueBatchJobs] Failed to enqueue batch jobs: ${JSON.stringify(error, null, 2)}`,
      type: "errors",
      mention: true,
    });

    throw new Error(
      `Failed to enqueue batch jobs: ${JSON.stringify(error, null, 2)}`,
    );
  }
}

/**
 * Helper to convert old QStash batch job format to new format
 */
export function convertQStashBatchJob(job: {
  queueName: BatchJobType;
  url: string;
  body?: Record<string, unknown>;
  deduplicationId?: string;
}): BatchJobData {
  return {
    queueName: job.queueName,
    url: job.url,
    body: job.body,
    deduplicationId: job.deduplicationId,
  };
}

/**
 * Check if we're using the local queue
 */
export { isLocalQueueEnabled };
