import type { Locale } from "../i18n/locale";
import type { SignupForm } from "../signup-schema";
import { formDisplay, Overlay, siteDocumentId, type FormDisplay, type TranslatableCollection } from "./segments";
import { loadOverlays } from "./store";

/*
 * Applies cached English to V2 view results *after* they were produced by the normal,
 * access-controlled readers. Only strings already present in the result are replaced
 * (exact Chinese hash match), so this step cannot add documents, fields or audiences.
 * IDs, slugs, hrefs, states, dates, option values and every other field stay untouched.
 */
type Ref = { collection: TranslatableCollection; id: number };
type Shape = "home" | "item" | "community" | "team" | "communityCard" | "teamCard" | "communityDetail" | "teamDetail" | "page" | null;

function itemRef(value: Record<string, unknown>): Ref | null {
  const ref = value.ref as Record<string, unknown> | undefined;
  if (!ref || typeof ref !== "object") return null;
  if (ref.type === "honor" && typeof ref.key === "string") return honorKeyRef(ref.key);
  if (typeof ref.id !== "number") return null;
  if (ref.type === "event") return { collection: ref.source === "club" ? "events" : "community-posts", id: ref.id };
  if (ref.type === "announcement") return { collection: "announcements", id: ref.id };
  if (ref.type === "communityNotice") return { collection: "community-posts", id: ref.id };
  if (ref.type === "news") return { collection: "news", id: ref.id };
  if (ref.type === "album") return { collection: "albums", id: ref.id };
  if (ref.type === "showcase") return { collection: "community-showcase", id: ref.id };
  if (ref.type === "staffBatch") return { collection: "staff-batches", id: ref.id };
  if (ref.type === "teamRecruitment") return { collection: "team-recruitments", id: ref.id };
  return null;
}
/** Honor wall keys: "team-honor-records:<id>" (current records) and "honors:<id>" (verified legacy). */
export function honorKeyRef(value: string): Ref | null {
  const match = /^(team-honor-records|honors):(\d+)$/.exec(value);
  return match ? { collection: match[1] as "team-honor-records" | "honors", id: Number(match[2]) } : null;
}
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** CommunityRef { id, slug, title, hue } and TeamRef { id, slug, title, community } are recognized by shape. */
function shapeOf(value: Record<string, unknown>): Shape {
  // HomeResponse: { sections, site: { heroTitle, heroSubtitle, heroAction, footer, ... } }.
  if (Array.isArray(value.sections) && isRecord(value.site) && "heroTitle" in value.site && "footer" in value.site) return "home";
  if (itemRef(value)) return "item";
  if (typeof value.id === "number" && typeof value.slug === "string" && typeof value.title === "string") {
    if (typeof value.hue === "number") return "community";
    if ("community" in value && !("ref" in value)) return "team";
  }
  if (isRecord(value.community) && isRecord(value.counts) && "summary" in value && !("team" in value)) return "communityCard";
  if (isRecord(value.team) && isRecord(value.counts) && "summary" in value) return "teamCard";
  if (isRecord(value.card) && "body" in value && "officers" in value) return "communityDetail";
  if (isRecord(value.card) && "body" in value && "positions" in value) return "teamDetail";
  if (typeof value.key === "string" && typeof value.id === "number" && Array.isArray(value.sections) && "body" in value && "contacts" in value) return "page";
  return null;
}
function refFor(value: Record<string, unknown>, shape: Shape): Ref | null {
  switch (shape) {
    case "home": return { collection: "site", id: siteDocumentId };
    case "item": return itemRef(value);
    case "community": return { collection: "games", id: value.id as number };
    case "team": return { collection: "teams", id: value.id as number };
    case "communityCard": return typeof (value.community as Record<string, unknown>).id === "number" ? { collection: "games", id: (value.community as Record<string, number>).id } : null;
    case "teamCard": return typeof (value.team as Record<string, unknown>).id === "number" ? { collection: "teams", id: (value.team as Record<string, number>).id } : null;
    case "communityDetail": { const community = (value.card as Record<string, Record<string, unknown>>).community; return community && typeof community.id === "number" ? { collection: "games", id: community.id } : null; }
    case "teamDetail": { const team = (value.card as Record<string, Record<string, unknown>>).team; return team && typeof team.id === "number" ? { collection: "teams", id: team.id } : null; }
    case "page": return value.key === "privacy" ? null : { collection: "pages", id: value.id as number };
    default: return null;
  }
}
const key = (ref: Ref) => `${ref.collection}:${ref.id}`;

function collect(value: unknown, refs: Ref[], depth = 0) {
  if (!value || typeof value !== "object" || depth > 12) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, refs, depth + 1);
    return;
  }
  const source = value as Record<string, unknown>;
  const ref = refFor(source, shapeOf(source));
  if (ref) refs.push(ref);
  for (const child of Object.values(source)) collect(child, refs, depth + 1);
}

// Only these fields of a recognized object are ever replaced.
const replaceable: Record<Exclude<Shape, null>, readonly string[]> = {
  item: ["title", "summary", "location", "body", "competition", "placing", "description"],
  community: ["title"], team: ["title"], communityCard: ["summary"], teamCard: ["summary"],
  communityDetail: [], teamDetail: [], page: ["title"], home: [],
};

function transform(value: unknown, overlays: Map<string, Overlay>, depth = 0): unknown {
  if (!value || typeof value !== "object" || depth > 12) return value;
  if (Array.isArray(value)) return value.map((item) => transform(item, overlays, depth + 1));
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [field, child] of Object.entries(source)) result[field] = transform(child, overlays, depth + 1);
  const shape = shapeOf(source);
  const ref = refFor(source, shape);
  const overlay = ref && overlays.get(key(ref));
  if (overlay && shape === "home") {
    const site = result.site as Record<string, unknown>;
    const action = isRecord(site.heroAction) ? { ...site.heroAction, label: overlay.text(site.heroAction.label) } : site.heroAction;
    result.site = { ...site, heroTitle: overlay.text(site.heroTitle), heroSubtitle: overlay.text(site.heroSubtitle), footer: overlay.text(site.footer), heroAction: action };
    result.sections = (result.sections as unknown[]).map((section) => isRecord(section) && typeof section.title === "string" ? { ...section, title: overlay.text(section.title) } : section);
  }
  if (overlay && shape) {
    for (const field of replaceable[shape]) if (typeof source[field] === "string") result[field] = overlay.text(source[field]);
    // Showcase cards carry image captions (albums use the detail photo page below).
    if (shape === "item" && Array.isArray(source.images))
      result.images = (result.images as Record<string, unknown>[]).map((image) => isRecord(image) && typeof image.caption === "string" ? { ...image, caption: overlay.text(image.caption) } : image);
    if ((shape === "communityDetail" || shape === "teamDetail" || shape === "page") && source.body && typeof source.body === "object") result.body = overlay.lexical(source.body);
    if (shape === "page" && Array.isArray(source.sections))
      result.sections = (source.sections as Record<string, unknown>[]).map((section) => ({ ...section, heading: overlay.text(section.heading), text: overlay.text(section.text) }));
  }
  // Detail shapes: EventDetail { event, body, bodyText, presentation, registration } and
  // ArticleDetail { article, body, bodyText, presentation, sections, photos }.
  const owner = (source.event ?? source.article) as Record<string, unknown> | undefined;
  const ownerRef = owner && typeof owner === "object" ? itemRef(owner) : null;
  const detail = ownerRef && overlays.get(key(ownerRef));
  if (detail && ("body" in source || "bodyText" in source)) {
    if (source.body && typeof source.body === "object") result.body = detail.lexical(source.body);
    if (typeof source.bodyText === "string") result.bodyText = detail.text(source.bodyText);
    const presentation = source.presentation as { mode?: string; blocks?: Record<string, unknown>[] } | null | undefined;
    if (presentation && Array.isArray(presentation.blocks))
      result.presentation = { ...presentation, blocks: presentation.blocks.map((block) => block.type === "text" ? { ...block, text: detail.text(block.text) } : block) };
    const registration = source.registration as Record<string, unknown> | null | undefined;
    if (registration && typeof registration === "object")
      result.registration = { ...registration, requirements: detail.text(registration.requirements), channelText: detail.text(registration.channelText) };
    if (Array.isArray(source.sections))
      result.sections = (source.sections as Record<string, unknown>[]).map((section) => ({ ...section, heading: detail.text(section.heading), text: detail.text(section.text) }));
    const photos = source.photos as { docs?: Record<string, unknown>[] } | null | undefined;
    if (photos && Array.isArray(photos.docs))
      result.photos = { ...(result.photos as object), docs: photos.docs.map((photo) => ({ ...photo, caption: detail.text(photo.caption) })) };
  }
  return result;
}

export async function localizeView<T>(value: T, locale: Locale): Promise<T> {
  if (locale !== "en" || !value || typeof value !== "object") return value;
  const refs: Ref[] = [];
  collect(value, refs);
  if (!refs.length) return value;
  const overlays = await loadOverlays(refs);
  if (!overlays.size) return value;
  return transform(value, overlays) as T;
}

/**
 * Honor archive DTO (`/api/team-honor-archives/<team>`, used by the mini program): records
 * carry the same "team-honor-records:<id>" / "honors:<id>" keys as the V2 cards but no
 * `ref`. Only title, competition, placing and description of those records are replaced;
 * media, source links and keys are unchanged.
 */
export async function localizeHonorArchive<T extends { records?: Record<string, unknown>[] }>(archive: T, locale: Locale): Promise<T> {
  if (locale !== "en" || !archive || !Array.isArray(archive.records)) return archive;
  const ids = archive.records.flatMap((record) => {
    const ref = typeof record.key === "string" ? honorKeyRef(record.key) : null;
    return ref ? [ref] : [];
  });
  if (!ids.length) return archive;
  const overlays = await loadOverlays(ids);
  if (!overlays.size) return archive;
  return { ...archive, records: archive.records.map((record) => {
    const overlay = typeof record.key === "string" ? overlays.get(record.key) : undefined;
    if (!overlay) return record;
    const next = { ...record };
    for (const field of ["title", "competition", "placing", "description"]) if (typeof record[field] === "string") next[field] = overlay.text(record[field]);
    return next;
  }) };
}

/** English questionnaire labels for a form the caller already read and authorized. */
export async function localizedFormDisplay(collection: "events" | "community-posts", id: number, form: SignupForm, locale: Locale): Promise<FormDisplay | null> {
  if (locale !== "en" || !form.questions.length) return null;
  const overlay = (await loadOverlays([{ collection, id }])).get(`${collection}:${id}`);
  return overlay ? formDisplay(form, overlay) : null;
}

/** Title shown with a questionnaire (from the same authorized read). */
export async function localizedTitle(collection: TranslatableCollection, id: number, title: string, locale: Locale): Promise<string> {
  if (locale !== "en") return title;
  const overlay = (await loadOverlays([{ collection, id }])).get(`${collection}:${id}`);
  return overlay ? overlay.text(title) : title;
}

/** Public home texts from the site settings global (layout footer and SEO description). */
export async function localizedSiteTexts<T extends { footer?: string | null; description?: string | null }>(site: T, locale: Locale): Promise<T> {
  if (locale !== "en") return site;
  const overlay = (await loadOverlays([{ collection: "site", id: siteDocumentId }])).get(`site:${siteDocumentId}`);
  if (!overlay) return site;
  return { ...site, footer: overlay.text(site.footer ?? null), description: overlay.text(site.description ?? null) };
}

/** Title and description of a recruitment batch detail page (already read with its access rules). */
export async function localizedBatchTexts(collection: "staff-batches" | "team-recruitments", id: number, texts: { title: string; description: string | null }, locale: Locale) {
  if (locale !== "en") return texts;
  const overlay = (await loadOverlays([{ collection, id }])).get(`${collection}:${id}`);
  return overlay ? { title: overlay.text(texts.title), description: overlay.text(texts.description) } : texts;
}
