"use client";
import type { EntryField, Question } from "@/lib/signup-schema";
export const defaultGroupFields = (): EntryField[] => [
  {
    id: crypto.randomUUID(),
    label: "姓名",
    type: "text",
    required: true,
    options: [],
  },
  {
    id: crypto.randomUUID(),
    label: "补充信息",
    type: "text",
    required: false,
    options: [],
  },
];
export function QuestionnaireGroupEditor({
  q,
  onChange,
}: {
  q: Question;
  onChange: (value: Partial<Question>) => void;
}) {
  const fields = q.fields || [];
  const patch = (id: string, data: Partial<EntryField>) =>
    onChange({
      fields: fields.map((field) =>
        field.id === id ? { ...field, ...data } : field,
      ),
    });
  return (
    <div className="questionnaire-group-editor">
      <p>
        适用于成员名单、同行人员、设备明细等重复信息。一条记录包含以下字段。
      </p>
      <div className="signup-times">
        {(["minEntries", "maxEntries"] as const).map((key) => (
          <label key={key}>
            {key === "minEntries" ? "最少记录条数" : "最多记录条数"}
            <input
              type="number"
              min={1}
              max={20}
              value={q[key] ?? (key === "minEntries" ? 1 : 10)}
              onChange={(e) => onChange({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      {fields.map((field, index) => (
        <fieldset key={field.id}>
          <legend>字段 {index + 1}</legend>
          <div className="signup-times">
            <label>
              字段名称
              <input
                maxLength={120}
                value={field.label}
                onChange={(e) => patch(field.id, { label: e.target.value })}
              />
            </label>
            <label>
              字段类型
              <select
                value={field.type}
                onChange={(e) => {
                  const type = e.target.value as EntryField["type"];
                  patch(field.id, {
                    type,
                    options: type === "select" ? ["选项一", "选项二"] : [],
                    format: undefined,
                    min: undefined,
                    max: undefined,
                    step: undefined,
                  });
                }}
              >
                <option value="text">文本</option>
                <option value="select">下拉选择</option>
                <option value="number">数字</option>
              </select>
            </label>
          </div>
          <label className="signup-choice">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => patch(field.id, { required: e.target.checked })}
            />
            此字段必填
          </label>
          {field.type === "select" && (
            <label>
              字段选项（每行一个）
              <textarea
                value={field.options.join("\n")}
                onChange={(e) =>
                  patch(field.id, { options: e.target.value.split("\n") })
                }
              />
            </label>
          )}
          {field.type === "text" && (
            <>
              <label>
                字段格式
                <select
                  value={field.format || "plain"}
                  onChange={(e) =>
                    patch(field.id, {
                      format: e.target.value as EntryField["format"],
                    })
                  }
                >
                  <option value="plain">普通文本</option>
                  <option value="email">邮箱</option>
                  <option value="phone">中国大陆手机号</option>
                  <option value="number">数字文本</option>
                </select>
              </label>
              <div className="signup-times">
                {(["minLength", "maxLength"] as const).map((key) => (
                  <label key={key}>
                    {key === "minLength" ? "字段最少字数" : "字段最多字数"}
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={field[key] ?? ""}
                      onChange={(e) =>
                        patch(field.id, {
                          [key]: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {field.type === "number" && (
            <div className="signup-times">
              {(["min", "max", "step"] as const).map((key) => (
                <label key={key}>
                  {
                    { min: "字段最小值", max: "字段最大值", step: "字段步长" }[
                      key
                    ]
                  }
                  <input
                    type="number"
                    step="any"
                    value={field[key] ?? ""}
                    onChange={(e) =>
                      patch(field.id, {
                        [key]: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={fields.length <= 1}
            onClick={() =>
              onChange({ fields: fields.filter((f) => f.id !== field.id) })
            }
          >
            删除字段 {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={fields.length >= 10}
        onClick={() =>
          onChange({
            fields: [
              ...fields,
              {
                id: crypto.randomUUID(),
                label: "新字段",
                type: "text",
                required: true,
                options: [],
              },
            ],
          })
        }
      >
        添加字段
      </button>
    </div>
  );
}
