import {
  emptySignup,
  normalizeSignup,
  type Question,
  type SignupForm,
} from "./signup-schema";
import { endTarget } from "./questionnaire-flow";

export type QuestionnaireTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
  audience: string;
  minutes: number;
  tags: string[];
  form: SignupForm;
};
const q = (
  id: string,
  label: string,
  type: Question["type"],
  extra: Partial<Question> = {},
): Question => ({ id, label, type, required: true, options: [], ...extra });
const template = (
  id: string,
  title: string,
  category: string,
  description: string,
  audience: string,
  minutes: number,
  tags: string[],
  questions: Question[],
): QuestionnaireTemplate => ({
  id,
  title,
  category,
  description,
  audience,
  minutes,
  tags,
  form: normalizeSignup({
    ...emptySignup,
    enabled: true,
    title,
    intro: description + "请按实际情况填写，提交内容仅用于本次活动组织。",
    completionMessage: "感谢填写，你的反馈已收到。",
    theme: "purple",
    pageSize: 5,
    questions,
  }),
});
export const questionnaireTemplates: QuestionnaireTemplate[] = [
  template(
    "signup",
    "活动报名",
    "报名与组织",
    "收集参与方式、时间和必要的组织信息。",
    "活动参与者与观众",
    3,
    ["联系信息", "条件跳转"],
    [
      q("name", "如何称呼你？", "text", { maxLength: 40 }),
      q("role", "你希望以什么方式参与？", "single", {
        options: ["参加活动", "现场观众", "暂不参加"],
        jumps: [
          {
            when: {
              mode: "all",
              rules: [
                { questionId: "role", operator: "equals", value: "暂不参加" },
              ],
            },
            target: endTarget,
          },
          {
            when: {
              mode: "all",
              rules: [
                { questionId: "role", operator: "equals", value: "现场观众" },
              ],
            },
            target: "time",
          },
        ],
      }),
      q("experience", "你是否有相关活动经验？", "single", {
        options: ["有", "没有"],
      }),
      q("time", "方便参加的时段", "multiple", {
        options: ["上午", "下午", "晚上"],
        minChoices: 1,
      }),
      q("contact", "联系邮箱", "text", {
        required: false,
        format: "email",
        help: "需要接收活动通知时填写。",
      }),
      q("needs", "其他需要说明的事项", "textarea", {
        required: false,
        maxLength: 500,
      }),
    ],
  ),
  template(
    "feedback",
    "满意度反馈",
    "评价与反馈",
    "从整体体验、组织安排和改进建议了解活动效果。",
    "已参加活动的成员",
    3,
    ["评分", "矩阵", "NPS"],
    [
      q("overall", "整体体验", "rating"),
      q("aspects", "请评价以下方面", "matrix", {
        rows: ["活动内容", "时间安排", "沟通通知", "现场组织"],
        options: ["很满意", "满意", "一般", "不满意", "很不满意"],
      }),
      q("recommend", "你愿意推荐给朋友吗？", "nps"),
      q("favorite", "你最喜欢哪些部分？", "multiple", {
        required: false,
        options: ["内容安排", "交流互动", "现场体验", "其他"],
      }),
      q("improve", "最希望改善哪些方面？", "textarea", {
        required: false,
        maxLength: 1000,
      }),
      q("again", "是否愿意再次参加？", "single", {
        options: ["愿意", "视具体安排而定", "暂不考虑"],
      }),
      q("notes", "其他意见与建议", "textarea", { required: false }),
    ],
  ),
  template(
    "preference",
    "活动偏好",
    "需求与调研",
    "了解活动形式、时间与参与意愿，辅助后续安排。",
    "潜在参与者",
    3,
    ["排序", "多选"],
    [
      q("types", "按偏好排列以下活动", "ranking", {
        options: ["交流分享", "友谊赛", "观赛", "入门体验"],
      }),
      q("time", "通常方便参与的时间", "multiple", {
        options: ["工作日晚上", "周六白天", "周六晚上", "周日白天"],
      }),
      q("frequency", "希望活动举办的频率", "single", {
        options: ["每周", "每两周", "每月", "不定期"],
      }),
      q("duration", "可接受的单次活动时长", "single", {
        options: ["1 小时内", "1–2 小时", "2–3 小时", "3 小时以上"],
      }),
      q("suggestions", "补充建议", "blanks", {
        required: false,
        rows: ["希望举办的活动", "建议的时间"],
      }),
    ],
  ),
  template(
    "recruitment",
    "志愿者意向",
    "报名与组织",
    "收集志愿服务方向、经验和可投入时间。",
    "有志愿服务意向的成员",
    4,
    ["报名", "条件显示"],
    [
      q("name", "称呼", "text", { maxLength: 40 }),
      q("tasks", "愿意参与的工作", "multiple", {
        options: ["现场协助", "内容整理", "宣传设计", "技术支持"],
      }),
      q("experienced", "是否有相关经验？", "single", {
        options: ["有", "没有"],
      }),
      q("experience", "请简要说明相关经验", "textarea", {
        showWhen: { questionId: "experienced", option: "有" },
        maxLength: 800,
      }),
      q("hours", "每周可投入的小时数", "number", { min: 0, max: 40, step: 1 }),
      q("contact", "联系邮箱", "text", { format: "email" }),
      q("notes", "其他说明", "textarea", { required: false }),
    ],
  ),
  template(
    "training",
    "学习需求",
    "需求与调研",
    "了解基础水平、学习目标及期待的支持方式。",
    "交流或培训的潜在参与者",
    4,
    ["矩阵", "优先级"],
    [
      q("level", "目前对该主题的了解程度", "single", {
        options: ["初次接触", "了解一些基础", "已有一定经验", "较熟悉"],
      }),
      q("goals", "主要学习目标", "multiple", {
        options: ["了解基础知识", "掌握实践方法", "解决具体问题", "与他人交流"],
      }),
      q("format", "偏好的学习形式", "ranking", {
        options: ["主题分享", "现场实践", "小组讨论", "自主资料阅读"],
      }),
      q("support", "对以下支持的需要程度", "matrix", {
        rows: ["基础资料", "实践示例", "问题答疑"],
        options: ["很需要", "比较需要", "一般", "不需要"],
      }),
      q("questions", "希望重点讨论的问题", "textarea", { required: false }),
    ],
  ),
  template(
    "retrospective",
    "活动复盘",
    "评价与反馈",
    "围绕目标、执行和改进形成可行动的反馈。",
    "活动组织者与协助者",
    5,
    ["复盘", "评分"],
    [
      q("role", "你参与的环节", "multiple", {
        options: ["前期策划", "沟通宣传", "现场执行", "后续整理"],
      }),
      q("goal", "活动目标达成情况", "rating", {
        help: "1 表示未达预期，5 表示达到或超过预期。",
      }),
      q("team", "协作体验", "matrix", {
        rows: ["分工清晰度", "信息同步", "资源准备", "现场应对"],
        options: ["很好", "较好", "一般", "需改善"],
      }),
      q("keep", "下次值得保留的做法", "textarea"),
      q("change", "下次优先改进的事项", "textarea"),
      q("action", "建议的具体行动", "textarea", { required: false }),
    ],
  ),
  template(
    "schedule",
    "时间安排",
    "报名与组织",
    "汇总可用日期、时段和参与方式。",
    "需要协调时间的成员",
    2,
    ["日期", "时间", "多选"],
    [
      q("name", "称呼", "text", { maxLength: 40 }),
      q("date", "首选日期", "date"),
      q("time", "首选开始时间", "time"),
      q("alternatives", "还可以接受的时段", "multiple", {
        required: false,
        options: ["工作日白天", "工作日晚上", "周末白天", "周末晚上"],
      }),
      q("mode", "可接受的参与形式", "multiple", { options: ["线下", "线上"] }),
      q("notes", "需要避开的时间或其他说明", "textarea", { required: false }),
    ],
  ),
  template(
    "screening",
    "参与条件筛选",
    "需求与调研",
    "演示条件分支：符合条件者继续填写，其他情况提前结束。请按实际需求调整。",
    "需要按条件分流的参与者",
    2,
    ["组合条件", "提前结束"],
    [
      q("interest", "你是否愿意参加此次活动？", "single", {
        options: ["愿意", "暂不参加"],
        jumps: [
          {
            when: {
              mode: "all",
              rules: [
                {
                  questionId: "interest",
                  operator: "equals",
                  value: "暂不参加",
                },
              ],
            },
            target: endTarget,
          },
        ],
      }),
      q("hours", "本次最多可以参与几小时？", "number", {
        min: 0,
        max: 24,
        step: 0.5,
        jumps: [
          {
            when: {
              mode: "all",
              rules: [
                { questionId: "interest", operator: "equals", value: "愿意" },
                { questionId: "hours", operator: "lt", value: "1" },
              ],
            },
            target: "short",
          },
        ],
      }),
      q("full", "你希望参与的完整活动环节", "multiple", {
        options: ["主题分享", "互动体验", "交流总结"],
        jumps: [{ target: "notes" }],
      }),
      q("short", "你希望参与的短时环节", "single", {
        options: ["主题分享", "互动体验"],
      }),
      q("notes", "其他说明", "textarea", { required: false }),
    ],
  ),
];
export function applyBlueprint(
  current: SignupForm,
  blueprint: SignupForm,
  mode: "replace" | "append",
  newId = () => crypto.randomUUID(),
): SignupForm {
  const incoming = normalizeSignup(blueprint),
    ids = new Map(incoming.questions.map((q) => [q.id, newId()]));
  const questions = incoming.questions.map((q) => ({
    ...q,
    id: ids.get(q.id)!,
    options: [...q.options],
    rows: q.rows ? [...q.rows] : undefined,
    showWhen: q.showWhen
      ? { ...q.showWhen, questionId: ids.get(q.showWhen.questionId)! }
      : undefined,
    display: q.display
      ? {
          ...q.display,
          rules: q.display.rules.map((r) => ({
            ...r,
            questionId: ids.get(r.questionId)!,
          })),
        }
      : undefined,
    jumps: q.jumps?.map((j) => ({
      target: j.target === endTarget ? endTarget : ids.get(j.target)!,
      ...(j.when
        ? {
            when: {
              ...j.when,
              rules: j.when.rules.map((r) => ({
                ...r,
                questionId: ids.get(r.questionId)!,
              })),
            },
          }
        : {}),
    })),
  }));
  return normalizeSignup({
    ...(mode === "replace" ? incoming : current),
    enabled: true,
    closed: current.closed,
    start: current.start,
    end: current.end,
    questions:
      mode === "append" ? [...current.questions, ...questions] : questions,
  });
}
