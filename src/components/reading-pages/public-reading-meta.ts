import { cms } from "@/lib/content";
import { teamLifecycleLabels } from "@/lib/team-core";

export type ReadingMeta = {
  teamStatus?: string | null;
};

/** Add only public display metadata to objects already read through the public projection. */
export async function publicTeamMeta(
  ids: number[],
): Promise<Map<number, ReadingMeta>> {
  if (!ids.length) return new Map();
  try {
    const payload = await cms();
    const query = {
      overrideAccess: false,
      user: null,
      draft: false,
      depth: 0,
      pagination: false,
      limit: ids.length,
      where: { id: { in: ids } },
    } as const;
    const result = await payload.find({
      ...query,
      collection: "teams",
      select: { teamStatus: true },
    });
    return new Map(
      result.docs.map((doc) => [doc.id, { teamStatus: doc.teamStatus }]),
    );
  } catch {
    // The public document remains readable when optional display metadata is unavailable.
    return new Map();
  }
}

export function publicTeamState(meta?: ReadingMeta, archived?: boolean | null) {
  if (archived || meta?.teamStatus === "archived") return "历史归档";
  return meta?.teamStatus ? teamLifecycleLabels[meta.teamStatus] : undefined;
}
