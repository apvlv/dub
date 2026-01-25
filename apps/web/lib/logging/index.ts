/**
 * Logging module exports
 *
 * Provides a unified logging interface that supports both Axiom and local logging.
 *
 * Configuration:
 * - USE_LOCAL_LOGGING=true - Use local file/console logging (self-hosted)
 * - USE_LOCAL_LOGGING=false (default) - Use Axiom logging
 *
 * Local logging environment variables:
 * - LOG_LEVEL: debug, info, warn, error (default: info)
 * - LOG_FILE: path to log file (optional, logs to stdout if not set)
 * - LOG_FORMAT: json or pretty (default: json)
 */

export * from "./types";
export * from "./local-logger";
