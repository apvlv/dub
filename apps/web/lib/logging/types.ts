/**
 * Type definitions for logging abstraction
 * Supports both Axiom and local file-based logging
 */

/**
 * Log levels supported by the logging system
 */
export enum LogLevel {
  debug = "debug",
  info = "info",
  warn = "warn",
  error = "error",
}

/**
 * Log entry structure for structured logging
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  // Request-specific fields
  request?: {
    method?: string;
    url?: string;
    path?: string;
    host?: string;
    userAgent?: string;
    ip?: string;
    duration?: number;
    status?: number;
  };
  // Error-specific fields
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

/**
 * Configuration for the local logger
 */
export interface LocalLoggerConfig {
  /**
   * Log level threshold (default: info)
   * Only logs at or above this level will be written
   */
  level?: LogLevel;
  /**
   * Log file path (optional, defaults to stdout/stderr)
   * If provided, logs will be appended to this file
   */
  filePath?: string;
  /**
   * Whether to also log to console when file logging is enabled
   */
  alsoLogToConsole?: boolean;
  /**
   * Format: 'json' for structured JSON logs, 'pretty' for human-readable
   */
  format?: "json" | "pretty";
}

/**
 * Interface for a transport (destination) for logs
 */
export interface LogTransport {
  /**
   * Write a log entry to the transport
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;

  /**
   * Flush any buffered logs
   */
  flush(): Promise<void>;
}

/**
 * Interface for the logger
 */
export interface Logger {
  /**
   * Log at debug level
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Log at info level
   */
  info(message: string, data?: Record<string, unknown>): void;

  /**
   * Log at warn level
   */
  warn(message: string, data?: Record<string, unknown>): void;

  /**
   * Log at error level
   */
  error(message: string, data?: Record<string, unknown>): void;

  /**
   * Log at a specific level
   */
  log(level: LogLevel, message: string, data?: Record<string, unknown>): void;

  /**
   * Flush any buffered logs to their destinations
   */
  flush(): Promise<void>;
}

/**
 * Map log level string to numeric priority for comparison
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.debug]: 0,
  [LogLevel.info]: 1,
  [LogLevel.warn]: 2,
  [LogLevel.error]: 3,
};

/**
 * Convert HTTP status code to appropriate log level
 */
export function getLogLevelFromStatusCode(statusCode: number): LogLevel {
  if (statusCode >= 100 && statusCode < 400) {
    return LogLevel.info;
  } else if (statusCode >= 400 && statusCode < 500) {
    return LogLevel.warn;
  } else if (statusCode >= 500) {
    return LogLevel.error;
  }
  return LogLevel.info;
}

/**
 * Parse log level from string environment variable
 */
export function parseLogLevel(level?: string): LogLevel {
  if (!level) return LogLevel.info;
  const normalized = level.toLowerCase();
  if (normalized in LogLevel) {
    return normalized as LogLevel;
  }
  return LogLevel.info;
}
