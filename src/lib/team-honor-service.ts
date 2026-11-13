import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import {
  APIError,
  createLocalReq,
  type Payload,
  type PayloadRequest,
} from "payload";
import type { TeamHonorRecord, User } from "../payload-types";
import { canUseCampus, canReviewShowcase, relationID } from "./rules";
import { workflowTransaction } from "./workflow-transactions";
import { controlledVideoName } from "./showcase-videos";
import {
  honorVideoVersion,
  privateHonorVideoName,
  reserveLegacyHonorVideo,
} from "./team-honor-videos";
import { normalizeShowcaseImage } from "./showcase-images";
import {
  type HonorMembershipAuthority,
  type HonorTeam,
} from "./team-honor-authority";
import { getActiveTeamMembership } from "./team-memberships";
import { createCoreTeamHonorAuthority } from "./team-honor-core-adapter";
import { withHonorProjection, withHonorWrite } from "./team-honor-grants";
import {
  completeHonor,
  honorArchiveHref,
  honorID,
  honorReviewNote,
  honorText,
  honorVersion,
  legacyHonorDate,
  nextHonorState,
  type HonorAction,
  type HonorContent,
  type HonorHistory,
  type HonorImage,
  type HonorInput,
} from "./team-honor-model";

type HonorVersionRecord = Pick<
  TeamHonorRecord,
  | "title"
  | "competition"
  | "placing"
  | "date"
  | "description"
  | "images"
  | "videoURL"
  | "team"
  | "game"
  | "author"
  | "authorName"
  | "season"
>;
function contentOf(doc: HonorVersionRecord): HonorContent {
  return {
    title: doc.title,
    competition: doc.competition || "",
    placing: doc.placing || "",
    date: doc.date || null,
    description: doc.description || "",
    images: Array.isArray(doc.images)
      ? (doc.images as unknown as HonorImage[])
      : [],
    videoURL: doc.videoURL || null,
  };
}
function attributionOf(doc: HonorVersionRecord) {
  return {
    team: honorID(doc.team),
    game: honorID(doc.game),
    author: honorID(doc.author),
    authorName: doc.authorName,
    season: doc.season ? honorID(doc.season) : null,
  };
}
export async function currentHonorVersion(doc: HonorVersionRecord) {
  const content = contentOf(doc);
  if (
    content.images.length > 6 ||
    content.images.some(
      (image) =>
        typeof image.source !== "string" ||
        !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(image.source) ||
        typeof image.caption !== "string",
    )
  )
    throw new APIError("证据图片已失效，请重新上传并审核", 409);
  const videoVersion = content.videoURL
    ? await honorVideoVersion(content.videoURL)
    : null;
  return {
    version: honorVersion(content, attributionOf(doc), videoVersion),
    videoVersion,
    content,
  };
}
async function normalizeContent(
  input: HonorInput,
  current?: TeamHonorRecord,
): Promise<HonorContent> {
  const old = current ? contentOf(current) : undefined;
  const content = honorText(input as Record<string, unknown>, old);
  if (!content.title) throw new APIError("请填写荣誉标题", 400);
  if (input.images !== undefined) {
    if (!Array.isArray(input.images) || input.images.length > 6)
      throw new APIError("最多上传 6 份证据图片", 400);
    content.images = await Promise.all(
      input.images.map(async (image) => {
        if (
          !image ||
          typeof image !== "object" ||
          typeof image.caption !== "string" ||
          image.caption.length > 200
        )
          throw new APIError("证据图片与说明无效", 400);
        // Retain already-normalized bytes exactly when changing a caption or other text.
        const retained = old?.images.find(
          (previous) => previous.source === image.source,
        );
        const source = retained
          ? retained.source
          : await normalizeShowcaseImage(image.source).catch(() => {
              throw new APIError(
                "请上传 2 MB 以内的静态 PNG、JPEG 或 WebP 证据图片",
                400,
              );
            });
        return { source, caption: image.caption.trim() };
      }),
    );
  }
  if (content.videoURL) {
    if (
      typeof content.videoURL !== "string" ||
      (!privateHonorVideoName(content.videoURL) &&
        !(
          current?.videoURL === content.videoURL &&
          controlledVideoName(content.videoURL)
        ))
    )
      throw new APIError(
        "荣誉证据只接受本站上传的 MP4，外链不能作为审核证据",
        400,
      );
    await honorVideoVersion(content.videoURL);
  }
  return content;
}
async function lockHonor(req: PayloadRequest, id: number) {
  const db = req.payload.db as unknown as PostgresAdapter,
    transactionID = await req.transactionID;
  const session =
    transactionID != null ? db.sessions[String(transactionID)] : null;
  if (!session) throw new APIError("暂时无法安全保存荣誉，请稍后重试", 503);
  await session.db.execute(
    sql`SELECT id FROM team_honor_records WHERE id=${id} FOR UPDATE`,
  );
}
async function lockHonorActor(req: PayloadRequest) {
  const db = req.payload.db as unknown as PostgresAdapter,
    transactionID = await req.transactionID;
  const session =
    transactionID != null ? db.sessions[String(transactionID)] : null;
  if (!session) throw new APIError("暂时无法安全核验审核权限", 503);
  await session.db.execute(
    sql`SELECT id FROM users WHERE id=${req.user!.id} FOR SHARE`,
  );
}
export type PublicHonor = Omit<HonorContent, "videoURL"> & {
  legacyRevision?: string;
  key: string;
  authorName: string;
  approvedAt: string | null;
  legacy: boolean;
  videoVersion: string | null;
  videoHref: string | null;
  sourceHref: string | null;
};
export type HonorArchive = {
  key: string;
  team: HonorTeam;
  href: string;
  records: PublicHonor[];
};

export function createTeamHonorService(authority: HonorMembershipAuthority) {
  function projectRecord(
    row: Pick<
      TeamHonorRecord,
      "id" | "authorName" | "approvedAt" | "approvedVersion" | "videoURL"
    >,
    observed: Awaited<ReturnType<typeof currentHonorVersion>>,
  ): PublicHonor {
    const content = observed.content;
    return {
      title: content.title,
      competition: content.competition,
      placing: content.placing,
      date: content.date,
      description: content.description,
      images: content.images,
      key: "team-honor-records:" + row.id,
      authorName: row.authorName,
      approvedAt: row.approvedAt || null,
      legacy: false,
      videoVersion: observed.videoVersion,
      videoHref: row.videoURL
        ? "/api/team-honor-evidence/" +
          row.id +
          "/video?version=" +
          row.approvedVersion
        : null,
      sourceHref: null,
    };
  }
  async function publicEvidence(
    p: Payload,
    id: number,
  ): Promise<{ record: PublicHonor; storageURL: string | null } | null> {
    const req = await createLocalReq({}, p);
    req.user = null;
    return withHonorProjection(req, async () => {
      const row = await p
        .findByID({
          collection: "team-honor-records",
          id,
          req,
          user: null,
          overrideAccess: false,
          depth: 0,
          select: {
            title: true,
            team: true,
            game: true,
            season: true,
            author: true,
            authorName: true,
            competition: true,
            placing: true,
            date: true,
            description: true,
            images: true,
            videoURL: true,
            approvedVersion: true,
            approvedAt: true,
          },
        })
        .catch(() => null);
      if (!row?.approvedVersion) return null;
      const team = await authority.publicTeam(req, honorID(row.team));
      if (!team?.active || team.game !== honorID(row.game)) return null;
      const observed = await currentHonorVersion(row).catch(() => null);
      return observed?.version === row.approvedVersion
        ? {
            record: projectRecord(row, observed),
            storageURL: row.videoURL || null,
          }
        : null;
    });
  }
  async function publicRecord(
    p: Payload,
    id: number,
  ): Promise<PublicHonor | null> {
    return (await publicEvidence(p, id))?.record || null;
  }
  async function availableTeams(p: Payload, actor: User | null) {
    if (!canUseCampus(actor)) return [];
    // Fresh actor and same authority as writes; never accept the session's cached membership list.
    return workflowTransaction(p, actor, {}, (req) =>
      authority.activeMemberships(req, req.user!.id as number),
    );
  }
  async function change(
    p: Payload,
    actor: User | null,
    action: HonorAction,
    options: {
      id?: unknown;
      revision?: unknown;
      note?: unknown;
      submittedVersion?: unknown;
      input?: HonorInput;
    } = {},
  ) {
    if (
      ![
        "save",
        "submit",
        "withdraw",
        "approve",
        "return",
        "reject",
        "hide",
      ].includes(action)
    )
      throw new APIError("荣誉操作无效", 400);
    const id = options.id ? honorID(options.id) : undefined;
    return workflowTransaction(p, actor, {}, async (req) => {
      const user = req.user as User;
      await lockHonorActor(req);
      if (id) await lockHonor(req, id);
      const current = id
        ? await p.findByID({
            collection: "team-honor-records",
            id,
            req,
            overrideAccess: false,
            depth: 0,
          })
        : undefined;
      // Reserve pre-isolation identifiers before any edit can remove the last current reference.
      if (current?.videoURL) await reserveLegacyHonorVideo(current.videoURL);
      if (current && Number(options.revision) !== current.revision)
        throw new APIError("荣誉记录已更新，请刷新后核对", 409);
      if (!current && options.revision)
        throw new APIError("荣誉记录不存在，请刷新后重试", 409);
      const owner = !current || honorID(current.author) === user.id;
      const reviewer = Boolean(
        current && canReviewShowcase(user, current.game) && !owner,
      );
      const authorAction =
        ["save", "submit", "withdraw"].includes(action) ||
        (action === "hide" && owner);
      if (authorAction && !owner)
        throw new APIError("只能更新本人的荣誉记录", 403);
      if (!authorAction && !reviewer)
        throw new APIError(
          "仅对应社群的当前管理员或社长、副社长可以审核他人的荣誉",
          403,
        );
      const state = nextHonorState(current?.state ?? "new", action),
        note = honorReviewNote(options.note, action);
      const input = options.input ?? {};
      const team = current ? honorID(current.team) : honorID(input.team);
      for (const key of ["team", "season"] as const) {
        if (
          current &&
          input[key] !== undefined &&
          String(relationID(input[key]) ?? "") !==
            String(relationID(current[key]) ?? "")
        )
          throw new APIError("荣誉的历史队伍和赛季归属不可更换", 403);
      }
      const membership =
        authorAction || action === "approve"
          ? await authority.activeMembership(
              req,
              current ? honorID(current.author) : user.id,
              team,
            )
          : null;
      if (
        membership &&
        (membership.member !== (current ? honorID(current.author) : user.id) ||
          membership.team !== team ||
          !membership.teamInfo.active)
      )
        throw new APIError("当前有效队员关系与所选队伍不匹配", 403);
      if (current && membership && membership.id !== current.membershipRef)
        throw new APIError(
          "原入队关系已结束；请以当前入队关系新建记录，历史批准荣誉保留",
          409,
        );
      const publicTeam = await authority.publicTeam(req, team);
      if (
        (authorAction || action === "approve") &&
        (!publicTeam?.active ||
          !membership ||
          publicTeam.game !== membership.teamInfo.game)
      )
        throw new APIError("队伍或所属社群已停用，不能新写入或批准荣誉", 409);
      if (current && publicTeam && publicTeam.game !== honorID(current.game))
        throw new APIError("队伍所属社群已变化，请联系负责人核对历史归属", 409);
      const season = current?.season
        ? honorID(current.season)
        : input.season
          ? honorID(input.season)
          : null;
      if (season && ["save", "submit"].includes(action)) {
        const row = await p
          .findByID({
            collection: "seasons",
            id: season,
            req: { ...req, user: null },
            user: null,
            overrideAccess: false,
            draft: false,
            depth: 0,
          })
          .catch(() => null);
        if (!row || honorID(row.team) !== team)
          throw new APIError("荣誉赛季必须属于所选代表队", 400);
      }
      const content = ["save", "submit"].includes(action)
        ? await normalizeContent(input, current)
        : current
          ? contentOf(current)
          : null;
      if (!content) throw new APIError("缺少荣誉内容", 400);
      const data: Record<string, unknown> = {
        state,
        revision: (current?.revision ?? 0) + 1,
      };
      if (!current)
        Object.assign(data, {
          team,
          game: membership!.teamInfo.game,
          season,
          author: user.id,
          authorName: user.name,
          membershipRef: membership!.id,
        });
      if (["save", "submit"].includes(action)) Object.assign(data, content);
      let version: string | undefined;
      if (action === "submit") {
        completeHonor(content);
        const videoVersion = content.videoURL
          ? await honorVideoVersion(content.videoURL)
          : null;
        version = honorVersion(
          content,
          current
            ? attributionOf(current)
            : {
                team,
                game: membership!.teamInfo.game,
                author: user.id,
                authorName: user.name,
                season,
              },
          videoVersion,
        );
        Object.assign(data, {
          submittedVersion: version,
          submittedAt: new Date().toISOString(),
          reviewNote: null,
          reviewedBy: null,
        });
        if (
          current?.state === "pending" &&
          version === current.submittedVersion
        )
          throw new APIError("记录已经待审核；修改内容后可重新提交", 409);
        if (
          current?.state === "approved" &&
          version === current.approvedVersion
        )
          throw new APIError("已批准内容未变化；修改后才需要重新审核", 409);
      }
      if (action === "approve") {
        completeHonor(content);
        const observed = await currentHonorVersion(current!);
        version = observed.version;
        if (
          !current!.submittedVersion ||
          options.submittedVersion !== current!.submittedVersion ||
          current!.submittedVersion !== version
        )
          throw new APIError(
            "待审核内容或证据字节已变化，请退回后修改重提",
            409,
          );
        Object.assign(data, {
          approvedVersion: version,
          approvedSnapshot: {
            ...content,
            ...attributionOf(current!),
            videoVersion: observed.videoVersion,
          },
          approvedAt: new Date().toISOString(),
        });
      }
      if (["approve", "return", "reject", "hide"].includes(action))
        Object.assign(data, { reviewNote: note, reviewedBy: user.id });
      // Withdraw/save keep the old approval snapshot solely as private historical evidence.
      const entry: HonorHistory = {
        action,
        actor: user.id,
        actorName: user.name,
        at: new Date().toISOString(),
        from: current?.state ?? "new",
        to: state,
        revision: data.revision as number,
        note,
        ...(version ? { version } : {}),
        ...(action === "approve"
          ? {
              approvedSnapshot: data.approvedSnapshot as Record<
                string,
                unknown
              >,
            }
          : {}),
      };
      data.history = [
        ...(Array.isArray(current?.history)
          ? (current.history as unknown as HonorHistory[])
          : []),
        entry,
      ];
      const saved = await withHonorWrite(req, { action, id, data }, () =>
        current
          ? p.update({
              collection: "team-honor-records",
              id: current.id,
              req,
              overrideAccess: false,
              data,
            })
          : p.create({
              collection: "team-honor-records",
              req,
              overrideAccess: false,
              data: data as unknown as Omit<
                TeamHonorRecord,
                "id" | "createdAt" | "updatedAt"
              >,
            }),
      );
      await p.create({
        collection: "audit",
        req,
        overrideAccess: true,
        data: {
          actor: String(user.id),
          object: "team-honor-records:" + saved.id,
          action: action + ":" + entry.from + "->" + state,
          status: state,
        },
      });
      return saved;
    });
  }
  async function archives(
    p: Payload,
    filter: { game?: number; team?: number } = {},
  ): Promise<HonorArchive[]> {
    const req = await createLocalReq({}, p);
    req.user = null;
    return withHonorProjection(req, async () => {
      const rows = await p.find({
        collection: "team-honor-records",
        req,
        user: null,
        overrideAccess: false,
        depth: 0,
        pagination: false,
        where: {
          and: [
            { state: { equals: "approved" } },
            ...(filter.game ? [{ game: { equals: filter.game } }] : []),
            ...(filter.team ? [{ team: { equals: filter.team } }] : []),
          ],
        },
        select: {
          title: true,
          team: true,
          game: true,
          season: true,
          author: true,
          authorName: true,
          competition: true,
          placing: true,
          date: true,
          description: true,
          images: true,
          videoURL: true,
          approvedVersion: true,
          approvedAt: true,
        },
      });
      const legacy = await p.find({
        collection: "honors",
        req,
        user: null,
        overrideAccess: false,
        depth: 0,
        draft: false,
        pagination: false,
        where: {
          and: [
            { _status: { equals: "published" } },
            { verified: { equals: true } },
            ...(filter.team ? [{ team: { equals: filter.team } }] : []),
          ],
        },
        select: {
          title: true,
          team: true,
          game: true,
          competition: true,
          placing: true,
          date: true,
          summary: true,
          sourceURL: true,
          slug: true,
          updatedAt: true,
        },
      });
      const result = new Map<number, HonorArchive>(),
        teams = new Map<number, HonorTeam | null>();
      async function archive(teamID: number) {
        if (!teams.has(teamID))
          teams.set(teamID, await authority.publicTeam(req, teamID));
        const team = teams.get(teamID);
        if (!team?.active || (filter.game && filter.game !== team.game))
          return null;
        if (!result.has(teamID))
          result.set(teamID, {
            key: "team-honors:" + teamID,
            team,
            href: honorArchiveHref(team.gameSlug, teamID),
            records: [],
          });
        return result.get(teamID)!;
      }
      for (const row of rows.docs) {
        const target = await archive(honorID(row.team));
        if (!target || target.team.game !== honorID(row.game)) continue;
        const observed = await currentHonorVersion(row).catch(() => null);
        if (
          !observed ||
          !row.approvedVersion ||
          observed.version !== row.approvedVersion
        )
          continue;
        target.records.push(projectRecord(row, observed));
      }
      for (const row of legacy.docs) {
        const legacyTeam = Number(relationID(row.team));
        if (!Number.isSafeInteger(legacyTeam) || legacyTeam <= 0) continue;
        const target = await archive(legacyTeam);
        if (!target) continue;
        if (row.game && honorID(row.game) !== target.team.game) continue;
        target.records.push({
          title: row.title,
          competition: row.competition,
          placing: row.placing,
          date: legacyHonorDate(row.date),
          description: row.summary || "",
          images: [],
          key: "honors:" + row.id,
          authorName: "历史荣誉档案",
          approvedAt: null,
          legacy: true,
          legacyRevision: row.updatedAt,
          videoVersion: null,
          videoHref: null,
          sourceHref: "/honors/" + row.slug,
        });
      }
      return [...result.values()]
        .filter((item) => item.records.length > 0)
        .map((item) => ({
          ...item,
          records: item.records.sort(
            (a, b) =>
              (b.date || "").localeCompare(a.date || "") ||
              a.key.localeCompare(b.key),
          ),
        }))
        .sort(
          (a, b) =>
            a.team.title.localeCompare(b.team.title, "zh-CN") ||
            a.team.id - b.team.id,
        );
    });
  }
  return { availableTeams, change, archives, publicRecord, publicEvidence };
}
export const teamHonorService = createTeamHonorService(
  createCoreTeamHonorAuthority({ getActiveTeamMembership }),
);
