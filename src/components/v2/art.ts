import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Optional generated brand art (docs/VISUAL_V3_ASSET_BRIEF.md). Files live in
 * public/visual-v3/ and are layered over the original SVG arena only when they
 * exist, so a missing asset never breaks the build or produces a 404.
 * Server-only: imported by server components.
 */
export type ArtAsset = "arena-hero.webp" | "arena-portrait.webp" | "monolith-detail.webp";

const root = path.join(process.cwd(), "public", "visual-v3");
const known = new Map<ArtAsset, boolean>();

export function artAsset(name: ArtAsset): string | null {
  if (!known.has(name)) known.set(name, existsSync(path.join(root, name)));
  return known.get(name) ? `/visual-v3/${name}` : null;
}
