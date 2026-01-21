import { get } from "@vercel/edge-config";
import { configClient } from "../config";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

export const isBlacklistedEmail = async (email: string | string[]) => {
  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    let blacklistedEmails: string[];
    try {
      blacklistedEmails = (await configClient.get("emails")) ?? [];
    } catch (e) {
      console.error("Error getting blacklisted emails from local config:", e);
      blacklistedEmails = [];
    }
    if (blacklistedEmails.length === 0) return false;

    if (Array.isArray(email)) {
      return email.some((e) =>
        new RegExp(blacklistedEmails.join("|"), "i").test(e),
      );
    }

    return new RegExp(blacklistedEmails.join("|"), "i").test(email);
  }

  // For dub.co production, use Vercel Edge Config
  if (!process.env.NEXT_PUBLIC_IS_DUB || !process.env.EDGE_CONFIG) {
    return false;
  }

  let blacklistedEmails;
  try {
    blacklistedEmails = await get("emails");
  } catch (e) {
    blacklistedEmails = [];
  }
  if (blacklistedEmails.length === 0) return false;

  if (Array.isArray(email)) {
    return email.some((e) =>
      new RegExp(blacklistedEmails.join("|"), "i").test(e),
    );
  }

  return new RegExp(blacklistedEmails.join("|"), "i").test(email);
};
