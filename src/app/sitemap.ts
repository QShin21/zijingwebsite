import type { MetadataRoute } from "next";
import { list } from "@/lib/content";
import {serverURL} from '@/lib/environment';
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.APP_ENV !== "production") return [];
  const base = serverURL;
  if (!base) return [];
  const result: MetadataRoute.Sitemap = [
    "",
    "about",
    "events",
    "announcements",
    "join",
    "contact",
    "privacy",
  ].map((path) => ({ url: `${base}/${path}` }));
  for (const [collection, path] of [["events", "events"], ["announcements", "announcements"]] as const) {
    let page = 1;
    for (;;) {
      const r = await list(collection, {}, page, 100);
      result.push(...r.docs.map((d) => ({ url: `${base}/${path}/${d.slug}` })));
      if (!r.hasNextPage) break;
      page++;
    }
  }
  return result;
}
