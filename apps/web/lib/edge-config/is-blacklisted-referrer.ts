import { getDomainWithoutWWW } from "@dub/utils";
import { get } from "@vercel/edge-config";
import { configClient } from "../config";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

export const isBlacklistedReferrer = async (referrer: string | null) => {
  const hostname = referrer ? getDomainWithoutWWW(referrer) : "(direct)";

  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    let referrers: string[];
    try {
      referrers = (await configClient.get("referrers")) ?? [];
    } catch (e) {
      console.error("Error getting referrers from local config:", e);
      referrers = [];
    }
    // If no referrers configured, allow all
    if (referrers.length === 0) return false;
    return !referrers.includes(hostname);
  }

  // For dub.co production, use Vercel Edge Config
  if (!process.env.NEXT_PUBLIC_IS_DUB || !process.env.EDGE_CONFIG) {
    return false;
  }

  let referrers;
  try {
    referrers = await get("referrers");
  } catch (e) {
    referrers = [];
  }
  return !referrers.includes(hostname);
};
