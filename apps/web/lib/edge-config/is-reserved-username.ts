import { get } from "@vercel/edge-config";
import { configClient } from "../config";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

/**
 * Only for dub.sh / dub.link domains
 * Check if a username is reserved – should only be available on Pro+
 */
export const isReservedUsername = async (key: string) => {
  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    let reservedUsernames: string[];
    try {
      reservedUsernames = (await configClient.get("reservedUsernames")) ?? [];
    } catch (e) {
      console.error(
        "Error getting reserved usernames from local config:",
        e,
      );
      reservedUsernames = [];
    }
    return reservedUsernames.includes(key.toLowerCase());
  }

  // For dub.co production, use Vercel Edge Config
  if (!process.env.NEXT_PUBLIC_IS_DUB || !process.env.EDGE_CONFIG) {
    return false;
  }

  let reservedUsernames;
  try {
    reservedUsernames = await get("reservedUsernames");
  } catch (e) {
    reservedUsernames = [];
  }
  return reservedUsernames.includes(key.toLowerCase());
};
