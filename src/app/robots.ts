import type { MetadataRoute } from "next";
import {serverURL} from '@/lib/environment';
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: process.env.APP_ENV === "production" ? "/" : undefined,
      disallow:
        process.env.APP_ENV === "production"
          ? ["/admin", "/api", "/preview"]
          : ["/"],
    },
    sitemap:
      process.env.APP_ENV === "production"
        ? `${serverURL}/sitemap.xml`
        : undefined,
  };
}
