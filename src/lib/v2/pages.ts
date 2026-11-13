import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { safeURL } from "../rules";
import { requireCampusViewer } from "./identity";
import { txt, rows, iso, readRows, publicWhere, safeBody, type Input } from "./shared";
import type { FixedPage, FixedPageKey } from "./types";
import { APIError } from "payload";

export async function getFixedPage(p: Payload, viewer: User | null, input: Input): Promise<FixedPage> {
  const key = String(input.key);
  if (!["about", "contact", "privacy", "join", "join-members", "join-teams", "join-staff"].includes(key)) throw new APIError("页面不存在", 404);
  if (["join-members", "join-teams", "join-staff"].includes(key)) await requireCampusViewer(p, viewer);
  const row = (await readRows(p, "pages", ["title", "key", "body", "sections", "updatedAt"], publicWhere({ key: { equals: key } }), null, 1))[0];
  const site = key === "contact" ? await p.findGlobal({ slug: "site", user: null, overrideAccess: false, depth: 0, select: { contacts: true } }) : null;
  return { key: key as FixedPageKey, title: txt(row?.title) ?? ({ about: "关于紫荆", contact: "联系紫荆", privacy: "隐私说明", join: "加入紫荆", "join-members": "加入社群", "join-teams": "代表队选拔", "join-staff": "骨干招新" }[key] ?? "紫荆"), body: safeBody(row?.body), sections: rows(row?.sections).map((section, index) => ({ id: String(section.id ?? index), heading: String(section.heading ?? ""), text: String(section.text ?? "") })), updatedAt: iso(row?.updatedAt), contacts: site ? (site.contacts ?? []).map(contact => ({ label: contact.label, text: contact.text, url: safeURL(contact.url) ? String(contact.url) : null })) : null };
}
