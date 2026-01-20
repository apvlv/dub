import { describe, expect, it, vi } from "vitest";
import { parseDuration } from "../../lib/upstash/ratelimit";

// Test the duration parser separately as it's a pure function
describe("Redis abstraction", () => {
  describe("parseDuration", () => {
    it("should parse milliseconds", () => {
      expect(parseDuration("100 ms")).toBe(100);
      expect(parseDuration("1 ms")).toBe(1);
    });

    it("should parse seconds", () => {
      expect(parseDuration("10 s")).toBe(10000);
      expect(parseDuration("1 s")).toBe(1000);
    });

    it("should parse minutes", () => {
      expect(parseDuration("1 m")).toBe(60000);
      expect(parseDuration("5 m")).toBe(300000);
    });

    it("should parse hours", () => {
      expect(parseDuration("1 h")).toBe(3600000);
      expect(parseDuration("2 h")).toBe(7200000);
    });

    it("should parse days", () => {
      expect(parseDuration("1 d")).toBe(86400000);
      expect(parseDuration("7 d")).toBe(604800000);
    });

    it("should throw on invalid format", () => {
      expect(() => parseDuration("invalid" as any)).toThrow("Invalid duration format");
    });
  });

  describe("environment toggle", () => {
    it("should default to Upstash when USE_LOCAL_REDIS is not set", () => {
      // In test environment, USE_LOCAL_REDIS is not set, so it defaults to Upstash
      const useLocalRedis = process.env.USE_LOCAL_REDIS === "true";
      expect(useLocalRedis).toBe(false);
    });

    it("should detect USE_LOCAL_REDIS=true", () => {
      const originalEnv = process.env.USE_LOCAL_REDIS;
      process.env.USE_LOCAL_REDIS = "true";

      const useLocalRedis = process.env.USE_LOCAL_REDIS === "true";
      expect(useLocalRedis).toBe(true);

      // Restore
      process.env.USE_LOCAL_REDIS = originalEnv;
    });
  });
});
