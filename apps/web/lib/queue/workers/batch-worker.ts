/**
 * Batch Job Worker
 *
 * Processes batch jobs when using local BullMQ queue.
 * Executes cron-like jobs that would normally be handled by QStash.
 */

import { log, APP_DOMAIN_WITH_NGROK } from "@dub/utils";
import { JobContext, BatchJobData } from "../types";

/**
 * Process a batch job
 *
 * This makes an HTTP request to the specified URL, simulating QStash behavior.
 * The URL points to internal cron endpoints that do the actual work.
 */
export async function processBatchJob(
  ctx: JobContext<BatchJobData>,
): Promise<void> {
  const { job, runId, attemptsMade } = ctx;
  const data = job.data;

  console.log(`[Batch Worker] Processing job ${data.queueName}`, {
    jobId: job.id,
    url: data.url,
    runId,
    attempt: attemptsMade,
  });

  // Build the full URL
  const url = data.url.startsWith("http")
    ? data.url
    : `${APP_DOMAIN_WITH_NGROK}${data.url}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add a header to indicate this is from the local queue
        "X-Queue-Source": "bullmq",
        "X-Queue-Job-Id": job.id?.toString() || runId,
        "X-Queue-Run-Id": runId,
      },
      body: data.body ? JSON.stringify(data.body) : undefined,
      signal: AbortSignal.timeout(120000), // 2 minute timeout for batch jobs
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    const responseBody = await response.text();

    console.log(`[Batch Worker] Completed job ${data.queueName}`, {
      jobId: job.id,
      status: response.status,
      response: responseBody.substring(0, 200),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    console.error(`[Batch Worker] Job ${data.queueName} failed`, {
      jobId: job.id,
      url,
      error: message,
      attempt: attemptsMade,
    });

    await log({
      message: `[Batch Worker] Job ${data.queueName} failed: ${message}`,
      type: "errors",
    });

    throw error;
  }
}
