"use client";
import { useState } from "react";
import { normalizeSignup, type SignupForm } from "@/lib/signup-schema";
import {
  downloadText,
  parseQuestionText,
  templateForm,
} from "@/lib/questionnaire-import";
export function QuestionnaireTools({
  value,
  onChange,
}: {
  value: SignupForm;
  onChange: (value: SignupForm) => void;
}) {
  const [text, setText] = useState(""),
    [message, setMessage] = useState("");
  function append(questions: SignupForm["questions"]) {
    if (questions.length + value.questions.length > 100)
      throw new Error("最多 100 道题，请先减少题目");
    const ids = new Map(questions.map((q) => [q.id, crypto.randomUUID()]));
    onChange({
      ...value,
      enabled: true,
      questions: [
        ...value.questions,
        ...questions.map((q) => ({
          ...q,
          id: ids.get(q.id)!,
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
        })),
      ],
    });
  }
  const run = (action: () => void) => {
    try {
      action();
      setMessage("操作完成，请预览检查后保存。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <details className="questionnaire-tools">
      <summary>模板、批量导入与备份</summary>
      <p>模板题目会追加到当前问卷；可按实际活动修改。</p>
      <div className="signup-tools">
        {[
          ["feedback", "满意度反馈"],
          ["signup", "活动报名"],
          ["preference", "活动偏好"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => run(() => append(templateForm(key).questions))}
          >
            {label}模板
          </button>
        ))}
      </div>
      <label>
        批量题目文本
        <textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"[单选]参与方式*\n- 参与者\n- 观众\n[多行文本]其他建议"}
        />
      </label>
      <small>
        每道题以 [题型]标题 开头，末尾 * 表示必填；选项行以“-
        ”开头，矩阵子题以“&gt; ”开头。
      </small>
      <div className="signup-tools">
        <button
          type="button"
          onClick={() => run(() => append(parseQuestionText(text)))}
        >
          导入并追加题目
        </button>
        <button
          type="button"
          onClick={() =>
            run(() =>
              downloadText(
                "questionnaire-template.json",
                JSON.stringify(normalizeSignup(value), null, 2),
              ),
            )
          }
        >
          导出问卷模板
        </button>
      </div>
      <label>
        导入 JSON 模板（追加题目）
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 200000) {
              setMessage("模板文件最多 200 KB");
              return;
            }
            try {
              const content = await file.text();
              run(() => append(normalizeSignup(JSON.parse(content)).questions));
            } catch {
              setMessage("无法读取模板文件");
            }
          }}
        />
      </label>
      <p role="alert">{message}</p>
    </details>
  );
}
