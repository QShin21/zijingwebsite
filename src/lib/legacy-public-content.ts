import type { Where } from "payload";
import { cms } from "./content";
import { publicWhere } from "./v2/shared";

const responseHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };
const fields = {
  events: {
    title: true, slug: true, summary: true, body: true, type: true, startAt: true, endAt: true,
    location: true, lifecycle: true, archived: true, registrationClosed: true, registrationURL: true,
    registrationStart: true, registrationEnd: true, channelText: true, channelCheckedAt: true, requirements: true,
    publishedAt: true, createdAt: true, _status: true,
  },
  announcements: { title: true, slug: true, summary: true, body: true, publishedAt: true, createdAt: true, _status: true },
  pages: { title: true, slug: true, summary: true, body: true, sections: true, _status: true },
} as const;

/** Older mini programs use these list URLs for public details and the privacy prompt. */
export async function legacyPublicContent(request: Request, collection: keyof typeof fields) {
  const query = new URL(request.url).searchParams;
  const filters: Where[] = [];
  if (collection === "pages") {
    const key = query.get("where[key][equals]");
    if (!key || !["privacy", "about", "contact", "join"].includes(key)) return null;
    filters.push({ key: { equals: key } });
  } else {
    const id = query.get("where[id][equals]");
    const slug = query.get("where[slug][equals]");
    const search = query.get("where[title][contains]")?.trim().slice(0, 80);
    if (id) {
      if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647)
        return Response.json({ error: "内容暂时不可访问" }, { status: 404, headers: responseHeaders });
      filters.push({ id: { equals: Number(id) } });
    }
    if (slug) filters.push({ slug: { equals: slug.slice(0, 200) } });
    if (search) filters.push({ title: { contains: search } });
    filters.push({ audience: { equals: "public" } });
  }
  const integer = (value: string | null, fallback: number, maximum: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 ? Math.min(number, maximum) : fallback;
  };
  try {
    const result = await (await cms()).find({
      collection, user: null, overrideAccess: false, depth: 0, draft: false,
      where: publicWhere({ and: filters }), select: fields[collection],
      sort: "-createdAt", limit: integer(query.get("limit"), 12, 50), page: integer(query.get("page"), 1, 1000),
    });
    return Response.json(result, { headers: responseHeaders });
  } catch {
    return Response.json({ error: "栏目暂不可用，请稍后重试" }, { status: 503, headers: responseHeaders });
  }
}
