import { log } from "@dub/utils";
import type { PublishBatchRequest } from "@upstash/qstash";
import { qstash } from ".";
import {
  enqueueBatchJobs as enqueueBatchJobsBullMQ,
  convertQStashBatchJob,
} from "@/lib/queue";

// Environment check for local queue
const USE_LOCAL_QUEUE = process.env.USE_LOCAL_QUEUE === "true";

type EnqueueBatchJobsProps = PublishBatchRequest<unknown> & {
  queueName: "ban-partner" | "send-partner-summary";
};

// Generic helper to enqueue a batch of QStash jobs.
export async function enqueueBatchJobs(jobs: EnqueueBatchJobsProps[]) {
  try {
    // Use BullMQ for local queue
    if (USE_LOCAL_QUEUE) {
      const bullMQJobs = jobs
        .filter((job) => job.url) // Filter out jobs without URLs
        .map((job) =>
          convertQStashBatchJob({
            queueName: job.queueName,
            url: job.url as string,
            body: job.body as Record<string, unknown> | undefined,
            deduplicationId: job.deduplicationId,
          }),
        );

      const result = await enqueueBatchJobsBullMQ(bullMQJobs);

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[enqueueBatchJobs] ${result.length} batch jobs enqueued to BullMQ successfully.`,
          { jobs },
        );
      }

      return result;
    }

    // Use QStash for cloud deployments
    const result = await qstash.batchJSON(jobs);

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[enqueueBatchJobs] ${result.length} batch jobs enqueued successfully.`,
        {
          jobs,
        },
      );
    }

    return result;
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
