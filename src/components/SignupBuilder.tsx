"use client";
import {
  emptySignup,
  type SignupForm,
  type Question,
} from "@/lib/signup-schema";
export const signupLabels = {
  text: "单行文本",
  textarea: "多行文本",
  single: "单选",
  multiple: "多选",
};
function localDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function SignupBuilder({
  value = emptySignup,
  onChange,
}: {
  value: SignupForm;
  onChange: (value: SignupForm) => void;
}) {
  const patch = (data: Partial<SignupForm>) => onChange({ ...value, ...data });
  const question = (index: number, data: Partial<Question>) =>
    patch({
      questions: value.questions.map((q, i) =>
        i === index ? { ...q, ...data } : q,
      ),
    });
  const move = (index: number, direction: number) => {
    const list = [...value.questions],
      other = index + direction;
    [list[index], list[other]] = [list[other], list[index]];
    patch({ questions: list });
  };
  return (
    <section className="signup-builder">
      <h3>报名问卷</h3>
      <label className="signup-choice">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        启用填写问卷报名
      </label>
      <p>
        用户提交后立即确认报名。请仅收集本次活动所需的信息；每个账号只保留一份报名记录。
      </p>
      {value.enabled && (
        <>
          <label>
            报名说明
            <textarea
              value={value.intro}
              maxLength={1000}
              onChange={(e) => patch({ intro: e.target.value })}
            />
          </label>
          <div className="signup-times">
            {(["start", "end"] as const).map((key) => (
              <label key={key}>
                {key === "start" ? "报名开始" : "报名截止"}
                <input
                  type="datetime-local"
                  value={localDate(value[key])}
                  onChange={(e) =>
                    patch({
                      [key]: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : "",
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="signup-choice">
            <input
              type="checkbox"
              checked={value.closed}
              onChange={(e) => patch({ closed: e.target.checked })}
            />
            暂停接收报名
          </label>
          {value.questions.map((q, i) => (
            <fieldset className="signup-question" key={q.id}>
              <legend>第 {i + 1} 题</legend>
              <label>
                题目标题
                <input
                  value={q.label}
                  maxLength={120}
                  required
                  onChange={(e) => question(i, { label: e.target.value })}
                />
              </label>
              <label>
                题型
                <select
                  value={q.type}
                  onChange={(e) =>
                    question(i, { type: e.target.value as Question["type"] })
                  }
                >
                  {Object.entries(signupLabels).map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label className="signup-choice">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => question(i, { required: e.target.checked })}
                />
                必填
              </label>
              {["single", "multiple"].includes(q.type) && (
                <label>
                  选项（每行一个）
                  <textarea
                    rows={4}
                    value={q.options.join("\n")}
                    onChange={(e) =>
                      question(i, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
              <div className="signup-tools">
                <button type="button" disabled={!i} onClick={() => move(i, -1)}>
                  上移
                </button>
                <button
                  type="button"
                  disabled={i === value.questions.length - 1}
                  onClick={() => move(i, 1)}
                >
                  下移
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      questions: value.questions.filter((_, n) => n !== i),
                    })
                  }
                >
                  删除此题
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="button light"
            disabled={value.questions.length >= 20}
            onClick={() =>
              patch({
                questions: [
                  ...value.questions,
                  {
                    id: crypto.randomUUID(),
                    label: "",
                    type: "text",
                    required: true,
                    options: [],
                  },
                ],
              })
            }
          >
            添加题目
          </button>
          <p>最多 20 道题。修改问卷后，已有报名保留提交时的题目和答案。</p>
        </>
      )}
    </section>
  );
}
