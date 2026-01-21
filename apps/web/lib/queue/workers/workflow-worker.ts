/**
 * Workflow Worker
 *
 * Processes workflow jobs when using local BullMQ queue.
 * Executes workflow steps that would normally be handled by QStash Workflow.
 */

import { prisma } from "@dub/prisma";
import { log } from "@dub/utils";
import { JobContext, WorkflowJobData } from "../types";

// Import workflow handlers dynamically to avoid circular dependencies
type WorkflowHandler = (
  payload: Record<string, unknown>,
  ctx: { runId: string },
) => Promise<void>;

const workflowHandlers: Record<string, () => Promise<WorkflowHandler>> = {
  "partner-approved": async () => {
    const { executePartnerApprovedWorkflow } = await import(
      "./handlers/partner-approved"
    );
    return executePartnerApprovedWorkflow;
  },
};

/**
 * Process a workflow job
 */
export async function processWorkflowJob(
  ctx: JobContext<WorkflowJobData>,
): Promise<void> {
  const { job, runId, attemptsMade } = ctx;
  const data = job.data;

  console.log(`[Workflow Worker] Processing workflow ${data.workflowId}`, {
    jobId: job.id,
    runId,
    attempt: attemptsMade,
    body: data.body,
  });

  const handlerLoader = workflowHandlers[data.workflowId];

  if (!handlerLoader) {
    console.error(
      `[Workflow Worker] Unknown workflow: ${data.workflowId}`,
    );
    await log({
      message: `[Workflow Worker] Unknown workflow: ${data.workflowId}`,
      type: "errors",
    });
    return;
  }

  try {
    const handler = await handlerLoader();
    await handler(data.body || {}, { runId });

    console.log(`[Workflow Worker] Completed workflow ${data.workflowId}`, {
      jobId: job.id,
      runId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    console.error(`[Workflow Worker] Workflow ${data.workflowId} failed`, {
      jobId: job.id,
      runId,
      error: message,
    });

    await log({
      message: `[Workflow Worker] Workflow ${data.workflowId} failed: ${message}`,
      type: "errors",
    });

    throw error;
  }
}
