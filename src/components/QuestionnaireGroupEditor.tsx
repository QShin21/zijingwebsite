"use client";
import type { EntryField, Question } from "@/lib/signup-schema";
import { useT } from "./i18n/LocaleProvider";
export const defaultGroupFields = (): EntryField[] => [
  {
    id: crypto.randomUUID(),
    // i18n-exempt: default questionnaire content inserted into the form (published content)
    label: "姓名",
    type: "text",
    required: true,
    options: [],
  },
  {
    id: crypto.randomUUID(),
    // i18n-exempt: default questionnaire content inserted into the form (published content)
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
  const t = useT();
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
        {t("适用于成员名单、同行人员、设备明细等重复信息。一条记录包含以下字段。", "For repeated details such as member lists, companions or equipment. Each entry contains the fields below.")}
      </p>
      <div className="signup-times">
        {(["minEntries", "maxEntries"] as const).map((key) => (
          <label key={key}>
            {key === "minEntries" ? t("最少记录条数", "Min. entries") : t("最多记录条数", "Max. entries")}
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
          <legend>{t(`字段 ${index + 1}`, `Field ${index + 1}`)}</legend>
          <div className="signup-times">
            <label>
              {t("字段名称", "Field name")}
              <input
                maxLength={120}
                value={field.label}
                onChange={(e) => patch(field.id, { label: e.target.value })}
              />
            </label>
            <label>
              {t("字段类型", "Field type")}
              <select
                value={field.type}
                onChange={(e) => {
                  const type = e.target.value as EntryField["type"];
                  patch(field.id, {
                    type,
                    // i18n-exempt: default questionnaire content inserted into the form (published content)
                    options: type === "select" ? ["选项一", "选项二"] : [],
                    format: undefined,
                    min: undefined,
                    max: undefined,
                    step: undefined,
                  });
                }}
              >
                <option value="text">{t("文本", "Text")}</option>
                <option value="select">{t("下拉选择", "Dropdown")}</option>
                <option value="number">{t("数字", "Number")}</option>
              </select>
            </label>
          </div>
          <label className="signup-choice">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => patch(field.id, { required: e.target.checked })}
            />
            {t("此字段必填", "Required field")}
          </label>
          {field.type === "select" && (
            <label>
              {t("字段选项（每行一个）", "Field options (one per line)")}
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
                {t("字段格式", "Field format")}
                <select
                  value={field.format || "plain"}
                  onChange={(e) =>
                    patch(field.id, {
                      format: e.target.value as EntryField["format"],
                    })
                  }
                >
                  <option value="plain">{t("普通文本", "Plain text")}</option>
                  <option value="email">{t("邮箱", "Email")}</option>
                  <option value="phone">{t("中国大陆手机号", "Mainland China mobile")}</option>
                  <option value="number">{t("数字文本", "Numeric text")}</option>
                </select>
              </label>
              <div className="signup-times">
                {(["minLength", "maxLength"] as const).map((key) => (
                  <label key={key}>
                    {key === "minLength" ? t("字段最少字数", "Field min. characters") : t("字段最多字数", "Field max. characters")}
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
                    { min: t("字段最小值", "Field minimum"), max: t("字段最大值", "Field maximum"), step: t("字段步长", "Field step") }[
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
            {t(`删除字段 ${index + 1}`, `Delete field ${index + 1}`)}
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
                // i18n-exempt: default questionnaire content inserted into the form (published content)
                label: "新字段",
                type: "text",
                required: true,
                options: [],
              },
            ],
          })
        }
      >
        {t("添加字段", "Add field")}
      </button>
    </div>
  );
}
