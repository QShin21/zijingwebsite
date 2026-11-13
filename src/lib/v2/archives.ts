import { APIError, type Payload } from "payload";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import type { User } from "@/payload-types";
import { canUseCampus } from "../rules";
import { requireViewer } from "./identity";
import { rel } from "./shared";
import type { ArchiveResult } from "./types";

/**
 * Personal display preference: "hide this record from my overview". It never
 * changes an application, signup, answer, review state or another user's data.
 * Targets reuse the stable keys already sent to clients:
 *   staff:ID | teamJoin:ID | teamEstablishment:ID | communityOfficer:ID  (ApplicationItem.key)
 *   club:ID | community:ID                                               (EventCard.key of an own signup)
 */
const applicationCollections = {
  staff: "staff-applications",
  teamJoin: "team-join-applications",
  teamEstablishment: "team-establishment-applications",
  communityOfficer: "community-applications",
} as const;
const activityTypes = { club: "events", community: "community-posts" } as const;
type ApplicationKind = keyof typeof applicationCollections;
type ActivityKind = keyof typeof activityTypes;
export type ArchiveKind = ApplicationKind | ActivityKind;

const targetPattern = /^(staff|teamJoin|teamEstablishment|communityOfficer|club|community):([1-9]\d{0,9})$/;
const pool = (p: Payload) => (p.db as unknown as PostgresAdapter).pool;

export function parseArchiveTarget(value: unknown): { kind: ArchiveKind; id: number; target: string } {
  const match = typeof value === "string" ? targetPattern.exec(value) : null;
  const id = match ? Number(match[2]) : 0;
  if (!match || !Number.isSafeInteger(id) || id > 2147483647) throw new APIError("归档对象无效", 400);
  return { kind: match[1] as ArchiveKind, id, target: `${match[1]}:${id}` };
}

/** Archive keys for an already refreshed account. Read-only and owner-scoped by SQL. */
export async function archivedTargets(p: Payload, user: User): Promise<Set<string>> {
  const result = await pool(p).query<{ target: string }>("SELECT target FROM personal_archives WHERE user_id = $1", [user.id]);
  return new Set(result.rows.map(row => row.target));
}

/** IDs of one target kind inside an archive set. */
export function archivedIDs(set: Set<string>, kind: ArchiveKind): number[] {
  const prefix = `${kind}:`;
  return [...set].filter(target => target.startsWith(prefix)).map(target => Number(target.slice(prefix.length)))
    .filter(id => Number.isSafeInteger(id) && id > 0);
}

/** Proves the target is the caller's own application or own activity signup. */
async function assertOwned(p: Payload, user: User, kind: ArchiveKind, id: number) {
  if (kind in applicationCollections) {
    if (!canUseCampus(user)) throw new APIError("此栏目仅面向清华账号", 403);
    const result = await p.find({ collection: applicationCollections[kind as ApplicationKind], user, overrideAccess: false, depth: 0, limit: 1, pagination: false,
      where: { and: [{ id: { equals: id } }, { applicant: { equals: user.id } }] }, select: { applicant: true } });
    if (!result.docs.some(row => row.id === id && rel(row.applicant) === user.id)) throw new APIError("记录不可访问", 404);
    return;
  }
  const result = await p.find({ collection: "event-signups", user, overrideAccess: false, depth: 0, limit: 1, pagination: false,
    where: { and: [{ member: { equals: user.id } }, { activityType: { equals: activityTypes[kind as ActivityKind] } }, { activityID: { equals: id } }] },
    select: { member: true, activityType: true, activityID: true } });
  if (!result.docs.some(row => rel(row.member) === user.id && row.activityID === id && row.activityType === activityTypes[kind as ActivityKind]))
    throw new APIError("记录不可访问", 404);
}

/**
 * Idempotent set (never a toggle): archived=true inserts once, archived=false
 * deletes the caller's own row. The primary key (user_id, target) makes
 * concurrent duplicate clicks converge to one row without lost updates.
 */
export async function setArchive(p: Payload, viewer: User | null, input: { target?: unknown; archived?: unknown }): Promise<ArchiveResult> {
  const user = await requireViewer(p, viewer);
  if (typeof input.archived !== "boolean") throw new APIError("归档状态无效", 400);
  const { kind, id, target } = parseArchiveTarget(input.target);
  if (input.archived) {
    await assertOwned(p, user, kind, id);
    await pool(p).query("INSERT INTO personal_archives (user_id, target) VALUES ($1, $2) ON CONFLICT (user_id, target) DO NOTHING", [user.id, target]);
  } else {
    // Restoring only ever touches the caller's own preference rows.
    await pool(p).query("DELETE FROM personal_archives WHERE user_id = $1 AND target = $2", [user.id, target]);
  }
  return { target, archived: input.archived };
}
