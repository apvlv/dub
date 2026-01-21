import { DubApiError } from "@/lib/api/errors";
import { parseRequestBody } from "@/lib/api/utils";
import { configClient, CONFIG_DEFAULTS, ConfigKey } from "@/lib/config";
import { prisma } from "@dub/prisma";
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
    // If no admin key is set, deny all access
    return false;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === ADMIN_API_KEY;
}

const configKeySchema = z.enum([
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
]);

// GET /api/admin/config - List all configuration entries
export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const key = url.searchParams.get("key") as ConfigKey | null;

  if (key) {
    // Get a specific key
    const result = configKeySchema.safeParse(key);
    if (!result.success) {
      throw new DubApiError({
        code: "bad_request",
        message: `Invalid config key: ${key}`,
      });
    }

    const value = await configClient.get(key);
    return NextResponse.json({
      key,
      value: value ?? CONFIG_DEFAULTS[key],
    });
  }

  // Get all config entries
  const entries = await prisma.configEntry.findMany({
    orderBy: { key: "asc" },
  });

  // Merge with defaults for any missing keys
  const allKeys = Object.keys(CONFIG_DEFAULTS) as ConfigKey[];
  const result: Record<string, any> = {};

  for (const k of allKeys) {
    const entry = entries.find((e) => e.key === k);
    result[k] = entry?.value ?? CONFIG_DEFAULTS[k];
  }

  return NextResponse.json(result);
}

const updateConfigSchema = z.object({
  key: configKeySchema,
  value: z.union([
    z.array(z.string()), // For list-type configs
    z.record(z.string(), z.array(z.string())), // For betaFeatures
  ]),
});

// POST /api/admin/config - Set a configuration value
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
  const { key, value } = updateConfigSchema.parse(body);

  await configClient.set(key, value as any);

  return NextResponse.json({
    success: true,
    key,
    value,
  });
}

const addToConfigSchema = z.object({
  key: configKeySchema.exclude(["betaFeatures"]),
  value: z.string(),
});

// PATCH /api/admin/config - Add a value to a configuration list
export async function PATCH(req: Request) {
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
  const { key, value } = addToConfigSchema.parse(body);

  await configClient.update(key as ConfigKey, value);

  const updated = await configClient.get(key as ConfigKey);

  return NextResponse.json({
    success: true,
    key,
    value: updated,
  });
}

const removeFromConfigSchema = z.object({
  key: configKeySchema.exclude(["betaFeatures"]),
  value: z.string(),
});

// DELETE /api/admin/config - Remove a value from a configuration list
export async function DELETE(req: Request) {
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
  const { key, value } = removeFromConfigSchema.parse(body);

  await configClient.remove(key as ConfigKey, value);

  const updated = await configClient.get(key as ConfigKey);

  return NextResponse.json({
    success: true,
    key,
    value: updated,
  });
}
