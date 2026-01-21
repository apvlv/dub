import { ipAddressOrFallback } from "@/lib/geo";
import { redis } from "@/lib/upstash";

export type DeepLinkClickData = {
  clickId: string;
  link: { id: string; domain: string; key: string; url: string };
};

export async function cacheDeepLinkClickData({
  req,
  clickId,
  link,
}: {
  req: Request;
  clickId: string;
  link: { id: string; domain: string; key: string; url: string };
}) {
  const ip = ipAddressOrFallback(req);

  // skip caching if ip address is not present
  if (!ip) {
    console.log(
      `Skipping cache for ${link.domain}:${link.key} because ip is not present.`,
    );
    return;
  }

  return await redis.set<DeepLinkClickData>(
    `deepLinkClickCache:${ip}:${link.domain}:${link.key}`,
    {
      clickId,
      link,
    },
    {
      ex: 60 * 60,
    },
  );
}
