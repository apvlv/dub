import { Tinybird } from "@chronark/zod-bird";
import * as z from "zod/v4";

// Environment check for local ClickHouse
const USE_LOCAL_CLICKHOUSE = process.env.USE_LOCAL_CLICKHOUSE === "true";
const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST || "localhost";
const CLICKHOUSE_PORT = process.env.CLICKHOUSE_PORT || "8123";
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || "dub";
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "default";
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || "";
const CLICKHOUSE_URL =
  process.env.CLICKHOUSE_URL ||
  `http://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}`;

/**
 * ClickHouse abstraction layer that supports both Tinybird and self-hosted ClickHouse
 *
 * This provides a unified API for:
 * - Tinybird (managed ClickHouse, used in production with Vercel)
 * - Self-hosted ClickHouse (used in Docker deployments)
 *
 * Toggle between them using:
 * - USE_LOCAL_CLICKHOUSE=true - Use self-hosted ClickHouse
 * - USE_LOCAL_CLICKHOUSE=false (default) - Use Tinybird
 */

// Mapping from Tinybird datasource names to local ClickHouse table names
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

// Types for ingest options
interface IngestOptions<T extends z.ZodTypeAny> {
  datasource: string;
  event: T;
  wait?: boolean;
}

// Types for pipe options
interface PipeOptions<TParams extends z.ZodTypeAny, TData extends z.ZodTypeAny> {
  pipe: string;
  parameters: TParams;
  data: TData;
}

/**
 * Local ClickHouse client that mimics Tinybird's API
 */
class LocalClickHouseClient {
  private baseUrl: string;
  private database: string;
  private user: string;
  private password: string;

  constructor() {
    this.baseUrl = CLICKHOUSE_URL;
    this.database = CLICKHOUSE_DATABASE;
    this.user = CLICKHOUSE_USER;
    this.password = CLICKHOUSE_PASSWORD;
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (this.user && this.password) {
      headers["X-ClickHouse-User"] = this.user;
      headers["X-ClickHouse-Key"] = this.password;
    } else if (this.user) {
      headers["X-ClickHouse-User"] = this.user;
    }
    return headers;
  }

  /**
   * Execute a raw SQL query
   */
  async query<T>(sql: string): Promise<{ data: T[] }> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("database", this.database);
    url.searchParams.set("default_format", "JSONEachRow");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: sql,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickHouse query failed: ${errorText}`);
    }

    const text = await response.text();
    if (!text.trim()) {
      return { data: [] };
    }

    // Parse JSONEachRow format (one JSON object per line)
    const lines = text.trim().split("\n");
    const data = lines.map((line) => JSON.parse(line) as T);
    return { data };
  }

  /**
   * Insert data into a table
   */
  async insert<T extends Record<string, any>>(
    table: string,
    data: T | T[]
  ): Promise<void> {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return;

    const url = new URL(this.baseUrl);
    url.searchParams.set("database", this.database);
    url.searchParams.set(
      "query",
      `INSERT INTO ${table} FORMAT JSONEachRow`
    );

    // Convert data to JSONEachRow format (one JSON object per line)
    const body = rows.map((row) => JSON.stringify(row)).join("\n");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ClickHouse insert failed: ${errorText}`);
    }
  }

  /**
   * Build an ingest endpoint function (mimics Tinybird's buildIngestEndpoint)
   */
  buildIngestEndpoint<T extends z.ZodTypeAny>(options: IngestOptions<T>) {
    const tableName =
      DATASOURCE_TO_TABLE[options.datasource] || options.datasource;

    return async (data: z.infer<T> | z.infer<T>[]): Promise<{ success: boolean }> => {
      const rows = Array.isArray(data) ? data : [data];
      const validatedRows = rows.map((row) => options.event.parse(row));

      await this.insert(tableName, validatedRows);
      return { success: true };
    };
  }

  /**
   * Build a pipe function (mimics Tinybird's buildPipe)
   * This executes SQL queries that mimic Tinybird pipes
   */
  buildPipe<TParams extends z.ZodTypeAny, TData extends z.ZodTypeAny>(
    options: PipeOptions<TParams, TData>
  ) {
    return async (
      params: z.infer<TParams>
    ): Promise<{ data: z.infer<TData>[] }> => {
      const sql = this.buildPipeSQL(options.pipe, params);
      const result = await this.query<z.infer<TData>>(sql);

      // Validate response data
      const validatedData = result.data.map((row) => options.data.parse(row));
      return { data: validatedData };
    };
  }

  /**
   * Build SQL query for a specific pipe
   * This translates Tinybird pipe names to equivalent ClickHouse queries
   */
  private buildPipeSQL(pipeName: string, params: Record<string, any>): string {
    switch (pipeName) {
      case "get_click_event":
        return `
          SELECT *
          FROM click_events
          WHERE click_id = '${this.escapeString(params.clickId)}'
          ORDER BY timestamp DESC
          LIMIT 1
        `;

      case "get_lead_event":
        let leadSql = `
          SELECT *
          FROM lead_events
          WHERE customer_id = '${this.escapeString(params.customerId)}'
        `;
        if (params.eventName) {
          leadSql += ` AND event_name = '${this.escapeString(params.eventName)}'`;
        }
        leadSql += ` ORDER BY timestamp DESC LIMIT 100`;
        return leadSql;

      case "get_lead_events":
        const customerIds = params.customerIds
          .map((id: string) => `'${this.escapeString(id)}'`)
          .join(",");
        return `
          SELECT *
          FROM lead_events
          WHERE customer_id IN (${customerIds})
          ORDER BY timestamp DESC
        `;

      case "get_webhook_events":
        return `
          SELECT *
          FROM webhook_events
          WHERE webhook_id = '${this.escapeString(params.webhookId)}'
          ORDER BY timestamp DESC
          LIMIT 100
        `;

      case "get_import_error_logs":
        return `
          SELECT *
          FROM import_error_logs
          WHERE workspace_id = '${this.escapeString(params.workspaceId)}'
            AND import_id = '${this.escapeString(params.importId)}'
          ORDER BY timestamp DESC
        `;

      case "v2_customer_events":
        let customerEventsSql = `
          SELECT
            'click' as event_type,
            timestamp,
            click_id,
            link_id,
            NULL as event_id,
            NULL as event_name,
            NULL as amount,
            NULL as currency
          FROM click_events
          WHERE click_id IN (
            SELECT click_id FROM lead_events WHERE customer_id = '${this.escapeString(params.customerId)}'
          )
        `;
        if (params.linkIds && params.linkIds.length > 0) {
          const linkIds = params.linkIds
            .map((id: string) => `'${this.escapeString(id)}'`)
            .join(",");
          customerEventsSql += ` AND link_id IN (${linkIds})`;
        }
        customerEventsSql += `
          UNION ALL
          SELECT
            'lead' as event_type,
            timestamp,
            click_id,
            link_id,
            event_id,
            event_name,
            NULL as amount,
            NULL as currency
          FROM lead_events
          WHERE customer_id = '${this.escapeString(params.customerId)}'
        `;
        if (params.linkIds && params.linkIds.length > 0) {
          const linkIds = params.linkIds
            .map((id: string) => `'${this.escapeString(id)}'`)
            .join(",");
          customerEventsSql += ` AND link_id IN (${linkIds})`;
        }
        customerEventsSql += `
          UNION ALL
          SELECT
            'sale' as event_type,
            timestamp,
            click_id,
            link_id,
            event_id,
            event_name,
            amount,
            currency
          FROM sale_events
          WHERE customer_id = '${this.escapeString(params.customerId)}'
        `;
        if (params.linkIds && params.linkIds.length > 0) {
          const linkIds = params.linkIds
            .map((id: string) => `'${this.escapeString(id)}'`)
            .join(",");
          customerEventsSql += ` AND link_id IN (${linkIds})`;
        }
        customerEventsSql += ` ORDER BY timestamp DESC`;
        return customerEventsSql;

      case "v3_group_by_link_country":
        const linkIdsList = params.linkIds
          .map((id: string) => `'${this.escapeString(id)}'`)
          .join(",");
        return `
          SELECT
            link_id,
            country,
            count() as clicks
          FROM click_events
          WHERE link_id IN (${linkIdsList})
            AND timestamp >= parseDateTimeBestEffort('${this.escapeString(params.start)}')
            AND timestamp < parseDateTimeBestEffort('${this.escapeString(params.end)}')
          GROUP BY link_id, country
          ORDER BY clicks DESC
        `;

      default:
        throw new Error(`Unknown pipe: ${pipeName}`);
    }
  }

  /**
   * Escape a string for use in SQL queries
   */
  private escapeString(value: string): string {
    if (typeof value !== "string") return String(value);
    return value.replace(/'/g, "''").replace(/\\/g, "\\\\");
  }
}

// Create the Tinybird client for use when not using local ClickHouse
const tinybirdClient = new Tinybird({
  token: process.env.TINYBIRD_API_KEY as string,
  baseUrl: process.env.TINYBIRD_API_URL as string,
});

// Create the local ClickHouse client
const localClickHouseClient = new LocalClickHouseClient();

/**
 * Analytics client that abstracts Tinybird and local ClickHouse
 * Use this instead of importing tb directly from tinybird/client.ts
 */
class AnalyticsClient {
  private useTinybird: boolean;

  constructor() {
    this.useTinybird = !USE_LOCAL_CLICKHOUSE;
    if (USE_LOCAL_CLICKHOUSE) {
      console.log("[ClickHouse] Using local ClickHouse at", CLICKHOUSE_URL);
    }
  }

  /**
   * Build an ingest endpoint function
   */
  buildIngestEndpoint<T extends z.ZodTypeAny>(options: IngestOptions<T>) {
    if (this.useTinybird) {
      return tinybirdClient.buildIngestEndpoint(options);
    }
    return localClickHouseClient.buildIngestEndpoint(options);
  }

  /**
   * Build a pipe function
   */
  buildPipe<TParams extends z.ZodTypeAny, TData extends z.ZodTypeAny>(
    options: PipeOptions<TParams, TData>
  ) {
    if (this.useTinybird) {
      return tinybirdClient.buildPipe(options);
    }
    return localClickHouseClient.buildPipe(options);
  }

  /**
   * Execute a raw query (only available for local ClickHouse)
   */
  async query<T>(sql: string): Promise<{ data: T[] }> {
    if (this.useTinybird) {
      throw new Error("Raw queries are not supported with Tinybird");
    }
    return localClickHouseClient.query<T>(sql);
  }

  /**
   * Insert data directly (only available for local ClickHouse)
   */
  async insert<T extends Record<string, any>>(
    table: string,
    data: T | T[]
  ): Promise<void> {
    if (this.useTinybird) {
      throw new Error("Direct inserts are not supported with Tinybird");
    }
    return localClickHouseClient.insert(table, data);
  }

  /**
   * Check if using local ClickHouse
   */
  isLocal(): boolean {
    return !this.useTinybird;
  }
}

// Export the analytics client instance
export const analytics = new AnalyticsClient();

// Also export the local client for direct access when needed
export const clickhouse = localClickHouseClient;

// Export types
export type { IngestOptions, PipeOptions };

// Re-export for backwards compatibility
// This allows gradual migration from tb to analytics
export const tb = USE_LOCAL_CLICKHOUSE ? analytics : tinybirdClient;
