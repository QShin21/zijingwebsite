import { createHash } from "node:crypto";
import { normalizeSignup, type Question, type SignupForm } from "../signup-schema";
import { publicationBlocks } from "../publication-content";

/*
 * Published-content translation, pure part (2026-11-13 bilingual).
 *
 * A translation is stored per document as `{ hash(chinese) -> english }`. Display code never
 * looks a translation up by document alone: it hashes the Chinese text that the access-
 * controlled read already returned and replaces only an exact match. Therefore an English
 * overlay can only rephrase text the viewer was already authorized to see, a stale
 * translation of edited text is never shown (the hash differs), and anything untranslated
 * falls back to Chinese.
 *
 * Questionnaire options, matrix rows and group-field options are canonical answer values
 * (validation, display rules, jumps, exclusive option, statistics and exports all compare
 * them). They are never rewritten; English goes into a separate `display` projection that
 * clients render next to the unchanged value.
 */
export type TranslatableCollection =
  | "events" | "announcements" | "community-posts"
  // 2026-11-14 public content: news, albums, fixed pages (except privacy), community and
  // team introductions, visible showcase posts and approved honor records.
  | "news" | "albums" | "pages" | "games" | "teams" | "community-showcase" | "team-honor-records"
  // 2026-11-14 (2): verified legacy honors, recruitment batch notices and the public home
  // texts of the site settings global (stored with doc_id 1).
  | "honors" | "staff-batches" | "team-recruitments" | "site";
export const translatableCollections: readonly TranslatableCollection[] = [
  "events", "announcements", "community-posts", "news", "albums", "pages", "games", "teams", "community-showcase", "team-honor-records",
  "honors", "staff-batches", "team-recruitments", "site",
];
/** The site settings global is one document; its cache row uses this id. */
export const siteDocumentId = 1;
/**
 * Explicit field allowlist per collection: only these fields are ever read for translation
 * (store.ts selects exactly these) and sent to the provider. Contact details, QR codes,
 * author names, member profiles and rosters, review notes, internal notes, evidence
 * images/videos, answers, tickets and drafts are never listed.
 */
export const translationFields: Record<TranslatableCollection, readonly string[]> = {
  events: ["title", "summary", "location", "body", "requirements", "channelText", "signupForm"],
  announcements: ["title", "summary", "body"],
  "community-posts": ["title", "summary", "location", "body", "contentMode", "contentBlocks", "signupForm"],
  news: ["title", "summary", "body"],
  albums: ["title", "summary", "body", "photos"],
  pages: ["key", "title", "body", "sections"],
  games: ["title", "summary", "body"],
  teams: ["title", "summary", "body"],
  "community-showcase": ["title", "body"],
  "team-honor-records": ["title", "competition", "placing", "description"],
  // Legacy honor wall entries: summary is shown as the description. Source URL, season,
  // division, slug and media stay out.
  honors: ["title", "competition", "placing", "summary"],
  // Published batch notice only; the application form and answers are never read.
  "staff-batches": ["title", "description"],
  // Title and the public intro of the batch form (the worker sends only form.intro;
  // question labels, applicants and answers are never sent).
  "team-recruitments": ["title", "signupForm"],
  // Public home texts only; contacts, navigation, URLs and media stay out.
  site: ["heroTitle", "heroSubtitle", "heroButtonLabel", "footer", "description", "homeSections"],
};
/** Fields that decide whether a document is public; read with the allowlist, never sent. */
export const publicationFields: Record<TranslatableCollection, readonly string[]> = {
  events: ["_status"], announcements: ["_status"], "community-posts": ["status", "category"],
  news: ["_status"], albums: ["_status"], pages: ["_status"], games: ["_status"], teams: ["_status"],
  "community-showcase": ["status"], "team-honor-records": ["state"],
  honors: ["_status", "verified", "team"], "staff-batches": ["state"], "team-recruitments": ["status", "team"],
  site: [], // a global has no publication state; its public read access is unconditional
};
/** Stored per segment: `{ [hash]: english }`. */
export type TranslationTable = Record<string, string>;

export const maxSegmentLength = 6000;
export const maxDocumentCharacters = 60000;

export function textHash(text: string): string {
  return createHash("sha256").update("zh:" + text).digest("hex").slice(0, 24);
}

function worthTranslating(text: unknown): text is string {
  // Text without Chinese (names, URLs, numbers, already-English copy) is shown unchanged.
  return typeof text === "string" && text.trim().length > 0 && text.length <= maxSegmentLength && /[㐀-鿿豈-﫿]/.test(text);
}

/** Every text node of a Lexical document, in order. Links/URLs and formatting stay untouched. */
export function lexicalTexts(value: unknown, out: string[] = [], depth = 0): string[] {
  if (!value || typeof value !== "object" || depth > 60 || out.length > 5000) return out;
  const node = value as Record<string, unknown>;
  if (node.type === "text" && typeof node.text === "string") out.push(node.text);
  if (node.root) lexicalTexts(node.root, out, depth + 1);
  if (Array.isArray(node.children)) for (const child of node.children) lexicalTexts(child, out, depth + 1);
  return out;
}

export function formTexts(value: unknown): string[] {
  let form: SignupForm;
  try {
    form = normalizeSignup(value);
  } catch {
    return [];
  }
  if (!form.questions.length) return [];
  const out = [form.title ?? "", form.intro, form.completionMessage ?? ""];
  for (const q of form.questions) {
    out.push(q.label, q.help ?? "", q.placeholder ?? "", ...q.options, ...(q.rows ?? []));
    for (const field of q.fields ?? []) out.push(field.label, field.placeholder ?? "", ...field.options);
  }
  return out;
}

/**
 * Chinese source texts of the public, published parts of one document. The caller passes
 * the published document; drafts, internal notes, contact details, answers, seat tickets
 * and personal fields are not read here.
 */
export function sourceTexts(collection: TranslatableCollection, doc: Record<string, unknown>): string[] {
  // Values exactly as the V2 projections display them (trimmed where they trim).
  const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);
  if (collection === "pages" && doc.key === "privacy") return []; // legal text: Chinese is authoritative
  // Projected sources (store.ts builds these from the public projections): plain fields.
  const plain: Partial<Record<TranslatableCollection, unknown[]>> = {
    honors: [doc.title, doc.competition, doc.placing, doc.summary, trimmed(doc.summary)],
    "staff-batches": [doc.title, doc.description, trimmed(doc.description)],
    "team-recruitments": [doc.title, doc.intro, trimmed(doc.intro)],
    site: [doc.heroTitle, trimmed(doc.heroTitle), doc.heroSubtitle, trimmed(doc.heroSubtitle), doc.heroButtonLabel, trimmed(doc.heroButtonLabel),
      doc.footer, trimmed(doc.footer), doc.description,
      ...(Array.isArray(doc.homeSections) ? (doc.homeSections as Record<string, unknown>[]).map((section) => trimmed(section?.title)) : [])],
  };
  if (plain[collection]) return unique(plain[collection]!);
  const texts: unknown[] = [doc.title, trimmed(doc.summary), trimmed(doc.location)];
  if (collection === "events") texts.push(trimmed(doc.requirements), trimmed(doc.channelText));
  if (collection === "team-honor-records") texts.push(doc.competition, doc.placing, trimmed(doc.description));
  if (collection === "pages" && Array.isArray(doc.sections))
    for (const section of doc.sections as Record<string, unknown>[]) texts.push(section?.heading, section?.text);
  if (collection === "albums" && Array.isArray(doc.photos))
    for (const photo of doc.photos as Record<string, unknown>[]) texts.push(trimmed(photo?.caption));
  if (collection === "community-showcase") {
    const body = trimmed(doc.body);
    texts.push(body);
  } else if (collection === "team-honor-records") {
    // Plain fields only.
  } else if (collection === "community-posts") {
    const body = trimmed(doc.body);
    // Cards show the first 180 characters of a community post without a summary.
    texts.push(body, typeof body === "string" && body.length > 180 ? body.slice(0, 180) : null);
    if (doc.contentMode === "article") {
      try {
        for (const block of publicationBlocks(doc.contentBlocks, Number.MAX_SAFE_INTEGER)) if (block.type === "text") texts.push(block.text);
      } catch { /* Invalid stored blocks are not displayed either. */ }
    }
  } else texts.push(...lexicalTexts(doc.body));
  if (collection === "events" || collection === "community-posts") texts.push(...formTexts(doc.signupForm));
  return unique(texts);
}

function unique(texts: unknown[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const text of texts) {
    if (!worthTranslating(text) || seen.has(text)) continue;
    if (total + text.length > maxDocumentCharacters) break;
    seen.add(text);
    unique.push(text);
    total += text.length;
  }
  return unique;
}

export function sourceHash(texts: string[]): string {
  return createHash("sha256").update(JSON.stringify(texts)).digest("hex");
}

/** Lookup used by every display path. */
export class Overlay {
  constructor(private readonly table: TranslationTable) {}
  get size() {
    return Object.keys(this.table).length;
  }
  has(text: unknown): boolean {
    return typeof text === "string" && Object.hasOwn(this.table, textHash(text));
  }
  text<T>(value: T): T {
    if (typeof value !== "string" || !value) return value;
    const hash = textHash(value);
    return (Object.hasOwn(this.table, hash) ? this.table[hash] : value) as T;
  }
  lexical<T>(value: T, depth = 0): T {
    if (!value || typeof value !== "object" || depth > 60) return value;
    if (Array.isArray(value)) return value.map((item) => this.lexical(item, depth + 1)) as T;
    const node = value as Record<string, unknown>;
    const copy: Record<string, unknown> = { ...node };
    if (node.type === "text" && typeof node.text === "string") copy.text = this.text(node.text);
    if (node.root) copy.root = this.lexical(node.root, depth + 1);
    if (Array.isArray(node.children)) copy.children = node.children.map((child) => this.lexical(child, depth + 1));
    return copy as T;
  }
}

/**
 * Translated labels keyed by the canonical Chinese value: `[value, english]` pairs.
 * Pairs (rather than index-aligned arrays) stay correct when a client shuffles or
 * re-sorts options, and avoid object keys such as "__proto__" taken from user text.
 */
export type LabelPairs = [string, string][];
export type FieldDisplay = { label?: string; placeholder?: string; options?: LabelPairs };
export type QuestionDisplay = FieldDisplay & { help?: string; rows?: LabelPairs; fields?: Record<string, FieldDisplay> };
/**
 * English labels for a questionnaire. The form itself is never changed; clients look up
 * the label of an original option/row value and still submit the original value.
 */
export type FormDisplay = {
  locale: "en";
  title?: string;
  intro?: string;
  completionMessage?: string;
  questions: Record<string, QuestionDisplay>;
};

function pairs(overlay: Overlay, values: string[] | undefined): LabelPairs | undefined {
  const result = (values ?? []).filter((value) => overlay.has(value)).map((value): [string, string] => [value, overlay.text(value)]);
  return result.length ? result : undefined;
}

function fieldDisplay(overlay: Overlay, field: { label: string; placeholder?: string; options: string[] }): FieldDisplay | null {
  const display: FieldDisplay = {};
  if (overlay.has(field.label)) display.label = overlay.text(field.label);
  if (field.placeholder && overlay.has(field.placeholder)) display.placeholder = overlay.text(field.placeholder);
  const options = pairs(overlay, field.options);
  if (options) display.options = options;
  return Object.keys(display).length ? display : null;
}

export function formDisplay(form: SignupForm, overlay: Overlay): FormDisplay | null {
  if (!overlay.size || !form.questions.length) return null;
  const display: FormDisplay = { locale: "en", questions: {} };
  if (form.title && overlay.has(form.title)) display.title = overlay.text(form.title);
  if (form.intro && overlay.has(form.intro)) display.intro = overlay.text(form.intro);
  if (form.completionMessage && overlay.has(form.completionMessage)) display.completionMessage = overlay.text(form.completionMessage);
  for (const q of form.questions as Question[]) {
    const entry: QuestionDisplay = { ...fieldDisplay(overlay, q) };
    if (q.help && overlay.has(q.help)) entry.help = overlay.text(q.help);
    const rows = pairs(overlay, q.rows);
    if (rows) entry.rows = rows;
    // Question and field ids are validated identifiers (no prototype names).
    const fields: Record<string, FieldDisplay> = {};
    for (const field of q.fields ?? []) {
      const value = fieldDisplay(overlay, field);
      if (value) fields[field.id] = value;
    }
    if (Object.keys(fields).length) entry.fields = fields;
    if (Object.keys(entry).length) display.questions[q.id] = entry;
  }
  return display.title || display.intro || display.completionMessage || Object.keys(display.questions).length ? display : null;
}

/** Validated model output for one batch: only known ids, plain bounded strings. */
export function acceptTranslations(source: Record<string, string>, raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [id, chinese] of Object.entries(source)) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value !== "string") continue;
    // Control characters are removed; markup is kept as plain text and rendered escaped.
    // eslint-disable-next-line no-control-regex
    const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, "").trim();
    if (!clean || clean.length > Math.max(240, chinese.length * 8)) continue;
    // A reply that still contains most of the Chinese source is not a translation.
    const han = (clean.match(/[㐀-鿿]/g) ?? []).length;
    if (han > 0 && han >= (chinese.match(/[㐀-鿿]/g) ?? []).length * 0.5) continue;
    result[id] = clean;
  }
  return result;
}
