import { getPayload, type CollectionSlug, type Where } from "payload";
import config from "@payload-config";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import type { Window } from "./rules";
export type Content = Window & {
  id: number;
  signupForm?: { enabled?: boolean };
  slug: string;
  title: string;
  summary?: string;
  body?: SerializedEditorState;
  cover?: number;
  seoTitle?: string;
  seoDescription?: string;
  demo?: boolean;
  type?: string;
  kind?: string;
  game?: number;
  team?: number;
  season?: number;
  startAt?: string;
  endAt?: string;
  location?: string;
  date?: string;
  competition?: string;
  division?: string;
  placing?: string;
  sourceURL?: string;
  verified?: boolean;
  requirements?: string;
  contact?: string;
  channelCheckedAt?: string;
  qrCode?: number;
  event?: number;
  members?: { displayName: string; position?: string }[];
  positions?: {
    name: string;
    duties?: string;
    requirements?: string;
    commitment?: string;
    arrangement?: string;
  }[];
  photos?: { image: number; caption?: string }[];
  sections?: { heading: string; text?: string }[];
};
export const cms = () => getPayload({ config });
// Public projection excludes internal notes, editor metadata and audit details.
const publicSelect = Object.fromEntries(
  [
    "title",
    "slug",
    "summary",
    "body",
    "cover",
    "seoTitle",
    "seoDescription",
    "demo",
    "type",
    "kind",
    "game",
    "team",
    "season",
    "startAt",
    "endAt",
    "location",
    "date",
    "competition",
    "division",
    "placing",
    "sourceURL",
    "verified",
    "requirements",
    "contact",
    "channelCheckedAt",
    "qrCode",
    "event",
    "members",
    "positions",
    "photos",
    "sections",
    "archived",
    "lifecycle",
    "signupForm",
    "registrationClosed",
    "registrationStart",
    "registrationEnd",
    "registrationURL",
    "channelText",
    "_status",
  ].map((key) => [key, true]),
) as Record<string, true>;
export async function list(
  collection: CollectionSlug,
  where: Where = {},
  page = 1,
  limit = 12,
) {
  const p = await cms();
  const result = await p.find({
    collection,
    overrideAccess: false,
    user: null,
    depth: 0,
    draft: false,
    where,
    limit,
    page,
    sort: collection==='games'?'sort':"-createdAt",
    select: publicSelect,
  });
  return { ...result, docs: result.docs as unknown as Content[] };
}
export async function bySlug(collection: CollectionSlug, slug: string) {
  return (await list(collection, { slug: { equals: slug } }, 1, 1)).docs[0];
}
export async function fixed(key: string) {
  return (await list("pages", { key: { equals: key } }, 1, 1)).docs[0];
}
export async function site() {
  return (await cms()).findGlobal({
    slug: "site",
    overrideAccess: false,
    user: null,
    depth: 0,
  });
}
export async function media(id?: number | null) {
  if (!id) return null;
  try {
    return await (
      await cms()
    ).findByID({
      collection: "media",
      id,
      overrideAccess: false,
      user: null,
      depth: 0,
    });
  } catch {
    return null;
  }
}
export const names: Record<string, string> = {
  events: "活动",
  teams: "代表队",
  honors: "荣誉档案",
  news: "动态",
  albums: "影像",
  recruitment: "招新批次",
  announcements: "通知",
};
