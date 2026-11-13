"use client";
import { useId, useState } from "react";
import surface from "./activity-pages/QuestionnaireSurface.module.css";
import type { Question } from "@/lib/signup-schema";
import type { QuestionSummary } from "@/lib/questionnaire-results";
import type { ResponseExportLayout } from "@/lib/questionnaire-export";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { localizeManageMessage } from "@/lib/i18n/labels-manage";
export function QuestionnaireResults({
  endpoint,
  questions,
  canExport = true,
}: {
  endpoint: string;
  questions: Question[];
  canExport?: boolean;
}) {
  const t = useT(),
    locale = useLocale();
  const layoutGroup = useId();
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
  const [failed, setFailed] = useState(false),
    [appliedFilters, setAppliedFilters] = useState("");
  const [message, setMessage] = useState(""),
    [layout, setLayout] = useState<ResponseExportLayout>("responses"),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  async function run(exportFile = false) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
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
        throw new Error(body.error || t("读取失败", "Failed to load"));
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
        setMessage(t("答卷已导出，请妥善保管个人信息。", "Responses exported. Keep the personal data safe."));
      } else {
        const data = await response.json();
        setGroups(data.groups);
        setLoaded(true);
        setAppliedFilters(JSON.stringify(filters));
        setMessage(t(`筛选结果：${data.total} 份答卷`, `Filtered: ${data.total} responses`));
      }
    } catch (e) {
      setFailed(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`${surface.surface} questionnaire-results`}
      aria-busy={busy}
    >
      <header className={surface.resultsHeader}>
        <div>
          <h2>{canExport ? t("统计与导出", "Statistics and export") : t("报名统计", "Sign-up statistics")}</h2>
          <p>{t("问卷按提交时的版本分别统计，历史题目保持原义。", "Responses are counted per questionnaire version at submission; earlier questions keep their original wording.")}</p>
        </div>
      </header>
      <div className={surface.resultsLayout}>
        <div className={surface.resultsFilter}>
          <h3>{t("筛选答卷", "Filter responses")}</h3>
          <label>
            {t("填写者姓名", "Respondent name")}
            <input
              value={filters.name}
              maxLength={100}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            />
          </label>
          <div className="signup-times">
            {(["from", "to"] as const).map((key) => (
              <label key={key}>
                {key === "from" ? t("起始日期", "From") : t("截止日期", "To")}
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
          <small>{t("提交日期按北京时间筛选。", "Submission dates use Beijing time.")}</small>
          <label>
            {t("答案筛选题目", "Filter by question")}
            <select
              value={filters.question}
              onChange={(e) =>
                setFilters({ ...filters, question: e.target.value })
              }
            >
              <option value="">{t("全部题目", "All questions")}</option>
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
            {t("答案包含", "Answer contains")}
            <input
              value={filters.answer}
              maxLength={200}
              onChange={(e) =>
                setFilters({ ...filters, answer: e.target.value })
              }
              disabled={!filters.question}
            />
          </label>
          <div className="signup-tools">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void run()}
            >
              {busy ? t("正在读取…", "Loading…") : t("查看统计图表", "View statistics")}
            </button>
            <button
              type="button"
              className={surface.secondaryButton}
              disabled={busy}
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
                setFailed(false);
                setAppliedFilters("");
              }}
            >
              {t("清除筛选", "Clear filters")}
            </button>
          </div>
          {canExport ? (
            <section className={surface.exportPanel} aria-labelledby="questionnaire-export-heading">
              <h3 id="questionnaire-export-heading">{t("导出筛选答卷", "Export filtered responses")}</h3>
              <fieldset className={surface.exportOptions}>
                <legend>{t("导出格式", "Export format")}</legend>
                {([
                  ["responses", t("答卷表：每份答卷一行（推荐）", "Responses: one row per response (recommended)")],
                  ["members", t("成员明细：每条信息组记录一行", "Members: one row per entry-list record")],
                  ["long", t("按题明细：每个答案一行", "By question: one row per answer")],
                ] as const).map(([value, label]) => (
                  <label className={`${surface.exportOption} ${layout === value ? surface.exportOptionSelected : ""}`} key={value}>
                    <input type="radio" name={layoutGroup} value={value} checked={layout === value} onChange={() => setLayout(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <p>
                {layout === "responses"
                  ? t(
                      "每题分列；多项填空和矩阵按子题拆列，成员名单按序号和字段拆列。多选 1 表示选中、0 表示未选；空白表示未填写或未显示。排序以数字记录名次。",
                      "One column per question; blanks and matrices split by sub-question, member lists by entry and field. For multiple choice 1 means selected and 0 not selected; empty means unanswered or not shown. Rankings are recorded as numbers.",
                    )
                  : layout === "members"
                    ? t(
                        "每条信息组记录一行，同名字段合并，并附报名编号、填写者、信息组题目及普通题答案，方便整理个人与团队名单。",
                        "One row per entry-list record; same-named fields are merged, with sign-up ID, respondent, list question and other answers, for compiling individual and team rosters.",
                      )
                    : t(
                        "每个答案一行，保留题目标识、题型和完整答案，适合复核历史问卷。",
                        "One row per answer, with question ID, type and full answer; suited to reviewing past questionnaires.",
                      )}
              </p>
              <p>
                {t("导出包含填写者当前的账号邮箱。", "Exports include the current account email of each respondent.")}
              </p>
              <p>{t("活动完成抽签后，导出文件包含每份报名的最新抽签结果。", "After a draw, the export includes the latest draw result for each sign-up.")}</p>
              <p>
                {t(
                  "学号、电话等列在 Excel 导入时请选择文本格式，保留前导零和长数字。",
                  "When importing into Excel, set student ID and phone columns to text to keep leading zeros and long numbers.",
                )}
              </p>
              <button
                type="button"
                className="button"
                disabled={busy || !canExport}
                onClick={() => void run(true)}
              >
                {t("导出筛选答卷 CSV", "Export filtered responses (CSV)")}
              </button>
            </section>
          ) : (
            <p role="note">{t("当前账号可读取名单。导出需要单独授权。", "This account can read the list. Export requires separate permission.")}</p>
          )}
        </div>
        <div className={surface.resultsMain}>
          {message && (
            <p
              className={failed ? surface.errorSummary : surface.resultMessage}
              role={failed ? "alert" : "status"}
            >
              {localizeManageMessage(message, locale)}
            </p>
          )}
          {loaded && appliedFilters !== JSON.stringify(filters) && (
            <p className={surface.resultMessage}>
              {t("筛选条件已改动。点击“查看统计图表”更新下方结果。", "Filters changed. Click “View statistics” to update the results below.")}
            </p>
          )}
          {!loaded && (
            <div className={surface.resultsEmpty}>
              <h3>{t("查看答卷中的共同选择", "See common choices across responses")}</h3>
              <p>{t("选择范围后读取统计。文本与日期答案可在报名名单中逐份查看。", "Choose a range, then load statistics. Text and date answers can be viewed one by one in the sign-up list.")}</p>
            </div>
          )}
          {loaded && !groups.length && (
            <div className={surface.resultsEmpty}>
              <h3>{t("没有符合条件的答卷", "No matching responses")}</h3>
              <p>{t("调整日期或答案条件后，再次读取统计。", "Adjust the date or answer filters and load statistics again.")}</p>
            </div>
          )}
          {groups.map((group) => (
            <section key={group.version}>
              <h3>
                {t(`问卷版本 ${group.version.slice(0, 8)}`, `Version ${group.version.slice(0, 8)}`)}{" "}
                <small>{t(`${group.total} 份答卷`, `${group.total} responses`)}</small>
              </h3>
              <p className="muted">
                {t("比例按已作答人数计算，多选合计可能超过 100%。", "Percentages are based on respondents who answered; multiple-choice totals can exceed 100%.")}
              </p>
              {group.questions.map((q) => (
                <article key={q.id} className="questionnaire-stat">
                  <h4>{q.label}</h4>
                  <p>
                    {t(`显示给 ${q.shown} 人，已作答 ${q.answered} 人`, `Shown to ${q.shown}, answered by ${q.answered}`)}
                    {q.average != null ? t(`，平均值 ${q.average}`, `, average ${q.average}`) : ""}
                    {q.nps != null ? t(`，NPS ${q.nps}`, `, NPS ${q.nps}`) : ""}
                  </p>
                  {q.counts.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>{t("选项 / 子题", "Option / sub-question")}</th>
                          <th>{t("人数", "Count")}</th>
                          <th>{t("比例", "Share")}</th>
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
                      {t("文本、日期和填空答案请在报名名单或导出文件中查看。", "View text, date and blank answers in the sign-up list or export.")}
                    </small>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
