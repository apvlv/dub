import { get } from "@vercel/edge-config";
import { configClient } from "../config";
import { ConfigKey } from "../config/types";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

type UpdateConfigKey =
  | "domains"
  | "whitelistedDomains"
  | "terms"
  | "referrers"
  | "keys"
  | "whitelist"
  | "emails"
  | "reserved"
  | "reservedUsernames"
  | "partnersPortal";

export const updateConfig = async ({
  key,
  value,
}: {
  key: UpdateConfigKey;
  value: string;
}) => {
  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    try {
      await configClient.update(key as ConfigKey, value);
      return { ok: true };
    } catch (e) {
      console.error(`Error updating config key "${key}" with local config:`, e);
      throw e;
    }
  }

  // For dub.co production, use Vercel Edge Config API
  if (!process.env.EDGE_CONFIG_ID) {
    return;
  }

  const existingData = (await get(key)) as string[];
  const newData = Array.from(new Set([...existingData, value]));

  return await fetch(
    `https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            operation: "update",
            key: key,
            value: newData,
          },
        ],
      }),
    },
  );
};

/**
 * Remove a value from a configuration list (local config only)
 */
export const removeFromConfig = async ({
  key,
  value,
}: {
  key: UpdateConfigKey;
  value: string;
}) => {
  if (!USE_LOCAL_CONFIG) {
    throw new Error(
      "removeFromConfig is only supported with local config (USE_LOCAL_CONFIG=true)",
    );
  }

  try {
    await configClient.remove(key as ConfigKey, value);
    return { ok: true };
  } catch (e) {
    console.error(
      `Error removing from config key "${key}" with local config:`,
      e,
    );
    throw e;
  }
};

/**
 * Set a configuration value (replace entirely, local config only)
 */
export const setConfig = async ({
  key,
  value,
}: {
  key: ConfigKey;
  value: string[] | Record<string, string[]>;
}) => {
  if (!USE_LOCAL_CONFIG) {
    throw new Error(
      "setConfig is only supported with local config (USE_LOCAL_CONFIG=true)",
    );
  }

  try {
    await configClient.set(key, value as any);
    return { ok: true };
  } catch (e) {
    console.error(`Error setting config key "${key}" with local config:`, e);
    throw e;
  }
};

/**
 * Clear the config cache for a specific key or all keys (local config only)
 */
export const clearConfigCache = async (key?: ConfigKey) => {
  if (!USE_LOCAL_CONFIG) {
    return; // No-op for Edge Config
  }

  try {
    await configClient.clearCache(key);
    return { ok: true };
  } catch (e) {
    console.error(`Error clearing config cache:`, e);
    throw e;
  }
};
