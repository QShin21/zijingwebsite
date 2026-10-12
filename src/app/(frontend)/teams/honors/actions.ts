"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { honorError, saveHonorForm } from "@/lib/team-honor-web";
import { honorID, type HonorAction } from "@/lib/team-honor-model";

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
