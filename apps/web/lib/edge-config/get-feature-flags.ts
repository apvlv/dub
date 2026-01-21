import { get } from "@vercel/edge-config";
import { prefixWorkspaceId } from "../api/workspaces/workspace-id";
import { configClient } from "../config";
import { BetaFeatures } from "../types";

type BetaFeaturesRecord = Record<BetaFeatures, string[]>;

// Environment check for local config
const USE_LOCAL_CONFIG = process.env.USE_LOCAL_CONFIG === "true";

export const getFeatureFlags = async ({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId?: string;
  workspaceSlug?: string;
}) => {
  if (workspaceId) {
    workspaceId = prefixWorkspaceId(workspaceId);
  }

  const workspaceFeatures: Record<BetaFeatures, boolean> = {
    noDubLink: false,
    analyticsSettingsSiteVisitTracking: false,
  };

  // For self-hosted with local config, use the config client
  if (USE_LOCAL_CONFIG) {
    if (!workspaceId && !workspaceSlug) {
      return workspaceFeatures;
    }

    let betaFeatures: BetaFeaturesRecord | null = null;

    try {
      betaFeatures = await configClient.get("betaFeatures");
    } catch (e) {
      console.error(`Error getting beta features from local config: ${e}`);
    }

    if (betaFeatures) {
      for (const [featureFlag, workspaceIdsOrSlugs] of Object.entries(
        betaFeatures,
      )) {
        if (
          (workspaceId && workspaceIdsOrSlugs.includes(workspaceId)) ||
          (workspaceSlug && workspaceIdsOrSlugs.includes(workspaceSlug))
        ) {
          workspaceFeatures[featureFlag as BetaFeatures] = true;
        }
      }
    }

    return workspaceFeatures;
  }

  // For dub.co production, use Vercel Edge Config
  if (!process.env.NEXT_PUBLIC_IS_DUB || !process.env.EDGE_CONFIG) {
    // return all features as true if edge config is not available
    return Object.fromEntries(
      Object.entries(workspaceFeatures).map(([key, _v]) => [key, true]),
    );
  } else if (!workspaceId && !workspaceSlug) {
    return workspaceFeatures;
  }

  let betaFeatures: BetaFeaturesRecord | undefined = undefined;

  try {
    betaFeatures = await get("betaFeatures");
  } catch (e) {
    console.error(`Error getting beta features: ${e}`);
  }

  if (betaFeatures) {
    for (const [featureFlag, workspaceIdsOrSlugs] of Object.entries(
      betaFeatures,
    )) {
      if (
        (workspaceId && workspaceIdsOrSlugs.includes(workspaceId)) ||
        (workspaceSlug && workspaceIdsOrSlugs.includes(workspaceSlug))
      ) {
        workspaceFeatures[featureFlag as BetaFeatures] = true;
      }
    }
  }

  return workspaceFeatures;
};
