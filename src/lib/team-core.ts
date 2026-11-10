import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { APIError, type Payload, type PayloadRequest } from "payload";
import type {
  User,
  TeamJoinApplication,
  TeamRecruitment,
} from "../payload-types";
import { canParticipate, canPublish } from "./rules";
import { workflowTransaction, uniqueFieldError } from "./workflow-transactions";
import { lockTeamLifecycle } from "./team-locks";
import { formVersion } from "./activity-signups";
import {
  normalizeSignup,
  validateAnswers,
  type SignupForm,
  type Answers,
} from "./signup-schema";
import { sanitizeDraft } from "./questionnaire-model";
import {
  canProposeTeam,
  currentTeamActor,
  getTeamMembership,
  isEstablishedTeam,
  positiveID,
  requireTeamManager,
} from "./team-memberships";

export const teamApplicationLabels: Record<string, string> = {
  draft: "草稿",
  pending: "待人工审核",
  returned: "退回补充",
  rejected: "未通过",
  withdrawn: "已撤回",
  approved: "已批准",
};
export const teamRecruitmentLabels: Record<string, string> = {
  draft: "草稿",
  open: "招新开放",
  closed: "已关闭",
  archived: "已归档",
};
export const teamLifecycleLabels: Record<string, string> = {
  unestablished: "尚未批准成立",
  active: "活跃",
  resting: "休整",
  archived: "已归档",
};
export { defaultTeamForm } from "./team-recruitment-form";

export function normalizeTeamForm(raw: unknown) {
  let form: SignupForm;
  try {
    form = normalizeSignup(raw);
  } catch (error) {
    throw new APIError((error as Error).message, 400);
  }
  const core = ["gameID", "position", "experience", "availability", "contact"];
  for (const id of core) {
    const question = form.questions.find((q) => q.id === id);
    if (
      !question ||
      !question.required ||
      !["text", "textarea"].includes(question.type) ||
      question.display ||
      question.showWhen
    )
      throw new APIError(
        "入队表单须保留可见必填的游戏 ID、位置、经历、训练时间和一种联系方式",
        400,
      );
  }
  // A required question can still be skipped by an earlier branch or $end jump.
  form.questions.forEach((question, index) => {
    for (const jump of question.jumps ?? []) {
      const target =
        jump.target === "$end"
          ? form.questions.length
          : form.questions.findIndex((q) => q.id === jump.target);
      if (
        form.questions.slice(index + 1, target).some((q) => core.includes(q.id))
      )
        throw new APIError(
          "跳转不能跳过入队核心资料，请将分支放在核心资料之后或仅跳过扩展题",
          400,
        );
    }
  });
  const sensitive =
    /身份证|证件号码|家庭住址|居住地址|详细地址|健康|病史|密码|银行卡|护照|身份证件|id\s*card|passport|password|home\s*address|medical/i;
  if (
    form.questions.some((q) =>
      sensitive.test(
        [
          q.label,
          q.help,
          q.placeholder,
          ...(q.fields ?? []).map((f) => `${f.label} ${f.placeholder ?? ""}`),
        ].join(" "),
      ),
    )
  )
    throw new APIError(
      "入队表单仅收选拔所需资料，请移除身份证、住址、健康、密码等无关题目",
      400,
    );
  return form;
}
export const teamID = (raw: unknown) => {
  const id = positiveID(raw);
  if (!id) throw new APIError("代表队记录不存在", 404);
  return id;
};
function text(raw: unknown, label: string, min: number, max: number) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < min || value.length > max)
    throw new APIError(`${label}需为 ${min}–${max} 字`, 400);
  return value;
}
const revisionCheck = (revision: unknown, doc: { updatedAt: string }) => {
  if (revision !== doc.updatedAt)
    throw new APIError("记录已变化，请刷新后核对再保存", 409);
};
async function tx<T>(
  p: Payload,
  actor: User | null,
  work: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  // Serializable retries re-read current authority and state. Business conflicts stay visible.
  for (let attempt = 0; ; attempt++) {
    try {
      return await workflowTransaction(p, actor, { teamCoreWrite: true }, work);
    } catch (error) {
      if (
        attempt < 2 &&
        ["membershipKey", "requestKey"].some((field) =>
          uniqueFieldError(error, field),
        )
      )
        continue;
      if (
        attempt < 2 &&
        error instanceof APIError &&
        error.status === 409 &&
        [
          "记录已更新，请刷新后重试",
          "已有同一申请，请在我的申请中继续处理",
        ].includes(error.message)
      )
        continue;
      throw error;
    }
  }
}
async function publishedGame(p: Payload, id: number, req: PayloadRequest) {
  const game = await p
    .findByID({
      collection: "games",
      id,
      req: { ...req, user: null },
      user: null,
      overrideAccess: false,
      draft: false,
      depth: 0,
      select: { title: true, _status: true, archived: true },
    })
    .catch(() => null);
  if (!game || game._status !== "published" || game.archived)
    throw new APIError("该游戏社群未开放", 404);
  return game;
}
export async function submitTeamEstablishment(
  p: Payload,
  actor: User | null,
  input: {
    gameID: unknown;
    title: unknown;
    reason: unknown;
    id?: unknown;
    revision?: unknown;
  },
) {
  return tx(p, actor, async (req) => {
    const gameID = teamID(input.gameID),
      user = req.user as User;
    await publishedGame(p, gameID, req);
    if (!canProposeTeam(user, gameID))
      throw new APIError("仅该社群当前管理员可申请建队", 403);
    const title = text(input.title, "拟用队名", 2, 80),
      reason = text(input.reason, "组织与训练计划", 10, 3000);
    const requestKey = createHash("sha256")
      .update(`${gameID}:${title.toLocaleLowerCase("zh-CN")}`)
      .digest("hex");
    const existing = (
      await p.find({
        collection: "team-establishment-applications",
        req,
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { requestKey: { equals: requestKey } },
      })
    ).docs[0];
    let doc = input.id
      ? await p.findByID({
          collection: "team-establishment-applications",
          id: teamID(input.id),
          req,
          overrideAccess: false,
          depth: 0,
        })
      : null;
    if (existing && existing.id !== doc?.id) {
      if (
        positiveID(existing.applicant) === user.id &&
        existing.status === "pending" &&
        existing.reason === reason
      )
        return existing;
      throw new APIError(
        "同一社群已有此队名申请，请在本人申请中处理或调整队名",
        409,
      );
    }
    if (doc) {
      if (
        positiveID(doc.applicant) !== user.id ||
        positiveID(doc.game) !== gameID
      )
        throw new APIError("只能修改本人原社群的建队申请", 403);
      revisionCheck(input.revision, doc);
      if (!["returned", "withdrawn"].includes(doc.status))
        throw new APIError("仅退回或撤回的建队申请可以重提", 409);
    }
    const data = {
      title,
      reason,
      game: gameID,
      applicant: user.id,
      requestKey,
      status: "pending" as const,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
    };
    doc = doc
      ? await p.update({
          collection: "team-establishment-applications",
          id: doc.id,
          data,
          req,
          overrideAccess: false,
        })
      : await p.create({
          collection: "team-establishment-applications",
          data,
          req,
          overrideAccess: false,
        });
    return doc;
  });
}
export async function withdrawTeamEstablishment(
  p: Payload,
  actor: User | null,
  id: number,
  revision: unknown,
) {
  return tx(p, actor, async (req) => {
    const doc = await p.findByID({
      collection: "team-establishment-applications",
      id,
      req,
      overrideAccess: false,
      depth: 0,
    });
    if (positiveID(doc.applicant) !== req.user!.id)
      throw new APIError("只能撤回本人的建队申请", 403);
    if (doc.status === "withdrawn") return doc;
    revisionCheck(revision, doc);
    if (!["pending", "returned"].includes(doc.status))
      throw new APIError("此建队申请不能撤回", 409);
    return p.update({
      collection: "team-establishment-applications",
      id,
      req,
      overrideAccess: false,
      data: { status: "withdrawn" },
    });
  });
}
export async function decideTeamEstablishment(
  p: Payload,
  actor: User | null,
  id: number,
  decision: unknown,
  note: unknown,
  revision: unknown,
) {
  return tx(p, actor, async (req) => {
    if (!canPublish(req.user as User))
      throw new APIError("仅当前高权限管理人员可批准建队", 403);
    const doc = await p.findByID({
      collection: "team-establishment-applications",
      id,
      req,
      overrideAccess: false,
      depth: 0,
    });
    if (decision === "approved" && doc.status === "approved") return doc;
    revisionCheck(revision, doc);
    if (doc.status !== "pending") throw new APIError("建队申请已处理", 409);
    if (!["approved", "returned", "rejected"].includes(String(decision)))
      throw new APIError("审核决定无效", 400);
    const reviewNote = text(
        note ?? "",
        "审核意见",
        decision === "approved" ? 0 : 1,
        1000,
      ),
      gameID = teamID(doc.game);
    let createdTeam: number | null = null;
    if (decision === "approved") {
      await publishedGame(p, gameID, req);
      const applicant = await currentTeamActor(
        p,
        { id: teamID(doc.applicant) },
        req,
      );
      if (!canProposeTeam(applicant, gameID))
        throw new APIError("申请者已无该社群任职，请退回或拒绝处理", 409);
      const team = await p.create({
        collection: "teams",
        req: { ...req, context: { ...req.context, system: true } },
        overrideAccess: true,
        data: {
          title: doc.title,
          slug: `team-${doc.id}`,
          game: gameID,
          summary: "代表队已获建队审核批准，选拔与训练安排由该社群管理员公布。",
          _status: "published",
          reviewState: "approved",
          teamStatus: "active",
          establishmentApplication: doc.id,
        },
      });
      createdTeam = team.id;
    }
    return p.update({
      collection: "team-establishment-applications",
      id,
      req,
      overrideAccess: false,
      data: {
        status: decision as "approved" | "returned" | "rejected",
        reviewNote,
        reviewedBy: req.user!.id,
        reviewedAt: new Date().toISOString(),
        team: createdTeam,
      },
    });
  });
}
export async function changeTeamLifecycle(
  p: Payload,
  actor: User | null,
  id: number,
  status: unknown,
  revision: unknown,
) {
  return tx(p, actor, async (req) => {
    await requireTeamManager(p, req.user as User, id, req);
    await lockTeamLifecycle(req, id, true);
    const team = await p.findByID({
      collection: "teams",
      id,
      req,
      overrideAccess: true,
      depth: 0,
    });
    revisionCheck(revision, team);
    if (
      !team.establishmentApplication ||
      !["active", "resting", "archived"].includes(String(status))
    )
      throw new APIError("队伍运营状态无效", 409);
    if (
      (team.teamStatus === "archived" || team.archived === true) &&
      !canPublish(req.user as User)
    )
      throw new APIError("归档队伍恢复需高权限管理审核", 403);
    if (status !== "active") {
      const batches = await p.find({
        collection: "team-recruitments",
        req,
        overrideAccess: false,
        depth: 0,
        pagination: false,
        where: {
          and: [{ team: { equals: id } }, { status: { equals: "open" } }],
        },
      });
      for (const batch of batches.docs)
        await p.update({
          collection: "team-recruitments",
          id: batch.id,
          req,
          overrideAccess: false,
          data: { status: "closed" },
        });
    }
    return p.update({
      collection: "teams",
      id,
      req: { ...req, context: { ...req.context, system: true } },
      overrideAccess: true,
      data: {
        teamStatus: status as "active" | "resting" | "archived",
        archived: status === "archived",
      },
    });
  });
}
export async function saveTeamRecruitment(
  p: Payload,
  actor: User | null,
  input: {
    teamID: unknown;
    id?: unknown;
    revision?: unknown;
    title: unknown;
    status: unknown;
    form: unknown;
  },
) {
  return tx(p, actor, async (req) => {
    const id = teamID(input.teamID);
    await requireTeamManager(p, req.user as User, id, req);
    await lockTeamLifecycle(req, id);
    if (!(await isEstablishedTeam(p, id, req)))
      throw new APIError("队伍尚未批准成立或已归档，不能配置招新", 409);
    const team = await p.findByID({
      collection: "teams",
      id,
      req,
      overrideAccess: true,
      depth: 0,
      select: { game: true, teamStatus: true },
    });
    if (
      typeof input.status !== "string" ||
      !["draft", "open", "closed", "archived"].includes(input.status)
    )
      throw new APIError("招新状态无效", 400);
    const title = text(input.title, "批次名称", 2, 120),
      form = normalizeTeamForm(input.form);
    if (input.status === "open") {
      if (team.teamStatus !== "active")
        throw new APIError(
          "请在工作台的「调整队伍状态」中将队伍设为活跃，再发布招新",
          400,
        );
      if (!form.enabled || form.closed)
        throw new APIError("发布招新需启用问卷并接收报名", 400);
      if (!form.end)
        throw new APIError("发布招新前请填写报名截止时间", 400);
      if (Date.parse(form.end) <= Date.now())
        throw new APIError("报名截止时间须晚于当前时间", 400);
    }
    const doc = input.id
      ? await p.findByID({
          collection: "team-recruitments",
          id: teamID(input.id),
          req,
          overrideAccess: false,
          depth: 0,
        })
      : null;
    if (doc) {
      if (positiveID(doc.team) !== id)
        throw new APIError("招新批次不属于此代表队", 403);
      revisionCheck(input.revision, doc);
      if (doc.status === "archived" && input.status !== "archived")
        throw new APIError("归档批次不能重开，请创建新批次", 409);
    }
    if (input.status === "open") {
      const other = await p.find({
        collection: "team-recruitments",
        req,
        overrideAccess: false,
        depth: 0,
        limit: 1,
        where: {
          and: [
            { team: { equals: id } },
            { status: { equals: "open" } },
            ...(doc ? [{ id: { not_equals: doc.id } }] : []),
          ],
        },
      });
      if (other.docs.length)
        throw new APIError("该队已有开放批次，请先关闭旧批次", 409);
    }
    const data = {
      title,
      team: id,
      game: teamID(team.game),
      status: input.status as TeamRecruitment["status"],
      signupForm: form,
    };
    return doc
      ? p.update({
          collection: "team-recruitments",
          id: doc.id,
          req,
          overrideAccess: false,
          data,
        })
      : p.create({
          collection: "team-recruitments",
          req,
          overrideAccess: false,
          data: { ...data, createdBy: req.user!.id },
        });
  });
}
export async function closeTeamRecruitment(
  p: Payload,
  actor: User | null,
  id: number,
  status: "closed" | "archived",
  revision: unknown,
) {
  return tx(p, actor, async (req) => {
    const doc = await p.findByID({
      collection: "team-recruitments",
      id,
      req,
      overrideAccess: false,
      depth: 0,
    });
    await requireTeamManager(p, req.user as User, teamID(doc.team), req);
    if (doc.status === status) return doc;
    revisionCheck(revision, doc);
    if (doc.status === "archived") throw new APIError("该批次已归档", 409);
    return p.update({
      collection: "team-recruitments",
      id,
      req,
      overrideAccess: false,
      data: { status },
    });
  });
}
export function teamRecruitmentState(
  doc: Pick<TeamRecruitment, "status">,
  form: SignupForm,
  now = Date.now(),
) {
  if (doc.status !== "open" || !form.enabled || form.closed)
    return "招新已关闭";
  if (form.start && now < Date.parse(form.start)) return "招新尚未开始";
  if (form.end && now >= Date.parse(form.end)) return "招新已截止";
  return "招新开放";
}
export async function teamRecruitmentInfo(
  p: Payload,
  actor: User | null,
  id: number,
  req?: PayloadRequest,
) {
  const fresh = await currentTeamActor(p, actor, req);
  if (!canParticipate(fresh)) throw new APIError("请先登录可用账号", 401);
  const fullActor: User = { ...actor!, ...fresh!, collection: "users" };
  const currentReq = req ? { ...req, user: fullActor } : undefined;
  const own =
    (
      await p.find({
        collection: "team-join-applications",
        req: currentReq,
        user: fullActor,
        overrideAccess: false,
        depth: 0,
        limit: 1,
        where: {
          and: [
            { recruitment: { equals: id } },
            { applicant: { equals: fresh!.id } },
          ],
        },
      })
    ).docs[0] ?? null;
  const doc = await p
    .findByID({
      collection: "team-recruitments",
      id,
      req: currentReq,
      user: fullActor,
      overrideAccess: false,
      depth: 0,
    })
    .catch((error: unknown) => {
      if (error instanceof APIError && [403, 404].includes(error.status))
        return null;
      throw error;
    });
  if (!doc) {
    if (!own || positiveID(own.applicant) !== fresh!.id)
      throw new APIError("招新批次未开放", 404);
    // No privileged/anonymous read of the hidden batch. Only the owner's saved version is returned.
    const snapshot = normalizeSignup(own.formSnapshot);
    const historical = {
      id,
      title: own.title,
      team: teamID(own.team),
      game: teamID(own.game),
    };
    return {
      doc: historical,
      form: { ...snapshot, enabled: false, closed: true },
      version: own.formVersion,
      state: "历史申请只读",
      own,
      readOnly: true,
    };
  }
  const form = normalizeTeamForm(doc.signupForm);
  const established = await isEstablishedTeam(p, teamID(doc.team), req);
  const state = established
    ? teamRecruitmentState(doc, form)
    : "队伍未开放招新";
  return { doc, form, version: formVersion(form), state, own, readOnly: false };
}
export async function saveTeamJoinApplication(
  p: Payload,
  actor: User | null,
  id: number,
  input: {
    action: "draft" | "submit";
    version: unknown;
    revision?: unknown;
    answers: unknown;
  },
) {
  return tx(p, actor, async (req) => {
    const { doc, form, version, state, own } = await teamRecruitmentInfo(
      p,
      req.user as User,
      id,
      req,
    );
    const applicant = req.user as User,
      idTeam = teamID(doc.team);
    if (state !== "招新开放") throw new APIError(state, 409);
    if (input.version !== version)
      throw new APIError("申请表已更新，请刷新后核对新题目；原答案仍保留", 409);
    const membership = await getTeamMembership(p, {
      teamID: idTeam,
      userID: applicant.id,
      req,
    });
    if (membership?.status === "active")
      throw new APIError("你已经是该队成员，无需重复申请", 409);
    if (
      !input.answers ||
      typeof input.answers !== "object" ||
      Array.isArray(input.answers)
    )
      throw new APIError("申请答案格式无效", 400);
    let answers: Answers;
    try {
      answers =
        input.action === "submit"
          ? validateAnswers(form, input.answers)
          : sanitizeDraft(form, input.answers as Answers);
    } catch (error) {
      throw new APIError((error as Error).message, 400);
    }
    if (JSON.stringify(answers).length > 100000)
      throw new APIError("申请内容过长", 400);
    if (own) {
      if (own.status === "approved" || own.status === "rejected")
        throw new APIError(
          "此申请已完成审核，请查看结果；再次申请需新的招新批次",
          409,
        );
      // Identical network retries of a submitted application return its receipt.
      if (
        own.status === "pending" &&
        input.action === "submit" &&
        own.formVersion === version &&
        isDeepStrictEqual(own.answers, answers)
      )
        return own;
      if (
        own.status === "draft" &&
        input.action === "draft" &&
        own.formVersion === version &&
        isDeepStrictEqual(own.answers, answers)
      )
        return own;
      revisionCheck(input.revision, own);
    }
    const other = await p.find({
      collection: "team-join-applications",
      req,
      overrideAccess: false,
      depth: 0,
      limit: 1,
      where: {
        and: [
          { team: { equals: idTeam } },
          { applicant: { equals: applicant.id } },
          { recruitment: { not_equals: id } },
          { status: { in: ["draft", "pending", "returned"] } },
        ],
      },
    });
    if (other.docs.length)
      throw new APIError("该队已有未完成申请，请先处理原批次的申请", 409);
    const data = {
      title: `${doc.title} · ${applicant.name}`,
      team: idTeam,
      game: teamID(doc.game),
      recruitment: id,
      applicant: applicant.id,
      requestKey: `${id}:${applicant.id}`,
      status:
        input.action === "submit" ? ("pending" as const) : ("draft" as const),
      formVersion: version,
      formSnapshot: form,
      answers,
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
    };
    return own
      ? p.update({
          collection: "team-join-applications",
          id: own.id,
          req,
          overrideAccess: false,
          data,
        })
      : p.create({
          collection: "team-join-applications",
          req,
          overrideAccess: false,
          data,
        });
  });
}
export async function withdrawTeamJoinApplication(
  p: Payload,
  actor: User | null,
  id: number,
  revision: unknown,
) {
  return tx(p, actor, async (req) => {
    const doc = await p.findByID({
      collection: "team-join-applications",
      id,
      req,
      overrideAccess: false,
      depth: 0,
    });
    if (positiveID(doc.applicant) !== req.user!.id)
      throw new APIError("只能撤回本人入队申请", 403);
    if (doc.status === "withdrawn") return doc;
    revisionCheck(revision, doc);
    if (!["draft", "pending", "returned"].includes(doc.status))
      throw new APIError("此申请已完成审核，不能撤回；成员可使用离队入口", 409);
    // Withdrawal is available after closing/deadline; it cannot silently reopen recruitment.
    return p.update({
      collection: "team-join-applications",
      id,
      req,
      overrideAccess: false,
      data: { status: "withdrawn" },
    });
  });
}
export async function decideTeamJoinApplication(
  p: Payload,
  actor: User | null,
  id: number,
  decision: unknown,
  note: unknown,
  revision: unknown,
  seasonID?: unknown,
) {
  return tx(p, actor, async (req) => {
    const doc = await p.findByID({
      collection: "team-join-applications",
      id,
      req,
      overrideAccess: false,
      depth: 0,
    });
    const idTeam = teamID(doc.team);
    await requireTeamManager(p, req.user as User, idTeam, req);
    if (doc.status === "approved" && decision === "approved") return doc;
    revisionCheck(revision, doc);
    if (doc.status !== "pending")
      throw new APIError("申请已修改、撤回或已处理，请刷新后核对", 409);
    if (!["approved", "returned", "rejected"].includes(String(decision)))
      throw new APIError("审核决定无效", 400);
    const reviewNote = text(
      note ?? "",
      "审核意见",
      decision === "approved" ? 0 : 1,
      1000,
    );
    if (decision === "approved") {
      if (!(await isEstablishedTeam(p, idTeam, req)))
        throw new APIError("队伍已归档或关闭，不能录取成员", 409);
      const batch = await p.findByID({
        collection: "team-recruitments",
        id: teamID(doc.recruitment),
        req,
        overrideAccess: false,
        depth: 0,
      });
      if (batch.status === "archived")
        throw new APIError("招新批次已归档，不能继续录取", 409);
      const snapshot = normalizeTeamForm(doc.formSnapshot);
      // Review the submitted version, not a later questionnaire.
      try {
        validateAnswers(snapshot, doc.answers);
      } catch (error) {
        throw new APIError((error as Error).message, 400);
      }
      const applicant = await currentTeamActor(
        p,
        { id: teamID(doc.applicant) },
        req,
      );
      if (!canParticipate(applicant))
        throw new APIError("申请者账号已停用，不能录取", 409);
      const existing = await getTeamMembership(p, {
        teamID: idTeam,
        userID: applicant!.id,
        req,
      });
      let season: number | null = null;
      if (seasonID != null && seasonID !== "") {
        const record = await p.findByID({
          collection: "seasons",
          id: teamID(seasonID),
          req,
          overrideAccess: true,
          depth: 0,
        });
        if (positiveID(record.team) !== idTeam)
          throw new APIError("赛季必须属于该代表队", 400);
        season = record.id;
      }
      if (!existing || existing.status !== "active") {
        const team = await p.findByID({
          collection: "teams",
          id: idTeam,
          req,
          overrideAccess: true,
          depth: 0,
          select: { game: true },
        });
        const data = {
          title: `${applicant!.name} · ${doc.title}`,
          team: idTeam,
          game: teamID(team.game),
          member: applicant!.id,
          season,
          membershipKey: `${idTeam}:${applicant!.id}`,
          status: "active" as const,
          joinedAt: new Date().toISOString(),
          revokedAt: null,
          leftAt: null,
          sourceApplication: doc.id,
          grantedBy: req.user!.id,
          revokedBy: null,
          revocationReason: null,
        };
        if (existing)
          await p.update({
            collection: "team-memberships",
            id: existing.id,
            req,
            overrideAccess: false,
            data,
          });
        else
          await p.create({
            collection: "team-memberships",
            req,
            overrideAccess: false,
            data,
          });
      }
    }
    return p.update({
      collection: "team-join-applications",
      id,
      req,
      overrideAccess: false,
      data: {
        status: decision as "approved" | "returned" | "rejected",
        reviewNote,
        reviewedBy: req.user!.id,
        reviewedAt: new Date().toISOString(),
      },
    });
  });
}
export async function revokeTeamMembership(
  p: Payload,
  actor: User | null,
  id: number,
  revision: unknown,
  reason: unknown,
  leave = false,
) {
  return tx(p, actor, async (req) => {
    const doc = await p.findByID({
      collection: "team-memberships",
      id,
      req,
      overrideAccess: false,
      depth: 0,
    });
    if (leave ? positiveID(doc.member) !== req.user!.id : false)
      throw new APIError("只能为本人办理离队", 403);
    if (!leave)
      await requireTeamManager(p, req.user as User, teamID(doc.team), req);
    if (doc.status === "revoked") return doc;
    revisionCheck(revision, doc);
    const revocationReason = text(
        reason ?? "",
        leave ? "离队说明" : "撤销原因",
        leave ? 0 : 1,
        1000,
      ),
      at = new Date().toISOString();
    return p.update({
      collection: "team-memberships",
      id,
      req,
      overrideAccess: false,
      data: {
        status: "revoked",
        revokedAt: at,
        leftAt: leave ? at : null,
        revokedBy: req.user!.id,
        revocationReason,
      },
    });
  });
}
export const teamJoinReceipt = (doc: TeamJoinApplication | null) =>
  doc
    ? {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        teamID: positiveID(doc.team),
        recruitmentID: positiveID(doc.recruitment),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        formVersion: doc.formVersion,
        formSnapshot: doc.formSnapshot,
        answers: doc.answers,
        reviewNote: doc.reviewNote ?? null,
      }
    : null;
