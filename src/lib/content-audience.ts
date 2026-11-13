import type { Field, Where } from "payload";
import { canParticipate, canUseCampus, type Identity } from "./rules";

export const audiences = ["campus", "peer", "public"] as const;
export type ContentAudience = (typeof audiences)[number];
export const audienceLabels: Record<ContentAudience, string> = {
  campus: "仅清华",
  peer: "清华和友校",
  public: "所有人",
};

export function readAudience(value: unknown): ContentAudience | null {
  return typeof value === "string" && Object.hasOwn(audienceLabels, value) ? value as ContentAudience : null;
}

export function canSeeAudience(viewer: Identity | null | undefined, audience: unknown) {
  return audience === "public" || canUseCampus(viewer) ||
    (audience === "peer" && viewer?.affiliation === "peer" && canParticipate(viewer));
}

export function audienceWhere(viewer: Identity | null | undefined): Where {
  if (canUseCampus(viewer)) return {};
  return { audience: { in: audiences.filter(audience => canSeeAudience(viewer, audience)) } };
}

export const audienceField: Field = {
  name: "audience",
  label: "可见范围",
  type: "select",
  required: true,
  defaultValue: "campus",
  typescriptSchema: [({ jsonSchema }) => ({ ...jsonSchema, required: false })],
  options: audiences.map(value => ({ value, label: audienceLabels[value] })),
  admin: { description: "发布后按所选范围显示。活动报名仍须登录，并遵守报名时间和活动要求。" },
};
