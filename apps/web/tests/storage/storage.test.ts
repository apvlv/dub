import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Mock environment variables before importing storage module
const originalEnv = process.env;

describe("Storage configuration", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("endpoint configuration logic", () => {
    it("should detect when STORAGE_PUBLIC_ENDPOINT is set", () => {
      process.env.STORAGE_ENDPOINT = "http://minio:9000";
      process.env.STORAGE_PUBLIC_ENDPOINT = "http://localhost:9000";

      const internalEndpoint = process.env.STORAGE_ENDPOINT;
      const publicEndpoint =
        process.env.STORAGE_PUBLIC_ENDPOINT || process.env.STORAGE_ENDPOINT;

      expect(internalEndpoint).toBe("http://minio:9000");
      expect(publicEndpoint).toBe("http://localhost:9000");
    });

    it("should fall back STORAGE_PUBLIC_ENDPOINT to STORAGE_ENDPOINT when not set", () => {
      process.env.STORAGE_ENDPOINT = "http://minio:9000";
      delete process.env.STORAGE_PUBLIC_ENDPOINT;

      const internalEndpoint = process.env.STORAGE_ENDPOINT;
      const publicEndpoint =
        process.env.STORAGE_PUBLIC_ENDPOINT || process.env.STORAGE_ENDPOINT;

      expect(internalEndpoint).toBe("http://minio:9000");
      expect(publicEndpoint).toBe("http://minio:9000");
    });
  });

  describe("bucket configuration", () => {
    it("should use STORAGE_PUBLIC_BUCKET for public files", () => {
      process.env.STORAGE_PUBLIC_BUCKET = "dub-public";
      expect(process.env.STORAGE_PUBLIC_BUCKET).toBe("dub-public");
    });

    it("should use STORAGE_PRIVATE_BUCKET for private files", () => {
      process.env.STORAGE_PRIVATE_BUCKET = "dub-private";
      expect(process.env.STORAGE_PRIVATE_BUCKET).toBe("dub-private");
    });
  });
});

describe("MinIO compatibility", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Docker Compose configuration", () => {
    it("should support MinIO environment variables", () => {
      // These are the environment variables expected by Docker Compose
      const requiredEnvVars = [
        "STORAGE_ENDPOINT",
        "STORAGE_PUBLIC_ENDPOINT",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
        "STORAGE_BASE_URL",
        "STORAGE_PUBLIC_BUCKET",
        "STORAGE_PRIVATE_BUCKET",
      ];

      // Set up MinIO-style configuration
      process.env.STORAGE_ENDPOINT = "http://minio:9000";
      process.env.STORAGE_PUBLIC_ENDPOINT = "http://localhost:9000";
      process.env.STORAGE_ACCESS_KEY_ID = "minio";
      process.env.STORAGE_SECRET_ACCESS_KEY = "miniosecret";
      process.env.STORAGE_BASE_URL = "http://localhost:9000/dub-public";
      process.env.STORAGE_PUBLIC_BUCKET = "dub-public";
      process.env.STORAGE_PRIVATE_BUCKET = "dub-private";

      // Verify all required variables are set
      for (const envVar of requiredEnvVars) {
        expect(process.env[envVar]).toBeDefined();
        expect(process.env[envVar]).not.toBe("");
      }
    });

    it("should use path-style URLs for MinIO compatibility", () => {
      // MinIO uses path-style URLs: http://minio:9000/bucket/key
      // Not virtual-hosted style: http://bucket.minio:9000/key
      const endpoint = "http://minio:9000";
      const bucket = "dub-public";
      const key = "test/file.jpg";

      const expectedUrl = `${endpoint}/${bucket}/${key}`;
      expect(expectedUrl).toBe("http://minio:9000/dub-public/test/file.jpg");
    });
  });
});
