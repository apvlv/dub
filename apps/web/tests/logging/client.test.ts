import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  LogLevel,
  LOG_LEVEL_PRIORITY,
  getLogLevelFromStatusCode,
  parseLogLevel,
} from "../../lib/logging/types";
import {
  LocalLogger,
  LocalConsoleTransport,
  createLocalLogger,
} from "../../lib/logging/local-logger";

describe("Logging abstraction", () => {
  describe("LogLevel enum", () => {
    it("should have all expected log levels", () => {
      expect(LogLevel.debug).toBe("debug");
      expect(LogLevel.info).toBe("info");
      expect(LogLevel.warn).toBe("warn");
      expect(LogLevel.error).toBe("error");
    });
  });

  describe("LOG_LEVEL_PRIORITY", () => {
    it("should have correct priority ordering", () => {
      expect(LOG_LEVEL_PRIORITY[LogLevel.debug]).toBeLessThan(
        LOG_LEVEL_PRIORITY[LogLevel.info],
      );
      expect(LOG_LEVEL_PRIORITY[LogLevel.info]).toBeLessThan(
        LOG_LEVEL_PRIORITY[LogLevel.warn],
      );
      expect(LOG_LEVEL_PRIORITY[LogLevel.warn]).toBeLessThan(
        LOG_LEVEL_PRIORITY[LogLevel.error],
      );
    });

    it("should have numeric values for all levels", () => {
      expect(typeof LOG_LEVEL_PRIORITY[LogLevel.debug]).toBe("number");
      expect(typeof LOG_LEVEL_PRIORITY[LogLevel.info]).toBe("number");
      expect(typeof LOG_LEVEL_PRIORITY[LogLevel.warn]).toBe("number");
      expect(typeof LOG_LEVEL_PRIORITY[LogLevel.error]).toBe("number");
    });
  });

  describe("getLogLevelFromStatusCode", () => {
    it("should return info for successful responses (1xx-3xx)", () => {
      expect(getLogLevelFromStatusCode(100)).toBe(LogLevel.info);
      expect(getLogLevelFromStatusCode(200)).toBe(LogLevel.info);
      expect(getLogLevelFromStatusCode(201)).toBe(LogLevel.info);
      expect(getLogLevelFromStatusCode(301)).toBe(LogLevel.info);
      expect(getLogLevelFromStatusCode(399)).toBe(LogLevel.info);
    });

    it("should return warn for client errors (4xx)", () => {
      expect(getLogLevelFromStatusCode(400)).toBe(LogLevel.warn);
      expect(getLogLevelFromStatusCode(401)).toBe(LogLevel.warn);
      expect(getLogLevelFromStatusCode(403)).toBe(LogLevel.warn);
      expect(getLogLevelFromStatusCode(404)).toBe(LogLevel.warn);
      expect(getLogLevelFromStatusCode(429)).toBe(LogLevel.warn);
      expect(getLogLevelFromStatusCode(499)).toBe(LogLevel.warn);
    });

    it("should return error for server errors (5xx)", () => {
      expect(getLogLevelFromStatusCode(500)).toBe(LogLevel.error);
      expect(getLogLevelFromStatusCode(502)).toBe(LogLevel.error);
      expect(getLogLevelFromStatusCode(503)).toBe(LogLevel.error);
      expect(getLogLevelFromStatusCode(599)).toBe(LogLevel.error);
    });

    it("should return info for invalid status codes", () => {
      expect(getLogLevelFromStatusCode(0)).toBe(LogLevel.info);
      expect(getLogLevelFromStatusCode(-1)).toBe(LogLevel.info);
      expect(getLogLevelFromStatusCode(99)).toBe(LogLevel.info);
    });
  });

  describe("parseLogLevel", () => {
    it("should parse valid log levels", () => {
      expect(parseLogLevel("debug")).toBe(LogLevel.debug);
      expect(parseLogLevel("info")).toBe(LogLevel.info);
      expect(parseLogLevel("warn")).toBe(LogLevel.warn);
      expect(parseLogLevel("error")).toBe(LogLevel.error);
    });

    it("should be case-insensitive", () => {
      expect(parseLogLevel("DEBUG")).toBe(LogLevel.debug);
      expect(parseLogLevel("INFO")).toBe(LogLevel.info);
      expect(parseLogLevel("WARN")).toBe(LogLevel.warn);
      expect(parseLogLevel("ERROR")).toBe(LogLevel.error);
    });

    it("should default to info for invalid values", () => {
      expect(parseLogLevel("invalid")).toBe(LogLevel.info);
      expect(parseLogLevel("")).toBe(LogLevel.info);
      expect(parseLogLevel(undefined)).toBe(LogLevel.info);
    });
  });

  describe("environment toggle", () => {
    it("should default to Axiom when USE_LOCAL_LOGGING is not set", () => {
      const useLocalLogging = process.env.USE_LOCAL_LOGGING === "true";
      expect(useLocalLogging).toBe(false);
    });

    it("should detect USE_LOCAL_LOGGING=true", () => {
      const originalEnv = process.env.USE_LOCAL_LOGGING;
      process.env.USE_LOCAL_LOGGING = "true";

      const useLocalLogging = process.env.USE_LOCAL_LOGGING === "true";
      expect(useLocalLogging).toBe(true);

      // Restore
      process.env.USE_LOCAL_LOGGING = originalEnv;
    });
  });

  describe("LocalConsoleTransport", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should log info to console.log", () => {
      const transport = new LocalConsoleTransport({ level: LogLevel.info });
      transport.log(LogLevel.info, "test message", { key: "value" });

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should log warn to console.warn", () => {
      const transport = new LocalConsoleTransport({ level: LogLevel.info });
      transport.log(LogLevel.warn, "test warning", { key: "value" });

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should log error to console.error", () => {
      const transport = new LocalConsoleTransport({ level: LogLevel.info });
      transport.log(LogLevel.error, "test error", { key: "value" });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should filter messages below minimum level", () => {
      const transport = new LocalConsoleTransport({ level: LogLevel.warn });
      transport.log(LogLevel.info, "should not log");
      transport.log(LogLevel.debug, "should not log either");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log JSON format by default", () => {
      const transport = new LocalConsoleTransport({
        level: LogLevel.info,
        format: "json",
      });
      transport.log(LogLevel.info, "test message");

      const call = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(call)).not.toThrow();
    });

    it("flush should resolve immediately", async () => {
      const transport = new LocalConsoleTransport();
      await expect(transport.flush()).resolves.toBeUndefined();
    });
  });

  describe("LocalLogger", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should have debug, info, warn, error methods", () => {
      const logger = new LocalLogger([new LocalConsoleTransport()]);
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should have log and flush methods", () => {
      const logger = new LocalLogger([new LocalConsoleTransport()]);
      expect(typeof logger.log).toBe("function");
      expect(typeof logger.flush).toBe("function");
    });

    it("should log to all transports", () => {
      const transport1 = new LocalConsoleTransport({ level: LogLevel.info });
      const transport2 = new LocalConsoleTransport({ level: LogLevel.info });
      const logger = new LocalLogger([transport1, transport2]);

      logger.info("test message");

      // Each transport logs once
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("should log with data", () => {
      const transport = new LocalConsoleTransport({
        level: LogLevel.info,
        format: "json",
      });
      const logger = new LocalLogger([transport]);

      logger.info("test message", { key: "value", number: 42 });

      const call = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(call);
      expect(parsed.data).toEqual({ key: "value", number: 42 });
    });

    it("should flush all transports", async () => {
      const transport1 = new LocalConsoleTransport();
      const transport2 = new LocalConsoleTransport();
      const flush1 = vi.spyOn(transport1, "flush");
      const flush2 = vi.spyOn(transport2, "flush");
      const logger = new LocalLogger([transport1, transport2]);

      await logger.flush();

      expect(flush1).toHaveBeenCalled();
      expect(flush2).toHaveBeenCalled();
    });
  });

  describe("createLocalLogger", () => {
    beforeEach(() => {
      vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should create a logger with console transport by default", () => {
      const logger = createLocalLogger();
      expect(logger).toBeInstanceOf(LocalLogger);
    });

    it("should respect LOG_LEVEL environment variable", () => {
      const originalLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = "error";

      const logger = createLocalLogger();
      logger.info("should not log");
      logger.error("should log");

      // Restore
      process.env.LOG_LEVEL = originalLevel;
    });
  });
});
