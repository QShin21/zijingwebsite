import {
  emptySignup,
  normalizeSignup,
  type Question,
  type SignupForm,
} from "./signup-schema";
import { questionnaireTemplates } from "./questionnaire-templates";
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
  const template = questionnaireTemplates.find((t) => t.id === name);
  if (!template) throw new Error("模板不存在");
  return normalizeSignup(template.form);
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
