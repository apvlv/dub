/**
 * Axiom client abstraction
 *
 * Supports both Axiom cloud and local logging.
 * Toggle between them using:
 * - USE_LOCAL_LOGGING=true - Use local file/console logging (self-hosted)
 * - USE_LOCAL_LOGGING=false (default) - Use Axiom cloud logging
 *
 * When using Axiom, requires:
 * - AXIOM_TOKEN - Axiom API token
 * - AXIOM_DATASET - Axiom dataset name
 */

import { Axiom } from "@axiomhq/js";

// Environment check for local logging
export const USE_LOCAL_LOGGING = process.env.USE_LOCAL_LOGGING === "true";

// Only create Axiom client if not using local logging and credentials exist
export const axiomClient =
  !USE_LOCAL_LOGGING && process.env.AXIOM_TOKEN
    ? new Axiom({
        token: process.env.AXIOM_TOKEN,
      })
    : null;
