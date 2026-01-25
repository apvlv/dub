/**
 * Local file-based logging implementation
 *
 * Provides a simple structured logging solution for self-hosted deployments.
 * Logs to stdout/stderr by default, with optional file logging.
 *
 * Configuration via environment variables:
 * - LOG_LEVEL: debug, info, warn, error (default: info)
 * - LOG_FILE: path to log file (optional, logs to stdout if not set)
 * - LOG_FORMAT: json or pretty (default: json)
 */

import * as fs from "fs";
import * as path from "path";
import {
  LogLevel,
  LogTransport,
  Logger,
  LocalLoggerConfig,
  LOG_LEVEL_PRIORITY,
  parseLogLevel,
} from "./types";

/**
 * Format a log entry for output
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  format: "json" | "pretty" = "json",
): string {
  const timestamp = new Date().toISOString();

  if (format === "pretty") {
    const levelColors: Record<LogLevel, string> = {
      [LogLevel.debug]: "\x1b[90m", // gray
      [LogLevel.info]: "\x1b[36m", // cyan
      [LogLevel.warn]: "\x1b[33m", // yellow
      [LogLevel.error]: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";
    const color = levelColors[level];

    let output = `${timestamp} ${color}[${level.toUpperCase()}]${reset} ${message}`;
    if (data && Object.keys(data).length > 0) {
      output += `\n${JSON.stringify(data, null, 2)}`;
    }
    return output;
  }

  // JSON format (default)
  const entry = {
    timestamp,
    level,
    message,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
  return JSON.stringify(entry);
}

/**
 * Console transport - writes to stdout/stderr
 */
export class LocalConsoleTransport implements LogTransport {
  private minLevel: LogLevel;
  private format: "json" | "pretty";

  constructor(config: LocalLoggerConfig = {}) {
    this.minLevel = config.level ?? parseLogLevel(process.env.LOG_LEVEL);
    this.format =
      config.format ??
      (process.env.LOG_FORMAT as "json" | "pretty" | undefined) ??
      "json";
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const output = formatLogEntry(level, message, data, this.format);

    if (level === LogLevel.error) {
      console.error(output);
    } else if (level === LogLevel.warn) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  async flush(): Promise<void> {
    // Console logs are synchronous, nothing to flush
  }
}

/**
 * File transport - writes to a file with buffering
 */
export class LocalFileTransport implements LogTransport {
  private minLevel: LogLevel;
  private filePath: string;
  private buffer: string[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private bufferSize = 100; // Flush every N entries
  private flushIntervalMs = 5000; // Flush every 5 seconds

  constructor(config: LocalLoggerConfig) {
    this.minLevel = config.level ?? parseLogLevel(process.env.LOG_LEVEL);
    this.filePath = config.filePath ?? process.env.LOG_FILE ?? "logs/app.log";

    // Ensure log directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushIntervalMs);
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const output = formatLogEntry(level, message, data, "json");
    this.buffer.push(output);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush().catch(console.error);
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const toWrite = this.buffer.splice(0);
    const content = toWrite.join("\n") + "\n";

    try {
      await fs.promises.appendFile(this.filePath, content, "utf-8");
    } catch (error) {
      // Fallback to console on file write error
      console.error("[LocalFileTransport] Error writing to log file:", error);
      toWrite.forEach((line) => console.log(line));
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flush().catch(console.error);
  }
}

/**
 * Local logger implementation
 *
 * Supports multiple transports (console, file) and provides
 * a compatible interface with the Axiom logger.
 */
export class LocalLogger implements Logger {
  private transports: LogTransport[];

  constructor(transports?: LogTransport[]) {
    this.transports = transports ?? [new LocalConsoleTransport()];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.debug, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.info, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.warn, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.error, message, data);
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    for (const transport of this.transports) {
      transport.log(level, message, data);
    }
  }

  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush()));
  }
}

/**
 * Create a local logger instance based on environment configuration
 */
export function createLocalLogger(config?: LocalLoggerConfig): LocalLogger {
  const transports: LogTransport[] = [];

  const logFile = config?.filePath ?? process.env.LOG_FILE;

  if (logFile) {
    // File transport
    transports.push(
      new LocalFileTransport({
        ...config,
        filePath: logFile,
      }),
    );

    // Also log to console if configured
    if (config?.alsoLogToConsole !== false) {
      transports.push(new LocalConsoleTransport(config));
    }
  } else {
    // Console-only transport
    transports.push(new LocalConsoleTransport(config));
  }

  return new LocalLogger(transports);
}

/**
 * Singleton local logger instance
 */
export const localLogger = createLocalLogger();
