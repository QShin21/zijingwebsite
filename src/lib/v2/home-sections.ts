import type { HomeSection, HomeSectionKind } from "./types";

export const defaultHomeSections: readonly HomeSection[] = [
  { kind: "upcoming", enabled: true, title: "接下来的赛程" },
  { kind: "open", enabled: true, title: "正在招募" },
  { kind: "notices", enabled: true, title: "社团公告" },
  { kind: "promoted", enabled: true, title: "社团精选" },
  { kind: "communities", enabled: true, title: "游戏社群" },
  { kind: "highlights", enabled: true, title: "赛场高光" },
  { kind: "about", enabled: true, title: "关于紫荆" },
];
const known = new Set<HomeSectionKind>(defaultHomeSections.map(section => section.kind));

/** Ordered overrides; absent/new blocks append in their default order. */
export function homeSections(value: unknown): HomeSection[] {
  const sections: HomeSection[] = [], seen = new Set<string>();
  for (const input of Array.isArray(value) ? value : []) {
    if (!input || typeof input !== "object" || !known.has(input.kind) || seen.has(input.kind)) continue;
    seen.add(input.kind);
    const fallback = defaultHomeSections.find(section => section.kind === input.kind)!;
    sections.push({ kind: input.kind, enabled: input.enabled !== false,
      title: typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 60) : fallback.title });
  }
  return [...sections, ...defaultHomeSections.filter(section => !seen.has(section.kind)).map(section => ({ ...section }))];
}

export function validateHomeSections(value: unknown): true | string {
  if (value == null) return true;
  if (!Array.isArray(value) || value.length > known.size) return "最多配置七个 V2 主场区块";
  const seen = new Set<string>();
  for (const input of value) {
    if (!input || typeof input !== "object" || !known.has(input.kind)) return "请选择有效的 V2 主场区块";
    if (seen.has(input.kind)) return "同一种 V2 主场区块只能配置一次";
    seen.add(input.kind);
    if (input.title != null && (typeof input.title !== "string" || input.title.trim().length > 60)) return "区块标题最多 60 字";
    if (input.enabled != null && typeof input.enabled !== "boolean") return "区块启用设置无效";
  }
  return true;
}
