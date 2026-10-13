// Offline review of an operator-provided metadata snapshot. No DB, network,
// application writes, deletion eligibility, or automatic retention enforcement.
export const retentionCollections = [
  "event-signups",
  "staff-applications",
  "team-join-applications",
  "team-establishment-applications",
  "community-applications",
  "community-joins",
  "team-memberships",
] as const;
type Collection = (typeof retentionCollections)[number];
type Metadata = {
  collection: Collection;
  id: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string;
};
type Reference = {
  sourceCollection: "team-memberships" | "teams" | "_teams_v" | "users";
  sourceID: number;
  sourceField: string;
  targetCollection: Collection;
  targetID: number;
};
const statuses: Record<Collection, readonly string[]> = {
  "event-signups": [],
  "staff-applications": [
    "submitted",
    "reviewing",
    "returned",
    "accepted",
    "rejected",
    "withdrawn",
  ],
  "team-join-applications": [
    "draft",
    "pending",
    "returned",
    "rejected",
    "withdrawn",
    "approved",
  ],
  "team-establishment-applications": [
    "pending",
    "returned",
    "rejected",
    "withdrawn",
    "approved",
  ],
  "community-applications": [
    "pending",
    "returned",
    "rejected",
    "withdrawn",
    "approved",
  ],
  "community-joins": [
    "requested",
    "friendReported",
    "awaitingInvite",
    "joined",
    "withdrawn",
  ],
  "team-memberships": ["active", "revoked"],
};
const referenceTargets: Record<string, string> = {
  "team-memberships:sourceApplication": "team-join-applications",
  "teams:establishmentApplication": "team-establishment-applications",
  "_teams_v:version.establishmentApplication":
    "team-establishment-applications",
  "users:communityOffices.sourceApplication": "community-applications",
};
export class RetentionReviewInputError extends Error {}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new RetentionReviewInputError(
      "输入只接受规定的元数据字段；请勿提供答案、姓名、联系方式或媒体。",
    );
  return value as Record<string, unknown>;
}
function id(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new RetentionReviewInputError("记录标识须为正整数。");
  return value;
}
function collection(value: unknown): Collection {
  if (!retentionCollections.includes(value as Collection))
    throw new RetentionReviewInputError("记录集合不在本次审查范围。");
  return value as Collection;
}
function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!m) return null;
  const [, y, month, day, h, minute, second, zone] = m;
  const year = Number(y),
    mon = Number(month),
    date = Number(day);
  if (
    year < 1000 ||
    year > 9998 ||
    mon < 1 ||
    mon > 12 ||
    date < 1 ||
    date > new Date(Date.UTC(year, mon, 0)).getUTCDate() ||
    Number(h) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  )
    return null;
  if (
    zone !== "Z" &&
    (Number(zone.slice(1, 3)) > 14 ||
      Number(zone.slice(4)) > 59 ||
      (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4)) !== 0))
  )
    return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
// UTC calendar anniversary, clamped to the final day for a leap-day start.
function anniversary(value: string) {
  const time = new Date(value),
    year = time.getUTCFullYear() + 1,
    month = time.getUTCMonth();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(
        time.getUTCDate(),
        new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
      ),
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds(),
      time.getUTCMilliseconds(),
    ),
  ).toISOString();
}
export function buildRetentionReview(input: unknown, asOf: string) {
  const now = timestamp(asOf);
  if (!now)
    throw new RetentionReviewInputError("asOf须为有效带时区的ISO时间。");
  const snapshot = object(input, [
    "schemaVersion",
    "records",
    "references",
    "referencesComplete",
  ]);
  if (
    snapshot.schemaVersion !== 1 ||
    !Array.isArray(snapshot.records) ||
    snapshot.records.length > 10000 ||
    (snapshot.references !== undefined &&
      (!Array.isArray(snapshot.references) ||
        snapshot.references.length > 20000)) ||
    (snapshot.referencesComplete !== undefined &&
      typeof snapshot.referencesComplete !== "boolean")
  )
    throw new RetentionReviewInputError(
      "元数据结构或数量无效；超限须拆分审查，不能视为完整清单。",
    );
  const keys = new Set<string>();
  const records: Metadata[] = snapshot.records.map((value) => {
    const raw = object(value, [
      "collection",
      "id",
      "createdAt",
      "updatedAt",
      "status",
    ]);
    const name = collection(raw.collection),
      number = id(raw.id),
      key = name + ":" + number;
    if (keys.has(key))
      throw new RetentionReviewInputError(
        "同一集合/编号存在重复快照，须先核对版本。",
      );
    keys.add(key);
    if (
      raw.status !== undefined &&
      !statuses[name].includes(raw.status as string)
    )
      throw new RetentionReviewInputError("记录状态须使用现有集合状态。");
    if (
      ["createdAt", "updatedAt"].some(
        (key) =>
          raw[key] !== undefined &&
          raw[key] !== null &&
          typeof raw[key] !== "string",
      )
    )
      throw new RetentionReviewInputError("日期须为时间字符串或空值。");
    return {
      collection: name,
      id: number,
      createdAt: raw.createdAt as string | null | undefined,
      updatedAt: raw.updatedAt as string | null | undefined,
      ...(raw.status === undefined ? {} : { status: raw.status as string }),
    };
  });
  const references: Reference[] = (
    (snapshot.references || []) as unknown[]
  ).map((value) => {
    const raw = object(value, [
      "sourceCollection",
      "sourceID",
      "sourceField",
      "targetCollection",
      "targetID",
    ]);
    const expected =
      referenceTargets[
        String(raw.sourceCollection) + ":" + String(raw.sourceField)
      ];
    if (!expected || raw.targetCollection !== expected)
      throw new RetentionReviewInputError(
        "引用须来自已存在的成员、队伍/版本或社群任职关系。",
      );
    return {
      sourceCollection: raw.sourceCollection as Reference["sourceCollection"],
      sourceID: id(raw.sourceID),
      sourceField: String(raw.sourceField),
      targetCollection: collection(raw.targetCollection),
      targetID: id(raw.targetID),
    };
  });
  const byTarget = new Map<string, Reference[]>();
  references.forEach((ref) => {
    const key = ref.targetCollection + ":" + ref.targetID;
    const group = byTarget.get(key);
    if (group) group.push(ref);
    else byTarget.set(key, [ref]);
  });
  const items = records.map((record) => {
    const createdAt = timestamp(record.createdAt),
      updatedAt = timestamp(record.updatedAt);
    const member =
      record.collection === "team-memberships" ||
      (record.collection === "community-joins" && record.status === "joined");
    const related = ["community-applications", "community-joins"].includes(
      record.collection,
    );
    const linked = byTarget.get(record.collection + ":" + record.id) || [];
    const reasons: string[] = [];
    const invalidDates =
      !createdAt ||
      createdAt > now ||
      (record.updatedAt !== undefined &&
        record.updatedAt !== null &&
        (!updatedAt ||
          updatedAt > now ||
          (createdAt && updatedAt < createdAt)));
    const latestChangeAt =
      createdAt && updatedAt
        ? createdAt > updatedAt
          ? createdAt
          : updatedAt
        : createdAt;
    const createdReviewAt = createdAt ? anniversary(createdAt) : null;
    const latestChangeReviewAt = latestChangeAt
      ? anniversary(latestChangeAt)
      : null;
    let review = "not-yet-one-year";
    if (member) {
      review = "long-term-member";
      reasons.push("长期成员关系，不等于原申请答案可长期保留。");
    } else if (invalidDates) {
      review = "date-needs-review";
      reasons.push("日期缺失、无效、未来或顺序异常，不能确认报名期限。");
    } else if (record.status === "draft") {
      review = "draft-scope-review";
      reasons.push("草稿创建不是报名提交；须人工核对首次提交/重提时间。");
    } else if (createdReviewAt && createdReviewAt <= now) {
      review = related
        ? "related-application-review"
        : latestChangeReviewAt && latestChangeReviewAt <= now
          ? "one-year-inactive-review"
          : "created-one-year-review";
      reasons.push(
        "记录已创建至少一年；两个审查日期用于发现/排序，均不是已确认的报名到期日。",
      );
      if (latestChangeReviewAt && latestChangeReviewAt > now)
        reasons.push(
          "近期仍有修改/审核/重提；须核实提交历史，不能用updatedAt自动续期或直接删除。",
        );
    }
    if (related && !member)
      reasons.push(
        "相关建群/管理申请或未确认进群意向，须按资料用途人工确认政策范围。",
      );
    if (record.collection !== "event-signups" && !record.status)
      reasons.push("未提供当前状态，须通过既有授权入口核对。");
    if (linked.length)
      reasons.push(
        "仍有成员/队伍/版本/任职来源引用，禁止据清单整行删除申请或破坏关系。",
      );
    if (snapshot.referencesComplete !== true)
      reasons.push("引用元数据未声明完整；无已列引用不能视为无依赖。");
    return {
      collection: record.collection,
      id: record.id,
      ...(record.status ? { status: record.status } : {}),
      createdAt,
      updatedAt,
      createdReviewAt,
      latestChangeReviewAt,
      review,
      reasons,
      references: linked,
    };
  });
  return {
    schemaVersion: 1,
    asOf: now,
    readOnly: true,
    automaticDeletion: false,
    expiryConfirmed: false,
    inputScope: "operator-provided-metadata-only",
    referencesComplete: snapshot.referencesComplete === true,
    policy: {
      registrationYears: 1,
      memberRecords: "长期保留",
      deletionRequestsHandledBy: "叶佳鑫",
    },
    timingNote:
      "createdAt和updatedAt均不能冒充统一submittedAt；UTC自然年审查点需结合真实提交/重提历史人工复核。",
    summary: {
      inputRecords: records.length,
      reviewItems: items.filter(
        (item) =>
          item.review !== "not-yet-one-year" &&
          item.review !== "long-term-member",
      ).length,
      longTermMembers: items.filter(
        (item) => item.review === "long-term-member",
      ).length,
      notYetOneYear: items.filter((item) => item.review === "not-yet-one-year")
        .length,
    },
    items,
  };
}
