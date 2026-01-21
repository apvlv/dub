import { describe, expect, it } from "vitest";
import { getIpAddress, getIpAddressOrFallback } from "../../lib/geo/ip-address";

describe("IP Address Detection", () => {
  describe("getIpAddress", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "1.2.3.4, 10.0.0.1, 192.168.1.1",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("1.2.3.4");
      expect(source).toBe("x-forwarded-for");
    });

    it("should extract IP from cf-connecting-ip header", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "cf-connecting-ip": "5.6.7.8",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("5.6.7.8");
      expect(source).toBe("cf-connecting-ip");
    });

    it("should extract IP from x-real-ip header", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-real-ip": "9.10.11.12",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("9.10.11.12");
      expect(source).toBe("x-real-ip");
    });

    it("should prioritize cf-connecting-ip over x-forwarded-for", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "cf-connecting-ip": "1.1.1.1",
          "x-forwarded-for": "2.2.2.2",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("1.1.1.1");
      expect(source).toBe("cf-connecting-ip");
    });

    it("should return null when no headers present", () => {
      const mockRequest = new Request("https://example.com");
      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBeNull();
      expect(source).toBe("none");
    });

    it("should handle IPv6 addresses", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        },
      });

      const { ip } = getIpAddress(mockRequest);
      expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });

    it("should skip invalid IPs in x-forwarded-for chain", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "invalid, 3.4.5.6, 7.8.9.10",
        },
      });

      const { ip } = getIpAddress(mockRequest);
      expect(ip).toBe("3.4.5.6");
    });
  });

  describe("getIpAddressOrFallback", () => {
    it("should return fallback IP when no headers present", () => {
      const mockRequest = new Request("https://example.com");
      const ip = getIpAddressOrFallback(mockRequest, "127.0.0.1");
      expect(ip).toBe("127.0.0.1");
    });

    it("should return detected IP when headers present", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-real-ip": "8.8.8.8",
        },
      });
      const ip = getIpAddressOrFallback(mockRequest, "127.0.0.1");
      expect(ip).toBe("8.8.8.8");
    });
  });

  describe("IP validation", () => {
    it("should validate correct IPv4 addresses", () => {
      const validIps = ["0.0.0.0", "255.255.255.255", "192.168.1.1", "10.0.0.1"];

      for (const validIp of validIps) {
        const mockRequest = new Request("https://example.com", {
          headers: { "x-real-ip": validIp },
        });

        const { ip } = getIpAddress(mockRequest);
        expect(ip).toBe(validIp);
      }
    });

    it("should reject invalid IPv4 addresses", () => {
      const invalidIps = ["256.1.1.1", "1.1.1", "1.1.1.1.1", "abc.def.ghi.jkl"];

      for (const invalidIp of invalidIps) {
        const mockRequest = new Request("https://example.com", {
          headers: { "x-real-ip": invalidIp },
        });

        const { ip, source } = getIpAddress(mockRequest);
        expect(ip).toBeNull();
        expect(source).toBe("none");
      }
    });
  });

  describe("Header parsing", () => {
    it("should handle x-vercel-forwarded-for header", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-vercel-forwarded-for": "1.2.3.4",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("1.2.3.4");
      expect(source).toBe("x-vercel-forwarded-for");
    });

    it("should handle true-client-ip header (Akamai)", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "true-client-ip": "1.2.3.4",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("1.2.3.4");
      expect(source).toBe("true-client-ip");
    });

    it("should handle fastly-client-ip header", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "fastly-client-ip": "1.2.3.4",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("1.2.3.4");
      expect(source).toBe("fastly-client-ip");
    });

    it("should handle multiple IPs in x-forwarded-for correctly", () => {
      const mockRequest = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "  203.0.113.195  , 70.41.3.18, 150.172.238.178",
        },
      });

      const { ip, source } = getIpAddress(mockRequest);
      expect(ip).toBe("203.0.113.195");
      expect(source).toBe("x-forwarded-for");
    });
  });
});
