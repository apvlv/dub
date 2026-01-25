/**
 * Next.js instrumentation for error handling
 *
 * Supports both Axiom and local logging for error tracking.
 * Uses USE_LOCAL_LOGGING environment variable to toggle.
 */

import { logger } from "@/lib/axiom/server";
import { USE_LOCAL_LOGGING } from "@/lib/axiom/axiom";
import { createOnRequestError } from "@axiomhq/nextjs";

/**
 * Local error handler for self-hosted deployments
 * Provides similar functionality to Axiom's createOnRequestError
 */
function createLocalOnRequestError() {
  return async (
    error: Error,
    request: {
      path: string;
      method: string;
      headers: Record<string, string>;
    },
    context: {
      routerKind: "Pages Router" | "App Router";
      routePath: string | null;
      routeType: "render" | "route" | "action" | "middleware";
      renderSource:
        | "react-server-components"
        | "react-server-components-payload"
        | "server-rendering";
      revalidateReason: "on-demand" | "stale" | undefined;
      renderType: "dynamic" | "dynamic-resume";
    },
  ) => {
    logger.error(`Request error: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      request: {
        path: request.path,
        method: request.method,
        userAgent: request.headers["user-agent"],
        ip:
          request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
          request.headers["x-real-ip"],
      },
      context: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
        revalidateReason: context.revalidateReason,
        renderType: context.renderType,
      },
    });

    await logger.flush();
  };
}

// Use local error handler for self-hosted, Axiom for cloud
export const onRequestError = USE_LOCAL_LOGGING
  ? createLocalOnRequestError()
  : createOnRequestError(logger as Parameters<typeof createOnRequestError>[0]);
