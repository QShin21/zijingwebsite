"use client";
import { useState } from "react";
import type { Question } from "@/lib/signup-schema";
import type { QuestionSummary } from "@/lib/questionnaire-results";
import type { ResponseExportLayout } from "@/lib/questionnaire-export";
export function QuestionnaireResults({
  endpoint,
  questions,
}: {
  endpoint: string;
  questions: Question[];
}) {
  const [filters, setFilters] = useState({
    name: "",
    from: "",
    to: "",
    question: "",
    answer: "",
  });
  const [groups, setGroups] = useState<
    { version: string; total: number; questions: QuestionSummary[] }[]
  >([]);
  const [message, setMessage] = useState(""),
    [layout, setLayout] = useState<ResponseExportLayout>("responses"),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  async function run(exportFile = false) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        endpoint +
          "?" +
          new URLSearchParams({
            ...filters,
            mode: exportFile ? "export" : "stats",
            ...(exportFile ? { layout } : {}),
          }),
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "读取失败");
      }
      if (exportFile) {
        const blob = await response.blob(),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        const filename = response.headers
          .get("content-disposition")
          ?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        a.download = filename
          ? decodeURIComponent(filename)
          : `questionnaire-${layout}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("答卷已导出，请妥善保管个人信息。");
      } else {
        const data = await response.json();
        setGroups(data.groups);
        setLoaded(true);
        setMessage(`筛选结果：${data.total} 份答卷`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel member-form questionnaire-results">
      <h2>统计与导出</h2>
      <p>
        按问卷版本分别统计，历史题目保持原义。比例按已作答人数计算，多选合计可能超过
        100%。日期按北京时间筛选。
      </p>
      <div className="signup-times">
        <label>
          填写者姓名
          <input
            value={filters.name}
            maxLength={100}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
          />
        </label>
        {(["from", "to"] as const).map((key) => (
          <label key={key}>
            {key === "from" ? "提交起始日期" : "提交截止日期"}
            <input
              type="date"
              value={filters[key]}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <div className="signup-times">
        <label>
          答案筛选题目
          <select
            value={filters.question}
            onChange={(e) =>
              setFilters({ ...filters, question: e.target.value })
            }
          >
            <option value="">全部题目</option>
            {questions
              .filter((q) => q.type !== "description")
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          答案包含
          <input
            value={filters.answer}
            maxLength={200}
            onChange={(e) => setFilters({ ...filters, answer: e.target.value })}
            disabled={!filters.question}
          />
        </label>
      </div>
      <label>
        导出格式
        <select value={layout} onChange={(e) => setLayout(e.target.value as ResponseExportLayout)}>
          <option value="responses">答卷表：每份答卷一行（推荐）</option>
          <option value="members">成员明细：每条信息组记录一行</option>
          <option value="long">按题明细：每个答案一行</option>
        </select>
      </label>
      <p className="muted">
        {layout === "responses"
          ? "每题分列；多项填空和矩阵按子题拆列，成员名单按序号和字段拆列。多选 1 表示选中、0 表示未选；空白表示未填写或未显示。排序以数字记录名次。"
          : layout === "members"
            ? "适用于团队名单等信息组：每条记录一行，字段分列，并带上报名编号、填写者及普通题答案，方便筛选和整理名单。"
            : "每个答案一行，保留题目标识、题型和完整答案，适合复核历史问卷。"}
      </p>
      <p className="muted">
        学号、电话等文本列在 Excel 导入时请选择文本格式，以保留前导零和长数字。
      </p>
      <div className="signup-tools">
        <button type="button" disabled={busy} onClick={() => void run()}>
          查看统计图表
        </button>
        <button type="button" disabled={busy} onClick={() => void run(true)}>
          导出筛选答卷 CSV
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters({
              name: "",
              from: "",
              to: "",
              question: "",
              answer: "",
            });
            setGroups([]);
            setLoaded(false);
            setMessage("");
          }}
        >
          清除筛选
        </button>
      </div>
      <p role={message ? "status" : undefined}>{message}</p>
      {loaded && !groups.length && <p>没有符合条件的答卷。</p>}
      {groups.map((group) => (
        <div key={group.version}>
          <h3>
            版本 {group.version.slice(0, 8)} · {group.total} 份
          </h3>
          {group.questions.map((q) => (
            <article key={q.id} className="questionnaire-stat">
              <h4>{q.label}</h4>
              <p>
                显示给 {q.shown} 人 · 已作答 {q.answered} 人
                {q.average != null ? ` · 平均值 ${q.average}` : ""}
                {q.nps != null ? ` · NPS ${q.nps}` : ""}
              </p>
              {q.counts.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>选项 / 子题</th>
                      <th>人数</th>
                      <th>比例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.counts.map((item) => (
                      <tr key={item.label}>
                        <th scope="row">{item.label}</th>
                        <td>{item.count}</td>
                        <td>
                          <progress
                            max={100}
                            value={item.percent}
                            aria-label={`${item.label} ${item.percent}%`}
                          />{" "}
                          {item.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <small>
                  文本、日期和填空答案请在报名名单或导出文件中查看。
                </small>
              )}
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
