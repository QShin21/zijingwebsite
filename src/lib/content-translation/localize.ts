import type { Locale } from "../i18n/locale";
import type { SignupForm } from "../signup-schema";
import { formDisplay, Overlay, type FormDisplay, type TranslatableCollection } from "./segments";
import { loadOverlays } from "./store";

/*
 * Applies cached English to V2 view results *after* they were produced by the normal,
 * access-controlled readers. Only strings already present in the result are replaced
 * (exact Chinese hash match), so this step cannot add documents, fields or audiences.
 * IDs, slugs, hrefs, states, dates, option values and every other field stay untouched.
 */
type Ref = { collection: TranslatableCollection; id: number };

function refOf(value: Record<string, unknown>): Ref | null {
  const ref = value.ref as Record<string, unknown> | undefined;
  if (!ref || typeof ref !== "object" || typeof ref.id !== "number") return null;
  if (ref.type === "event") return { collection: ref.source === "club" ? "events" : "community-posts", id: ref.id };
  if (ref.type === "announcement") return { collection: "announcements", id: ref.id };
  if (ref.type === "communityNotice") return { collection: "community-posts", id: ref.id };
  return null;
}
const key = (ref: Ref) => `${ref.collection}:${ref.id}`;

function collect(value: unknown, refs: Ref[], depth = 0) {
  if (!value || typeof value !== "object" || depth > 12) return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, refs, depth + 1);
    return;
  }
  const ref = refOf(value as Record<string, unknown>);
  if (ref) refs.push(ref);
  for (const child of Object.values(value)) collect(child, refs, depth + 1);
}

const cardText = ["title", "summary", "location"] as const;

function transform(value: unknown, overlays: Map<string, Overlay>, depth = 0): unknown {
  if (!value || typeof value !== "object" || depth > 12) return value;
  if (Array.isArray(value)) return value.map((item) => transform(item, overlays, depth + 1));
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [field, child] of Object.entries(source)) result[field] = transform(child, overlays, depth + 1);
  const ref = refOf(source);
  const overlay = ref && overlays.get(key(ref));
  if (overlay) for (const field of cardText) if (typeof source[field] === "string") result[field] = overlay.text(source[field]);
  // Detail shapes: EventDetail { event, body, bodyText, presentation, registration } and
  // ArticleDetail { article, body, bodyText, presentation }.
  const owner = (source.event ?? source.article) as Record<string, unknown> | undefined;
  const ownerRef = owner && typeof owner === "object" ? refOf(owner) : null;
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
