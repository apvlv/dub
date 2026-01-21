import { get } from "@vercel/edge-config";
import { configClient } from "../config";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

export const isBlacklistedKey = async (key: string) => {
  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    let blacklistedKeys: string[];
    try {
      blacklistedKeys = (await configClient.get("keys")) ?? [];
    } catch (e) {
      console.error("Error getting blacklisted keys from local config:", e);
      blacklistedKeys = [];
    }
    if (blacklistedKeys.length === 0) return false;
    return new RegExp(blacklistedKeys.join("|"), "i").test(key);
  }

  // For dub.co production, use Vercel Edge Config
  if (!process.env.NEXT_PUBLIC_IS_DUB || !process.env.EDGE_CONFIG) {
    return false;
  }

  let blacklistedKeys;
  try {
    blacklistedKeys = await get("keys");
  } catch (e) {
    blacklistedKeys = [];
  }
  if (blacklistedKeys.length === 0) return false;
  return new RegExp(blacklistedKeys.join("|"), "i").test(key);
};
