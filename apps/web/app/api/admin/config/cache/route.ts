import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { configClient, ConfigKey } from "@/lib/config";
import { NextResponse } from "next/server";
import * as z from "zod/v4";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

// Admin API key for authentication (set in environment)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Verify admin access via API key
 */
function verifyAdminAccess(req: Request): boolean {
  if (!ADMIN_API_KEY) {
    return false;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === ADMIN_API_KEY;
}

const clearCacheSchema = z.object({
  key: z
    .enum([
      "domains",
      "whitelistedDomains",
      "terms",
      "referrers",
      "keys",
      "whitelist",
      "emails",
      "reserved",
      "reservedUsernames",
      "partnersPortal",
      "betaFeatures",
    ])
    .optional(),
});

// POST /api/admin/config/cache - Clear the config cache
export async function POST(req: Request) {
  if (!USE_LOCAL_CONFIG) {
    throw new DubApiError({
      code: "forbidden",
      message:
        "Admin config API is only available with local config (USE_LOCAL_CONFIG=true)",
    });
  }

  if (!verifyAdminAccess(req)) {
    throw new DubApiError({
      code: "unauthorized",
      message: "Invalid or missing admin API key",
    });
  }

  const body = await parseRequestBody(req);
  const { key } = clearCacheSchema.parse(body);

  await configClient.clearCache(key as ConfigKey | undefined);

  return NextResponse.json({
    success: true,
    message: key ? `Cache cleared for key: ${key}` : "All config cache cleared",
  });
}
