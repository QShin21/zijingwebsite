import { normalizeSignup, validateAnswers, type SignupForm } from "./signup-schema";
import { safeURL } from "./rules";

export const staffDepartments = { execution: "执行部", publicity: "宣传部", both: "执行/宣传均可" };
export const staffStatusLabels: Record<string, string> = { submitted: "已提交", reviewing: "选拔处理中", returned: "待补充", accepted: "已录用", rejected: "未录用", withdrawn: "已撤回" };
export const staffPrivacy = "资料仅用于本批次执行部/宣传部选拔及联系，仅本人和社长/副社长可查看；社群管理员不会因展示入口获得答卷权限。录用不自动授予平台角色，任命另行处理。资料保存安排由社团另行说明。";
export const staffDeadlinePolicy = "开放期间可修改、撤回并重提；截止或关闭后只可查看回执。录用/未录用结果锁定本人修改，管理层可明确退回补充；补充仍需批次开放。";
export const defaultStaffForm: SignupForm = normalizeSignup({ enabled: true, title: "执行部 / 宣传部骨干申请", intro: staffPrivacy, pageSize: 4,
  questions: [
    { id: "department", label: "意向方向", type: "single", required: true, options: Object.values(staffDepartments) },
    { id: "name", label: "姓名", type: "text", required: true, maxLength: 80 },
    { id: "school", label: "学校、院系与年级", type: "text", required: true, maxLength: 200 },
    { id: "motivation", label: "申请动机", type: "textarea", required: true, maxLength: 2000 },
    { id: "experience", label: "相关经验（无经验可说明兴趣）", type: "textarea", required: true, maxLength: 2000 },
    { id: "time", label: "可投入时间与时段", type: "textarea", required: true, maxLength: 1000 },
    { id: "works", label: "作品链接（选填，HTTPS）", type: "text", maxLength: 200 },
    { id: "contact", label: "一种便于联系的方式（邮箱或微信等）", type: "text", required: true, maxLength: 200 },
  ] });
export function staffForm(value: unknown) {
  const form = normalizeSignup(value);
  for (const id of ["department", "name", "school", "motivation", "experience", "time", "contact"]) {
    const question = form.questions.find(item => item.id === id);
    if (!question?.required || question.display || question.showWhen) throw new Error("骨干申请须保留必填且直接可见的字段：" + id);
    if (id !== "department" && !["text", "textarea"].includes(question.type)) throw new Error("骨干核心资料须使用文本字段：" + id);
  }
  const direction = form.questions.find(item => item.id === "department")!;
  if (!["single", "select"].includes(direction.type) || JSON.stringify(direction.options) !== JSON.stringify(Object.values(staffDepartments))) throw new Error("方向须为执行部、宣传部或两者均可");
  return form;
}
export function staffAnswers(form: SignupForm, value: unknown) {
  const answers = validateAnswers(form, value);
  for (const id of ["department", "name", "school", "motivation", "experience", "time", "contact"])
    if (typeof answers[id] !== "string" || !answers[id].trim()) throw new Error("请补齐骨干申请必要资料：" + id);
  const department = Object.entries(staffDepartments).find(([, label]) => label === answers.department)?.[0] as keyof typeof staffDepartments | undefined;
  if (!department) throw new Error("请选择执行/宣传方向");
  if (answers.works && (typeof answers.works !== "string" || !safeURL(answers.works))) throw new Error("作品链接须为不含账号密码的HTTPS地址；不抓取链接内容");
  return { answers, department };
}
export function staffWindow(batch: { state: string; startAt?: string | null; endAt?: string | null; signupForm?: unknown }, now = Date.now()) {
  if (batch.state !== "open") return batch.state === "draft" ? "尚未发布" : "申请已关闭";
  const form = batch.signupForm ? normalizeSignup(batch.signupForm) : null;
  if (form && (!form.enabled || form.closed)) return "申请已关闭";
  if ([batch.startAt, form?.start].some(value => value && now < Date.parse(value))) return "申请尚未开始";
  if (!batch.endAt || [batch.endAt, form?.end].some(value => value && now >= Date.parse(value))) return "申请已截止";
  return "申请开放";
}
