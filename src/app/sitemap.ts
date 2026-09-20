import type { MetadataRoute } from "next";
import type { CollectionSlug } from "payload";
import { list } from "@/lib/content";
import { routeFor } from "@/lib/rules";
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
    "teams",
    "honors",
    "join",
    "join/members",
    "join/teams",
    "join/staff",
    "news",
    "gallery",
    "contact",
    "privacy",
  ].map((path) => ({ url: `${base}/${path}` }));
  for (const [collection, path] of Object.entries(routeFor)) {
    let page = 1;
    for (;;) {
      const r = await list(collection as CollectionSlug, {}, page, 100);
      result.push(...r.docs.map((d) => ({ url: `${base}/${path}/${d.slug}` })));
      if (!r.hasNextPage) break;
      page++;
    }
  }
  return result;
}
