import {
  emptySignup,
  normalizeSignup,
  type Question,
  type SignupForm,
} from "./signup-schema";
import { hasOptions, questionTypes } from "./questionnaire-model";
export function parseQuestionText(text: string): Question[] {
  if (text.length > 100000) throw new Error("导入文本过长");
  const questions: Question[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^\[([^\]]+)\]\s*(.+?)(\*)?$/);
    if (match) {
      const type = Object.entries(questionTypes).find(
        ([key, label]) => key === match[1] || label === match[1],
      )?.[0] as Question["type"] | undefined;
      if (!type) throw new Error("未知题型：" + match[1]);
      questions.push({
        id: "import_" + (questions.length + 1),
        type,
        label: match[2],
        required: Boolean(match[3]),
        options: [],
      });
    } else if (
      line.startsWith("- ") &&
      questions.length &&
      hasOptions(questions.at(-1)!.type)
    )
      questions.at(-1)!.options.push(line.slice(2));
    else if (line.startsWith("> ") && questions.length)
      (questions.at(-1)!.rows ??= []).push(line.slice(2));
    else throw new Error("请使用 [题型]题目标题、- 选项、> 子题 的格式");
  }
  return normalizeSignup({ ...emptySignup, enabled: true, questions })
    .questions;
}
export function templateForm(name: string): SignupForm {
  const templates: Record<string, string> = {
    feedback:
      "[评分量表]整体体验*\n[矩阵单选]请评价以下方面*\n> 活动安排\n> 沟通通知\n- 满意\n- 一般\n- 不满意\n[NPS 推荐度]你愿意推荐给朋友吗*\n[多行文本]意见与建议",
    signup:
      "[单行文本]称呼*\n[下拉选择]参与方式*\n- 参与者\n- 观众\n[多选]方便参与的时段*\n- 上午\n- 下午\n- 晚上\n[多行文本]其他需要说明的事项",
    preference:
      "[排序]按偏好排列以下活动*\n- 交流分享\n- 友谊赛\n- 观赛\n[多项填空]补充建议\n> 希望举办的活动\n> 建议的时间",
  };
  return {
    ...emptySignup,
    enabled: true,
    questions: parseQuestionText(templates[name] || templates.feedback),
  };
}
export function downloadText(
  filename: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
