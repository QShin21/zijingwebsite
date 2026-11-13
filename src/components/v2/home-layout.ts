import type { HomeSectionKind } from "@/lib/v2";

/** Blocks that read well at half width on desktop; everything else spans the row. */
export const halfWidthKinds: readonly HomeSectionKind[] = ["notices", "highlights", "about"];

/**
 * Groups rendered CMS blocks into layout rows without changing their order: two adjacent
 * half-width blocks share a row, any other block (or a lone half block) takes the full row.
 * Callers pass only blocks that actually render, so hidden or empty blocks never leave gaps.
 */
export function pairHomeBlocks<T extends { kind: HomeSectionKind }>(blocks: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < blocks.length; index++) {
    const current = blocks[index];
    const next = blocks[index + 1];
    if (next && halfWidthKinds.includes(current.kind) && halfWidthKinds.includes(next.kind)) {
      rows.push([current, next]);
      index++;
    } else rows.push([current]);
  }
  return rows;
}
