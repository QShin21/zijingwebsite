import type { Question } from "@/lib/signup-schema";
import type { ConditionRule } from "@/lib/questionnaire-flow";
import { conditionLabels } from "@/lib/questionnaire-flow";
import { questionTypes } from "@/lib/questionnaire-model";
import type { Locale } from "./locale";
import { localizeMessage } from "./messages";

/*
 * English display names for questionnaire-editor vocabulary. Type ids, operator keys and
 * stored values never change; Chinese stays the source labels in questionnaire-model /
 * questionnaire-flow and the fallback for any key missing here.
 */
const questionTypesEn: Record<Question["type"], string> = {
  text: "Short text",
  textarea: "Long text",
  single: "Single choice",
  multiple: "Multiple choice",
  select: "Dropdown",
  number: "Number",
  date: "Date",
  time: "Time",
  rating: "Rating scale",
  nps: "NPS",
  ranking: "Ranking",
  matrix: "Matrix (single)",
  matrixMultiple: "Matrix (multiple)",
  blanks: "Multiple blanks",
  group: "Repeatable entry list",
  description: "Description",
};

export function questionTypeLabel(type: Question["type"], locale: Locale): string {
  return (locale === "en" && questionTypesEn[type]) || questionTypes[type] || type;
}

const conditionLabelsEn: Record<ConditionRule["operator"], string> = {
  equals: "Equals / contains",
  notEquals: "Does not equal / contain",
  answered: "Answered",
  notAnswered: "Not answered",
  gt: "Greater than",
  gte: "At least",
  lt: "Less than",
  lte: "At most",
};

export function conditionLabel(operator: ConditionRule["operator"], locale: Locale): string {
  return (locale === "en" && conditionLabelsEn[operator]) || conditionLabels[operator] || operator;
}

/** Messages from shared client helpers and the AI generator that the editor displays. */
const manageMessages: Record<string, string> = {
  "网络连接中断，请检查连接后重新加载。": "The connection was interrupted. Check your network and reload.",
  "提交结果尚未确认。填写内容已保留，请先刷新本人回执或已保存记录，确认后再重试。":
    "The result is not confirmed yet. Your input is kept; refresh the saved record before retrying.",
  "暂时无法读取服务器响应，请稍后重新加载。": "Could not read the server response. Please reload later.",
  "服务器响应不完整，提交结果尚未确认。请先查看本人回执或已保存记录，填写内容已保留。":
    "The server response was incomplete and the result is not confirmed. Check the saved record; your input is kept.",
  "服务器暂时无法确认提交结果。填写内容已保留，请先刷新本人回执或已保存记录，再决定是否重试。":
    "The server could not confirm the result. Your input is kept; refresh the saved record before deciding to retry.",
  "当前账号没有此操作权限。": "This account does not have permission for this action.",
  "请求未被接受，请核对内容后重试。": "The request was not accepted. Check it and try again.",
  "AI 制作未完成，请重试。": "AI generation did not finish. Please try again.",
  "未收到生成结果，请重试。制作需求已保留。": "No result was received. Please try again; your request is kept.",
  "生成结果过长，请简化需求后重试。": "The result is too long. Simplify the request and try again.",
  "连接已中断，未收到完整草稿。制作需求与现有问卷已保留，请重试。":
    "The connection dropped before the draft was complete. Your request and questionnaire are kept; please retry.",
  "AI 制作尚未开通，请先使用模板或手动制作。": "AI generation is not enabled. Use a template or build manually.",
  "正在自动修复草稿，补全题目并检查规则…": "Repairing the draft, completing questions and checking rules…",
  "正在按修改要求完善草稿…": "Refining the draft as requested…",
  "正在设计题目、字段与填写分支…": "Designing questions, fields and branching…",
  "正在校验题目、字段限制与分支引用…": "Checking questions, field limits and branch references…",
  导出失败: "Export failed",
  "暂时无法读取活动列表。": "Could not load the activity list right now.",
};

/** Displayed error/status text: editor-specific messages first, then the shared map, else Chinese. */
export function localizeManageMessage(message: string, locale: Locale): string {
  if (locale !== "en" || !message) return message;
  return manageMessages[message.trim()] ?? localizeMessage(message, locale);
}
