import { getAll } from "@vercel/edge-config";
import { configClient } from "../config";

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

export const isBlacklistedDomain = async (domain: string): Promise<boolean> => {
  if (!domain) {
    return false;
  }

  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    try {
      const {
        domains: blacklistedDomains,
        terms: blacklistedTerms,
        whitelistedDomains,
      } = await configClient.getAll(["domains", "terms", "whitelistedDomains"]);

      if (whitelistedDomains.includes(domain)) {
        console.log("Domain is whitelisted", domain);
        return false;
      }

      if (blacklistedTerms.length === 0) {
        return blacklistedDomains.includes(domain);
      }

      const blacklistedTermsRegex = new RegExp(
        blacklistedTerms
          .map((term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|"),
      );

      return (
        blacklistedDomains.includes(domain) ||
        blacklistedTermsRegex.test(domain)
      );
    } catch (e) {
      console.error("Error checking blacklisted domain with local config:", e);
      return false;
    }
  }

  // For dub.co production, use Vercel Edge Config
  if (!process.env.NEXT_PUBLIC_IS_DUB || !process.env.EDGE_CONFIG) {
    return false;
  }

  try {
    const {
      domains: blacklistedDomains,
      terms: blacklistedTerms,
      whitelistedDomains,
    } = await getAll(["domains", "terms", "whitelistedDomains"]);

    if (whitelistedDomains.includes(domain)) {
      console.log("Domain is whitelisted", domain);
      return false;
    }

    const blacklistedTermsRegex = new RegExp(
      blacklistedTerms
        .map((term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // replace special characters with escape sequences
        .join("|"),
    );

    const isBlacklisted =
      blacklistedDomains.includes(domain) || blacklistedTermsRegex.test(domain);

    if (isBlacklisted) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
};
