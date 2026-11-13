import type { Locale } from "@/lib/i18n/locale";
import { localizeMessage } from "@/lib/i18n/messages";

/*
 * English display of the Chinese honor action results. The actions keep returning Chinese
 * (tests, the redirect `message` query and other clients rely on it); pages translate here.
 */
const messages: Record<string, string> = {
  "荣誉已提交，等待对应社群管理员审核。": "Honor submitted; awaiting review by the community admins.",
  "草稿已保存；须提交并由他人审核后公开。": "Draft saved. It becomes public only after you submit it and someone else approves it.",
  "已撤回待审荣誉。": "Pending honor withdrawn.",
  "荣誉已批准并实时加入队伍档案。": "Honor approved and added to the team archive.",
  "已退回，作者可按说明修改后重提。": "Returned. The author can revise per the note and resubmit.",
  "已拒绝，审核说明已保存。": "Rejected. The review note was saved.",
  "荣誉已隐藏并从公开档案撤下。": "Honor hidden and removed from the public archive.",
  "历史荣誉已撤下，原作者、赛季和内容保留。": "Past honor removed; its author, season and content are kept.",
  荣誉操作无效: "Invalid honor action.",
  无权撤下此社群的历史荣誉: "You cannot remove past honors of this community.",
  "历史荣誉已更新，请刷新后核对": "The past honor was updated. Refresh and check.",
  "请填写 1–500 字的隐藏说明": "Enter a 1–500 character note for hiding.",
};

export function honorMessage(message: string, locale: Locale): string {
  if (locale !== "en" || !message) return message;
  return messages[message.trim()] ?? localizeMessage(message, locale);
}
