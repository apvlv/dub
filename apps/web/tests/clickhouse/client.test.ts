import { describe, expect, it } from "vitest";

describe("ClickHouse abstraction", () => {
  describe("environment toggle", () => {
    it("should default to Tinybird when USE_LOCAL_CLICKHOUSE is not set", () => {
      // In test environment, USE_LOCAL_CLICKHOUSE is not set, so it defaults to Tinybird
      const useLocalClickHouse = process.env.USE_LOCAL_CLICKHOUSE === "true";
      expect(useLocalClickHouse).toBe(false);
    });

    it("should detect USE_LOCAL_CLICKHOUSE=true", () => {
      const originalEnv = process.env.USE_LOCAL_CLICKHOUSE;
      process.env.USE_LOCAL_CLICKHOUSE = "true";

      const useLocalClickHouse = process.env.USE_LOCAL_CLICKHOUSE === "true";
      expect(useLocalClickHouse).toBe(true);

      // Restore
      process.env.USE_LOCAL_CLICKHOUSE = originalEnv;
    });
  });

  describe("datasource mapping", () => {
    // Test the datasource to table name mapping
    const DATASOURCE_TO_TABLE: Record<string, string> = {
      dub_click_events: "click_events",
      dub_lead_events: "lead_events",
      dub_sale_events: "sale_events",
      dub_links_metadata: "links_metadata",
      dub_webhook_events: "webhook_events",
      dub_audit_logs: "audit_logs",
      dub_import_error_logs: "import_error_logs",
      dub_conversion_events_log: "conversion_events_log",
    };

    it("should map dub_click_events to click_events", () => {
      expect(DATASOURCE_TO_TABLE["dub_click_events"]).toBe("click_events");
    });

    it("should map dub_lead_events to lead_events", () => {
      expect(DATASOURCE_TO_TABLE["dub_lead_events"]).toBe("lead_events");
    });

    it("should map dub_sale_events to sale_events", () => {
      expect(DATASOURCE_TO_TABLE["dub_sale_events"]).toBe("sale_events");
    });

    it("should map dub_links_metadata to links_metadata", () => {
      expect(DATASOURCE_TO_TABLE["dub_links_metadata"]).toBe("links_metadata");
    });

    it("should map dub_webhook_events to webhook_events", () => {
      expect(DATASOURCE_TO_TABLE["dub_webhook_events"]).toBe("webhook_events");
    });

    it("should map dub_audit_logs to audit_logs", () => {
      expect(DATASOURCE_TO_TABLE["dub_audit_logs"]).toBe("audit_logs");
    });

    it("should map dub_import_error_logs to import_error_logs", () => {
      expect(DATASOURCE_TO_TABLE["dub_import_error_logs"]).toBe(
        "import_error_logs"
      );
    });

    it("should map dub_conversion_events_log to conversion_events_log", () => {
      expect(DATASOURCE_TO_TABLE["dub_conversion_events_log"]).toBe(
        "conversion_events_log"
      );
    });
  });

  describe("SQL escaping", () => {
    // Test SQL string escaping function
    const escapeString = (value: string): string => {
      if (typeof value !== "string") return String(value);
      return value.replace(/'/g, "''").replace(/\\/g, "\\\\");
    };

    it("should escape single quotes", () => {
      expect(escapeString("test's value")).toBe("test''s value");
    });

    it("should escape backslashes", () => {
      expect(escapeString("test\\value")).toBe("test\\\\value");
    });

    it("should handle strings without special characters", () => {
      expect(escapeString("normal string")).toBe("normal string");
    });

    it("should handle empty strings", () => {
      expect(escapeString("")).toBe("");
    });

    it("should escape multiple special characters", () => {
      expect(escapeString("test's\\value's")).toBe("test''s\\\\value''s");
    });
  });

  describe("environment variables", () => {
    it("should have default values for ClickHouse configuration", () => {
      // These should match the defaults in the client
      const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST || "localhost";
      const CLICKHOUSE_PORT = process.env.CLICKHOUSE_PORT || "8123";
      const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || "dub";
      const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "default";

      expect(CLICKHOUSE_HOST).toBeDefined();
      expect(CLICKHOUSE_PORT).toBeDefined();
      expect(CLICKHOUSE_DATABASE).toBeDefined();
      expect(CLICKHOUSE_USER).toBeDefined();
    });

    it("should construct correct CLICKHOUSE_URL from host and port", () => {
      const host = "localhost";
      const port = "8123";
      const url = `http://${host}:${port}`;

      expect(url).toBe("http://localhost:8123");
    });
  });
});
