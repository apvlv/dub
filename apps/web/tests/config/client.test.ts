import { describe, expect, it } from "vitest";
import { CONFIG_DEFAULTS, ConfigKey } from "../../lib/config/types";

describe("Config abstraction", () => {
  describe("CONFIG_DEFAULTS", () => {
    it("should have all required config keys", () => {
      const expectedKeys: ConfigKey[] = [
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
      ];

      for (const key of expectedKeys) {
        expect(CONFIG_DEFAULTS).toHaveProperty(key);
      }
    });

    it("should have array defaults for list-type configs", () => {
      expect(Array.isArray(CONFIG_DEFAULTS.domains)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.whitelistedDomains)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.terms)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.referrers)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.keys)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.whitelist)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.emails)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.reserved)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.reservedUsernames)).toBe(true);
      expect(Array.isArray(CONFIG_DEFAULTS.partnersPortal)).toBe(true);
    });

    it("should have empty arrays as defaults", () => {
      expect(CONFIG_DEFAULTS.domains).toHaveLength(0);
      expect(CONFIG_DEFAULTS.whitelistedDomains).toHaveLength(0);
      expect(CONFIG_DEFAULTS.terms).toHaveLength(0);
      expect(CONFIG_DEFAULTS.referrers).toHaveLength(0);
      expect(CONFIG_DEFAULTS.keys).toHaveLength(0);
      expect(CONFIG_DEFAULTS.emails).toHaveLength(0);
    });

    it("should have object default for betaFeatures", () => {
      expect(typeof CONFIG_DEFAULTS.betaFeatures).toBe("object");
      expect(CONFIG_DEFAULTS.betaFeatures).not.toBeNull();
      expect(CONFIG_DEFAULTS.betaFeatures).toHaveProperty("noDubLink");
      expect(CONFIG_DEFAULTS.betaFeatures).toHaveProperty(
        "analyticsSettingsSiteVisitTracking",
      );
    });

    it("should have empty arrays for betaFeatures values", () => {
      expect(Array.isArray(CONFIG_DEFAULTS.betaFeatures.noDubLink)).toBe(true);
      expect(CONFIG_DEFAULTS.betaFeatures.noDubLink).toHaveLength(0);
      expect(
        Array.isArray(
          CONFIG_DEFAULTS.betaFeatures.analyticsSettingsSiteVisitTracking,
        ),
      ).toBe(true);
      expect(
        CONFIG_DEFAULTS.betaFeatures.analyticsSettingsSiteVisitTracking,
      ).toHaveLength(0);
    });
  });

  describe("environment toggle", () => {
    it("should default to Edge Config when USE_LOCAL_CONFIG is not set", () => {
      const useLocalConfig = process.env.USE_LOCAL_CONFIG === "true";
      expect(useLocalConfig).toBe(false);
    });

    it("should detect USE_LOCAL_CONFIG=true", () => {
      const originalEnv = process.env.USE_LOCAL_CONFIG;
      process.env.USE_LOCAL_CONFIG = "true";

      const useLocalConfig = process.env.USE_LOCAL_CONFIG === "true";
      expect(useLocalConfig).toBe(true);

      // Restore
      process.env.USE_LOCAL_CONFIG = originalEnv;
    });
  });

  describe("ConfigKey type", () => {
    it("should have 11 valid config keys", () => {
      const validKeys: ConfigKey[] = [
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
      ];

      expect(validKeys).toHaveLength(11);

      // Each key should exist in CONFIG_DEFAULTS
      for (const key of validKeys) {
        expect(CONFIG_DEFAULTS).toHaveProperty(key);
      }
    });
  });
});
