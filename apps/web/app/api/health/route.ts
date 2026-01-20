import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint for Docker/Kubernetes container orchestration.
 *
 * Returns 200 OK if the application is running and can respond to requests.
 * Used by:
 *   - Docker HEALTHCHECK
 *   - Kubernetes liveness/readiness probes
 *   - Load balancer health checks
 *   - Monitoring systems
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
