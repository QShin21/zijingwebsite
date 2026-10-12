"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { honorError, saveHonorForm } from "@/lib/team-honor-web";
import { honorID, type HonorAction } from "@/lib/team-honor-model";
import { workflowTransaction } from "@/lib/workflow-transactions";
import { canReviewShowcase, relationID } from "@/lib/rules";
import { APIError } from "payload";

export type HonorFormState = { error?: string };
function invalidateHonors() {
  revalidatePath("/teams");
  revalidatePath("/honors");
  revalidatePath("/teams/honors");
  revalidatePath("/community", "layout");
}
export async function saveTeamHonorAction(
  _previous: HonorFormState,
  form: FormData,
): Promise<HonorFormState> {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  let id: number, state: string;
  try {
    const saved = await saveHonorForm(p, user, form);
    id = saved.id;
    state = saved.state;
  } catch (error) {
    return { error: honorError(error) };
  }
  invalidateHonors();
  redirect(
    "/teams/honors/" +
      id +
      "?message=" +
      encodeURIComponent(
        state === "pending"
          ? "荣誉已提交，等待对应社群管理员审核。"
          : "草稿已保存；须提交并由他人审核后公开。",
      ),
  );
}
export async function changeTeamHonorAction(form: FormData) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim();
  let id = 0,
    message: string;
  try {
    id = honorID(value("id"));
    const action = value("action") as HonorAction;
    if (!["withdraw", "approve", "return", "reject", "hide"].includes(action))
      throw new Error("Unsupported action");
    await teamHonorService.change(p, user, action, {
      id,
      revision: value("revision"),
      submittedVersion: value("submittedVersion"),
      note: value("note"),
    });
    const results = {
      withdraw: "已撤回待审荣誉。",
      approve: "荣誉已批准并实时加入队伍档案。",
      return: "已退回，作者可按说明修改后重提。",
      reject: "已拒绝，审核说明已保存。",
      hide: "荣誉已隐藏并从公开档案撤下。",
    };
    message = results[action as keyof typeof results];
  } catch (error) {
    message = honorError(error);
  }
  invalidateHonors();
  // Redirect targets are computed on the server, never supplied by the client.
  redirect(
    (id ? "/teams/honors/" + id : "/teams/honors") +
      "?message=" +
      encodeURIComponent(message),
  );
}
export async function hideLegacyTeamHonorAction(form: FormData) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  let message: string;
  try {
    const id = honorID(form.get("id"));
    await workflowTransaction(p, user, {}, async (req) => {
      const record = await p.findByID({
        collection: "honors",
        id,
        req: { ...req, user: null },
        user: null,
        overrideAccess: false,
        draft: false,
        depth: 0,
        select: {
          team: true,
          game: true,
          verified: true,
          _status: true,
          updatedAt: true,
        },
      });
      const team = await p.findByID({
        collection: "teams",
        id: Number(relationID(record.team)),
        req,
        overrideAccess: true,
        depth: 0,
        select: { game: true },
      });
      const game = relationID(record.game) ?? relationID(team.game);
      if (!canReviewShowcase(req.user, game))
        throw new APIError("无权撤下此社群的历史荣誉", 403);
      if (
        String(form.get("revision") ?? "") !== record.updatedAt ||
        record._status !== "published" ||
        !record.verified
      )
        throw new APIError("历史荣誉已更新，请刷新后核对", 409);
      const note = String(form.get("note") ?? "").trim();
      if (!note || note.length > 500)
        throw new APIError("请填写 1–500 字的隐藏说明", 400);
      await p.update({
        collection: "honors",
        id,
        req,
        overrideAccess: false,
        data: { _status: "draft", verified: false },
      });
      await p.create({
        collection: "audit",
        req,
        overrideAccess: true,
        data: {
          actor: String(req.user!.id),
          object: "honors:" + id,
          action: "hideLegacy:" + note,
          status: "hidden",
        },
      });
    });
    message = "历史荣誉已撤下，原作者、赛季和内容保留。";
  } catch (error) {
    message = honorError(error);
  }
  invalidateHonors();
  redirect("/teams/honors?message=" + encodeURIComponent(message));
}
