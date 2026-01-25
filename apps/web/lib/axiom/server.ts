/**
 * Server-side logging with Axiom or local logger
 *
 * Supports both Axiom cloud and local logging.
 * Toggle between them using:
 * - USE_LOCAL_LOGGING=true - Use local file/console logging (self-hosted)
 * - USE_LOCAL_LOGGING=false (default) - Use Axiom cloud logging
 *
 * Local logging environment variables:
 * - LOG_LEVEL: debug, info, warn, error (default: info)
 * - LOG_FILE: path to log file (optional, logs to stdout if not set)
 * - LOG_FORMAT: json or pretty (default: json)
 */

import {
  AxiomJSTransport,
  ConsoleTransport,
  Logger as AxiomLogger,
  LogLevel,
} from "@axiomhq/logging";
import {
  createAxiomRouteHandler,
  nextJsFormatters,
  transformRouteHandlerSuccessResult,
} from "@axiomhq/nextjs";
import { getSearchParams } from "@dub/utils";
import { NextRequest, NextResponse } from "next/server";
import {
  localLogger,
  LogLevel as LocalLogLevel,
  getLogLevelFromStatusCode as getLocalLogLevel,
} from "../logging";
import { axiomClient, USE_LOCAL_LOGGING } from "./axiom";

const isAxiomEnabled =
  !USE_LOCAL_LOGGING &&
  process.env.AXIOM_DATASET &&
  process.env.AXIOM_TOKEN &&
  axiomClient;

// Convert status code to Axiom log level
const getLogLevelFromStatusCode = (statusCode: number) => {
  if (statusCode >= 100 && statusCode < 400) {
    return LogLevel.info;
  } else if (statusCode >= 400 && statusCode < 500) {
    return LogLevel.warn;
  } else if (statusCode >= 500) {
    return LogLevel.error;
  }
  return LogLevel.info;
};

// Create Axiom logger only if enabled
const axiomLogger = isAxiomEnabled
  ? new AxiomLogger({
      transports: [
        new AxiomJSTransport({
          axiom: axiomClient!,
          dataset: process.env.AXIOM_DATASET!,
        }),
      ],
      formatters: nextJsFormatters,
    })
  : null;

// Fallback console logger for when neither Axiom nor local logging is configured
const consoleLogger = new AxiomLogger({
  transports: [new ConsoleTransport()],
  formatters: nextJsFormatters,
});

/**
 * Unified logger interface that works with both Axiom and local logging
 */
interface UnifiedLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  log(
    level: LogLevel | LocalLogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): void;
  flush(): Promise<void>;
}

/**
 * Create a unified logger that adapts between Axiom and local logging
 */
function createUnifiedLogger(): UnifiedLogger {
  if (USE_LOCAL_LOGGING) {
    console.log("[Logging] Using local logging (USE_LOCAL_LOGGING=true)");
    return {
      info: (message, data) => localLogger.info(message, data),
      warn: (message, data) => localLogger.warn(message, data),
      error: (message, data) => localLogger.error(message, data),
      debug: (message, data) => localLogger.debug(message, data),
      log: (level, message, data) => {
        // Convert Axiom LogLevel to local LogLevel if needed
        const localLevel =
          typeof level === "number"
            ? (
                {
                  [LogLevel.debug]: LocalLogLevel.debug,
                  [LogLevel.info]: LocalLogLevel.info,
                  [LogLevel.warn]: LocalLogLevel.warn,
                  [LogLevel.error]: LocalLogLevel.error,
                } as Record<LogLevel, LocalLogLevel>
              )[level]
            : (level as LocalLogLevel);
        localLogger.log(localLevel, message, data);
      },
      flush: () => localLogger.flush(),
    };
  }

  if (isAxiomEnabled && axiomLogger) {
    return {
      info: (message, data) => axiomLogger.log(LogLevel.info, message, data),
      warn: (message, data) => axiomLogger.log(LogLevel.warn, message, data),
      error: (message, data) => axiomLogger.log(LogLevel.error, message, data),
      debug: (message, data) => axiomLogger.log(LogLevel.debug, message, data),
      log: (level, message, data) => axiomLogger.log(level as LogLevel, message, data),
      flush: () => axiomLogger.flush(),
    };
  }

  // Fallback to console logger
  console.log("[Logging] Using console logging (Axiom not configured)");
  return {
    info: (message, data) => consoleLogger.log(LogLevel.info, message, data),
    warn: (message, data) => consoleLogger.log(LogLevel.warn, message, data),
    error: (message, data) => consoleLogger.log(LogLevel.error, message, data),
    debug: (message, data) => consoleLogger.log(LogLevel.debug, message, data),
    log: (level, message, data) => consoleLogger.log(level as LogLevel, message, data),
    flush: () => consoleLogger.flush(),
  };
}

export const logger = createUnifiedLogger();

/**
 * Route handler wrapper type
 */
type RouteHandler = (
  req: NextRequest,
  context?: { params?: Record<string, string | string[]> },
) => Promise<NextResponse> | NextResponse;

/**
 * Create a route handler wrapper for local logging
 * Provides similar functionality to withAxiom for local deployments
 */
function createLocalRouteHandler(
  options?: {
    onSuccess?: (data: {
      req: NextRequest;
      res: NextResponse;
      duration: number;
    }) => Promise<void>;
  },
): (handler: RouteHandler) => RouteHandler {
  return (handler: RouteHandler): RouteHandler => {
    return async (req, context) => {
      const startTime = Date.now();

      try {
        const res = await handler(req, context);
        const duration = Date.now() - startTime;

        if (options?.onSuccess) {
          await options.onSuccess({ req, res, duration });
        } else {
          // Default logging
          const logLevel = getLocalLogLevel(res.status);
          const url = new URL(req.url);
          logger.log(logLevel, `${req.method} ${url.pathname}`, {
            request: {
              method: req.method,
              url: req.url,
              path: url.pathname,
              host: url.host,
              status: res.status,
              duration,
            },
          });
        }

        await logger.flush();
        return res;
      } catch (error) {
        const duration = Date.now() - startTime;
        const url = new URL(req.url);

        logger.error(`${req.method} ${url.pathname} - Error`, {
          request: {
            method: req.method,
            url: req.url,
            path: url.pathname,
            host: url.host,
            duration,
          },
          error: {
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        await logger.flush();
        throw error;
      }
    };
  };
}

/**
 * Route handler wrapper with body logging
 * Uses Axiom's createAxiomRouteHandler when available, falls back to local logging
 */
export const withAxiomBodyLog = USE_LOCAL_LOGGING
  ? createLocalRouteHandler({
      onSuccess: async ({ req, res, duration }) => {
        const url = new URL(req.url);
        const logLevel = getLocalLogLevel(res.status);

        const report: Record<string, unknown> = {
          request: {
            method: req.method,
            url: req.url,
            path: url.pathname,
            host: url.host,
            status: res.status,
            duration,
          },
        };

        // Add body to report if the method is POST, PATCH, or PUT
        if (["POST", "PATCH", "PUT"].includes(req.method)) {
          try {
            // Clone the request to read the body
            const clonedReq = req.clone();
            report.body = await clonedReq.json();
          } catch {
            // Body might be empty, invalid JSON
            // Silently skip adding body to report
          }
        }

        // Add search params to report
        report.searchParams = getSearchParams(req.url);

        logger.log(logLevel, `${req.method} ${url.pathname}`, report);
      },
    })
  : isAxiomEnabled && axiomLogger
    ? createAxiomRouteHandler(axiomLogger, {
        onSuccess: async (data) => {
          const [message, report] = transformRouteHandlerSuccessResult(data);

          // Add body to report if the method is POST, PATCH, or PUT
          if (["POST", "PATCH", "PUT"].includes(data.req.method)) {
            try {
              report.body = await data.req.json();
            } catch {
              // Body might be empty, invalid JSON
              // Silently skip adding body to report
            }
          }

          // Add search params to report
          report.searchParams = getSearchParams(data.req.url);

          axiomLogger!.log(
            getLogLevelFromStatusCode(data.res.status),
            message,
            report,
          );
          await axiomLogger!.flush();
        },
      })
    : createLocalRouteHandler();

/**
 * Simple route handler wrapper
 * Uses Axiom's createAxiomRouteHandler when available, falls back to local logging
 */
export const withAxiom = USE_LOCAL_LOGGING
  ? createLocalRouteHandler()
  : isAxiomEnabled && axiomLogger
    ? createAxiomRouteHandler(axiomLogger)
    : createLocalRouteHandler();

// Re-export LogLevel for compatibility with existing code
export { LogLevel } from "@axiomhq/logging";
