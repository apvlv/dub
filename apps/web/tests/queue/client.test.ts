import { describe, it, expect } from "vitest";
import {
  QUEUE_NAMES,
  type QueueName,
  type JobOptions,
  type JobResult,
  type WebhookJobData,
  type WorkflowJobData,
  type BatchJobData,
} from "@/lib/queue/types";

describe("Queue Types", () => {
  describe("Queue Names", () => {
    it("should export correct queue names", () => {
      expect(QUEUE_NAMES.WEBHOOKS).toBe("webhooks");
      expect(QUEUE_NAMES.WORKFLOWS).toBe("workflows");
      expect(QUEUE_NAMES.BATCH_JOBS).toBe("batch-jobs");
      expect(QUEUE_NAMES.CRON).toBe("cron");
    });

    it("should have all expected queue names", () => {
      const queueNames = Object.values(QUEUE_NAMES);
      expect(queueNames).toContain("webhooks");
      expect(queueNames).toContain("workflows");
      expect(queueNames).toContain("batch-jobs");
      expect(queueNames).toContain("cron");
      expect(queueNames.length).toBe(4);
    });
  });

  describe("Job Options", () => {
    it("should accept valid job options", () => {
      const options: JobOptions = {
        jobId: "test-job-123",
        delay: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
        priority: 1,
      };

      expect(options.jobId).toBe("test-job-123");
      expect(options.delay).toBe(5000);
      expect(options.attempts).toBe(3);
      expect(options.backoff?.type).toBe("exponential");
      expect(options.priority).toBe(1);
    });

    it("should allow partial job options", () => {
      const options: JobOptions = {
        attempts: 5,
      };

      expect(options.attempts).toBe(5);
      expect(options.jobId).toBeUndefined();
      expect(options.delay).toBeUndefined();
    });
  });

  describe("Webhook Job Data", () => {
    it("should accept valid webhook job data", () => {
      const data: WebhookJobData = {
        webhookId: "wh_123",
        webhookUrl: "https://example.com/webhook",
        webhookSecret: "secret123",
        payload: { event: "test", data: { id: "123" } },
        eventId: "evt_123",
        event: "link.created",
        receiver: "slack",
      };

      expect(data.webhookId).toBe("wh_123");
      expect(data.webhookUrl).toBe("https://example.com/webhook");
      expect(data.event).toBe("link.created");
    });
  });

  describe("Workflow Job Data", () => {
    it("should accept valid workflow job data", () => {
      const data: WorkflowJobData = {
        workflowId: "partner-approved",
        body: {
          programId: "prog_123",
          partnerId: "partner_456",
          userId: "user_789",
        },
      };

      expect(data.workflowId).toBe("partner-approved");
      expect(data.body?.programId).toBe("prog_123");
    });

    it("should allow workflow without body", () => {
      const data: WorkflowJobData = {
        workflowId: "partner-approved",
      };

      expect(data.workflowId).toBe("partner-approved");
      expect(data.body).toBeUndefined();
    });
  });

  describe("Batch Job Data", () => {
    it("should accept valid batch job data", () => {
      const data: BatchJobData = {
        queueName: "ban-partner",
        url: "/api/cron/partners/ban",
        body: { programId: "123", partnerId: "456" },
        deduplicationId: "ban-123-456",
      };

      expect(data.queueName).toBe("ban-partner");
      expect(data.url).toBe("/api/cron/partners/ban");
      expect(data.body?.programId).toBe("123");
      expect(data.deduplicationId).toBe("ban-123-456");
    });

    it("should accept send-partner-summary queue name", () => {
      const data: BatchJobData = {
        queueName: "send-partner-summary",
        url: "/api/cron/partner-program-summary/process",
        body: { programId: "123" },
        deduplicationId: "partner-program-summary-2026-01-123",
      };

      expect(data.queueName).toBe("send-partner-summary");
    });
  });

  describe("Job Result", () => {
    it("should accept valid job result", () => {
      const result: JobResult = {
        messageId: "msg_123456",
        deduplicated: false,
      };

      expect(result.messageId).toBe("msg_123456");
      expect(result.deduplicated).toBe(false);
    });

    it("should allow result without deduplicated flag", () => {
      const result: JobResult = {
        messageId: "msg_789",
      };

      expect(result.messageId).toBe("msg_789");
      expect(result.deduplicated).toBeUndefined();
    });
  });
});

describe("Environment Variable Toggle", () => {
  it("should check USE_LOCAL_QUEUE environment variable", () => {
    // Test the expected behavior of the toggle
    const USE_LOCAL_QUEUE_VALUE = process.env.USE_LOCAL_QUEUE;

    // The value should be a string or undefined
    expect(
      typeof USE_LOCAL_QUEUE_VALUE === "string" ||
        USE_LOCAL_QUEUE_VALUE === undefined,
    ).toBe(true);

    // The toggle logic: only 'true' enables local queue
    const isLocalQueue = USE_LOCAL_QUEUE_VALUE === "true";
    expect(typeof isLocalQueue).toBe("boolean");
  });
});
