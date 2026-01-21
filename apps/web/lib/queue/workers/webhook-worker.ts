/**
 * Webhook Worker
 *
 * Processes webhook delivery jobs when using local BullMQ queue.
 * Replicates QStash webhook delivery functionality with retry and callback support.
 */

import { recordWebhookEvent } from "@/lib/tinybird/record-webhook-event";
import {
  handleWebhookFailure,
  resetWebhookFailureCount,
} from "@/lib/webhook/failure";
import { handleExternalPayoutEvent } from "@/lib/webhook/handle-external-payout-event";
import { createWebhookSignature } from "@/lib/webhook/signature";
import { formatEventForSegment } from "@/lib/integrations/segment/transform";
import { createSegmentBasicAuthHeader } from "@/lib/integrations/segment/utils";
import { formatEventForSlack } from "@/lib/integrations/slack/transform";
import { prisma } from "@dub/prisma";
import { WebhookReceiver } from "@dub/prisma/client";
import { log } from "@dub/utils";
import { JobContext, WebhookJobData } from "../types";

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 30000, 120000, 600000]; // 1s, 5s, 30s, 2m, 10m

/**
 * Process a webhook delivery job
 */
export async function processWebhookJob(
  ctx: JobContext<WebhookJobData>,
): Promise<void> {
  const { job, runId, attemptsMade } = ctx;
  const data = job.data;

  console.log(`[Webhook Worker] Processing job ${job.id}`, {
    webhookId: data.webhookId,
    eventId: data.eventId,
    event: data.event,
    attempt: attemptsMade,
    runId,
  });

  // Get the webhook to check current state
  const webhook = await prisma.webhook.findUnique({
    where: { id: data.webhookId },
  });

  if (!webhook) {
    console.warn(`[Webhook Worker] Webhook ${data.webhookId} not found`);
    return;
  }

  // Transform payload based on receiver
  const receiver = (data.receiver || webhook.receiver) as WebhookReceiver;
  const finalPayload = transformPayload(data.payload, receiver);

  // Create signature
  const signature = await createWebhookSignature(
    data.webhookSecret,
    finalPayload,
  );

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Dub-Signature": signature,
  };

  // Add integration-specific headers
  if (receiver === "segment") {
    headers["Authorization"] = createSegmentBasicAuthHeader(data.webhookSecret);
  }

  let response: Response | null = null;
  let error: Error | null = null;
  let statusCode = -1;
  let responseBody = "";

  try {
    response = await fetch(data.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(finalPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    statusCode = response.status;
    responseBody = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${statusCode}: ${responseBody}`);
    }

    console.log(`[Webhook Worker] Successfully delivered webhook ${job.id}`, {
      webhookId: data.webhookId,
      eventId: data.eventId,
      status: statusCode,
    });
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    console.error(`[Webhook Worker] Failed to deliver webhook ${job.id}`, {
      error: error.message,
      webhookId: data.webhookId,
      attempt: attemptsMade,
    });
  }

  const isFailed = statusCode >= 400 || statusCode === -1;
  const isLastAttempt = attemptsMade >= MAX_RETRIES;

  // Handle Zapier unsubscription
  if (webhook.receiver === "zapier" && webhook.installationId && statusCode === 410) {
    await prisma.webhook.delete({
      where: { id: data.webhookId },
    });
    console.log(`[Webhook Worker] Unsubscribed Zapier webhook ${data.webhookId}`);
    return;
  }

  // Record the webhook event
  await Promise.allSettled([
    recordWebhookEvent({
      url: data.webhookUrl,
      event: data.event,
      event_id: data.eventId,
      http_status: statusCode === -1 ? 503 : statusCode,
      webhook_id: data.webhookId,
      request_body: JSON.stringify(finalPayload),
      response_body: responseBody,
      message_id: job.id?.toString() || runId,
    }),

    // Handle the webhook delivery failure if it's the last retry
    ...(isFailed && isLastAttempt ? [handleWebhookFailure(data.webhookId)] : []),

    // Only reset if there were previous failures and this succeeded
    ...(webhook.consecutiveFailures > 0 && !isFailed
      ? [resetWebhookFailureCount(data.webhookId)]
      : []),

    // Handle payout events
    ...(data.event === "payout.confirmed"
      ? [
          handleExternalPayoutEvent({
            webhook,
            payload: data.payload,
            status: isLastAttempt && isFailed
              ? "failure"
              : isFailed
                ? "temporary_failure"
                : "success",
          }),
        ]
      : []),
  ]);

  // Re-throw error for BullMQ retry handling
  if (error && !isLastAttempt) {
    throw error;
  }

  // Log final failure
  if (isFailed && isLastAttempt) {
    await log({
      message: `[Webhook Worker] Webhook delivery failed after ${MAX_RETRIES} attempts: ${data.webhookId}`,
      type: "errors",
    });
  }
}

/**
 * Transform the payload based on the webhook receiver
 */
function transformPayload(
  payload: Record<string, unknown>,
  receiver: WebhookReceiver,
): Record<string, unknown> {
  switch (receiver) {
    case "slack":
      return formatEventForSlack(payload as any) as unknown as Record<
        string,
        unknown
      >;
    case "segment":
      return formatEventForSegment(payload as any) as unknown as Record<
        string,
        unknown
      >;
    default:
      return payload;
  }
}
