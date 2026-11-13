import type { Locale } from "./locale";

/*
 * English renderings of server and validation messages. Server APIs keep their Chinese
 * contract (other clients and tests rely on it); clients translate what they display.
 * Unknown messages stay Chinese rather than showing a key or an empty error.
 */
const exact: Record<string, string> = {
  "请求内容无效，请检查后重试": "The request is invalid. Check it and try again.",
  请先登录可用账号: "Please sign in with an active account.",
  请先登录: "Please sign in first.",
  无权进行此操作: "You do not have permission for this action.",
  当前账号没有此操作权限: "This account does not have permission for this action.",
  内容暂时不可访问: "This content is not available right now.",
  内容暂不可用: "This content is not available right now.",
  "内容已更新或已处理，请刷新后重试": "The content was updated or already handled. Refresh and try again.",
  请求内容过大: "The request is too large.",
  不支持此文件格式: "This file format is not supported.",
  "操作过于频繁，请稍后重试": "Too many requests. Please try again later.",
  "请求较多，请稍后再试": "Too many requests. Please try again later.",
  "服务暂时不可用，请稍后重试": "The service is temporarily unavailable. Please try again later.",
  "操作未完成，请核对内容后重试": "The action was not completed. Check your input and try again.",
  "连接失败，请检查网络后重试": "Connection failed. Check your network and try again.",
  "加载失败，请重试": "Failed to load. Please try again.",
  活动未公开或已移除: "This activity is not public or has been removed.",
  无权执行此活动报名操作: "You do not have permission for this sign-up action.",
  "报名表已变化，请刷新后重试": "The form has changed. Refresh and try again.",
  请填写报名信息: "Please fill in the form.",
  报名内容过长: "The answers are too long.",
  请选择有效选项: "Choose a valid option.",
  互斥选项不能与其他选项同时选择: "This option cannot be combined with other options.",
  填写格式不正确: "The format is incorrect.",
  "请检查必填内容、长度或选项": "Check required answers, length or options.",
  请输入有效邮箱地址: "Enter a valid email address.",
  "请输入 11 位中国大陆手机号": "Enter an 11-digit mainland China mobile number.",
  请输入有效数字: "Enter a valid number.",
  信息组填写格式无效: "The entry list format is invalid.",
  "字段已变化，请刷新后填写": "The fields have changed. Refresh before filling in.",
  "请填写此条记录，或移除多余的空记录": "Complete this entry or remove the empty entry.",
  子题填写格式无效: "The sub-question format is invalid.",
  "子题已变化，请刷新": "The sub-questions have changed. Please refresh.",
  请完成排序: "Please complete the ranking.",
  请为所有选项选择不同名次: "Give every option a different rank.",
  填写格式无效: "The answer format is invalid.",
  请填写此题: "Please answer this question.",
  格式无效: "Invalid format.",
  选项无效: "Invalid option.",
  "报名尚未开始": "Sign-up has not opened yet.",
  "报名已截止": "Sign-up has closed.",
  "报名已关闭": "Sign-up is closed.",
  "请从本站操作": "Please use this website to perform this action.",
  // Sign-up and activity state labels produced by the server.
  报名开放: "Sign-up open",
  未启用报名: "Sign-up not enabled",
  报名状态待核对: "Checking sign-up status",
  即将开始: "Upcoming",
  尚未开始: "Not started",
  进行中: "In progress",
  已结束: "Ended",
  已取消: "Cancelled",
  已延期: "Postponed",
  已截止: "Closed",
  已关闭: "Closed",
  待公布: "TBA",
  暂无报名渠道: "No sign-up channel yet",
  // Write receipts.
  作答修改已保存: "Your changes were saved.",
  "报名成功，已确认报名": "Signed up. Your sign-up is confirmed.",
  报名问卷已保存: "The sign-up questionnaire was saved.",
  "问卷草稿已保存，需发布负责人审核发布后生效": "Draft saved. It takes effect after a publisher reviews and publishes it.",
  归档对象无效: "Invalid archive target.",
  归档状态无效: "Invalid archive state.",
  记录不可访问: "Record unavailable.",
  已中签: "Selected",
  未中签: "Not selected",
  未参与本次抽签: "Not in this draw",
};

const patterns: [RegExp, (...groups: string[]) => string][] = [
  [/^请选择 (\d+)–(\d+) 项$/, (a, b) => `Choose ${a}–${b} options.`],
  [/^至少填写 (\d+) 字$/, (a) => `Enter at least ${a} characters.`],
  [/^最多填写 (\d+) 条记录$/, (a) => `At most ${a} entries.`],
  [/^至少填写 (\d+) 条记录$/, (a) => `At least ${a} entries.`],
  [/^第 (\d+) 条：(.+)$/, (a, rest) => `Entry ${a}: ${localizeMessage(rest, "en")}`],
  [/^请完成“(.+)”$/, (row) => `Please complete “${row}”.`],
  [/^请检查“(.+)”$/, (row) => `Please check “${row}”.`],
  [/^(.+)：(.+)$/, (label, rest) => (exact[rest] ? `${label}: ${exact[rest]}` : "")],
];

export function localizeMessage(message: string, locale: Locale): string {
  if (locale !== "en" || typeof message !== "string" || !message) return message;
  const trimmed = message.trim();
  if (exact[trimmed]) return exact[trimmed];
  for (const [pattern, render] of patterns) {
    const match = pattern.exec(trimmed);
    if (match) {
      const value = render(...match.slice(1));
      if (value) return value;
    }
  }
  return message;
}
