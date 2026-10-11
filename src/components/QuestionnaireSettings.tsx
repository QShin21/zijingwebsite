"use client";
import type { Question } from "@/lib/signup-schema";
import { hasOptions, hasRows } from "@/lib/questionnaire-model";
export function QuestionnaireSettings({
  q,
  onChange,
}: {
  q: Question;
  onChange: (value: Partial<Question>) => void;
}) {
  return (
    <div className="questionnaire-settings">
      {hasRows(q.type) && (
        <label>
          子题（每行一个）
          <textarea
            value={(q.rows || []).join("\n")}
            onChange={(e) => onChange({ rows: e.target.value.split("\n") })}
          />
        </label>
      )}
      {["number", "rating"].includes(q.type) && (
        <div className="signup-times">
          {(["min", "max", "step"] as const)
            .filter((key) => key !== "step" || q.type === "number")
            .map((key) => (
              <label key={key}>
                {{ min: "最小值", max: "最大值", step: "步长" }[key]}
                <input
                  type="number"
                  step="any"
                  value={q[key] ?? ""}
                  onChange={(e) =>
                    onChange({
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
      <label className="signup-choice">
        <input
          type="checkbox"
          checked={Boolean(q.pageBreak)}
          onChange={(e) => onChange({ pageBreak: e.target.checked })}
        />
        从新的一页开始
      </label>
      {hasOptions(q.type) && q.type !== "ranking" && (
        <label className="signup-choice">
          <input
            type="checkbox"
            checked={Boolean(q.randomize)}
            onChange={(e) => onChange({ randomize: e.target.checked })}
          />
          随机排列选项
        </label>
      )}
    </div>
  );
}
