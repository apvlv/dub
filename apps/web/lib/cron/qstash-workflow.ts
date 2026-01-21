import { APP_DOMAIN_WITH_NGROK, log } from "@dub/utils";
import { Client } from "@upstash/workflow";
import { enqueueWorkflows as enqueueWorkflowsBullMQ } from "@/lib/queue";

// Environment check for local queue
const USE_LOCAL_QUEUE = process.env.USE_LOCAL_QUEUE === "true";

const client = new Client({
  token: process.env.QSTASH_TOKEN || "",
});

const WORKFLOW_RETRIES = 3;
const WORKFLOW_PARALLELISM = 20;

type WorkflowIds = "partner-approved";

interface QStashWorkflow {
  workflowId: WorkflowIds;
  body?: Record<string, unknown>;
}

// Run workflows
export async function triggerWorkflows(
  input: QStashWorkflow | QStashWorkflow[],
) {
  try {
    const workflows = Array.isArray(input) ? input : [input];

    // Use BullMQ for local queue
    if (USE_LOCAL_QUEUE) {
      const results = await enqueueWorkflowsBullMQ(
        workflows.map((workflow) => ({
          workflowId: workflow.workflowId,
          body: workflow.body,
        })),
      );

      if (process.env.NODE_ENV === "development") {
        console.debug("[BullMQ] Workflows triggered", {
          count: workflows.length,
          ids: workflows.map((w) => w.workflowId),
          results,
        });
      }

      return results;
    }

    // Use QStash for cloud deployments
    const results = await client.trigger(
      workflows.map((workflow) => ({
        url: `${APP_DOMAIN_WITH_NGROK}/api/workflows/${workflow.workflowId}`,
        body: workflow.body,
        retries: WORKFLOW_RETRIES,
        flowControl: {
          key: workflow.workflowId,
          parallelism: WORKFLOW_PARALLELISM,
        },
      })),
    );

    if (process.env.NODE_ENV === "development") {
      console.debug("[Upstash] Workflows triggered", {
        count: workflows.length,
        ids: workflows.map((w) => w.workflowId),
        results,
      });
    }

    return results;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    console.error("[Queue] Failed to trigger workflows", {
      error: message,
      input,
    });

    await log({
      message: `[Queue] Failed to trigger workflows. ${message}`,
      type: "errors",
    });

    return null;
  }
}
