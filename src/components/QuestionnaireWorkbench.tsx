"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TaskFrame, TaskNote } from "./v2/TaskFrame";
import { ButtonLink, EmptyState, Section, StatusPill, buttonClass } from "./v2/ui";
import work from "./v2/work.module.css";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { localizeManageMessage } from "@/lib/i18n/labels-manage";

type Doc = { id: number; title: string; _status?: string; canManage: boolean; canViewSignups: boolean };

export function QuestionnaireWorkbench() {
  const t = useT(),
    locale = useLocale();
  const [kind, setKind] = useState("events"),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [next, setNext] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/activities/manage?kind=${kind}&page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("暂时无法读取活动列表。", "Could not load the activity list right now."));
        if (!controller.signal.aborted) {
          setDocs(data.docs);
          setNext(data.hasNextPage);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof TypeError ? t("网络连接中断，请检查连接后重新加载。", "The connection was interrupted. Check your network and reload.") : cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, page, retry]);
  const source = kind === "events" ? t("站点活动", "site activities") : t("社群活动", "community activities");
  return (
    <TaskFrame
      wide
      eyebrow={t("SIGN-UP DESK · 问卷工作台", "SIGN-UP DESK · Questionnaires")}
      title={t("问卷工作台", "Questionnaire workbench")}
      description={t("从活动进入问卷编辑、报名名单与统计。每个入口只显示你当前有权处理的事务。", "Open questionnaire editing, sign-up lists and statistics from each activity. Only actions you are currently permitted to handle are shown.")}
      back={{ href: "/account", label: t("我的", "Me") }}
      actions={
        <ButtonLink href="/events" tone="stage">
          {t("浏览活动", "Browse activities")}
        </ButtonLink>
      }
      aside={
        <TaskNote title={t("权限与入口", "Permissions and entry points")} links={[{ href: "/community", label: t("查看游戏社群", "View game communities") }]}>
          <p>{t("新活动从内容管理后台或游戏社群的发布入口创建。", "Create new activities in the CMS or from a game community's publishing entry.")}</p>
          <p>{t("问卷编辑、名单读取与导出分别授权。每次打开都会核对当前任职范围。", "Questionnaire editing, list access and export are authorized separately. Your current roles are checked each time.")}</p>
        </TaskNote>
      }
    >
      <div className={work.flow} aria-busy={loading}>
        <div className={work.filter}>
          <label>
            {t("活动来源", "Activity source")}
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
            >
              <option value="events">{t("站点活动", "Site activities")}</option>
              <option value="community-posts">{t("社群活动", "Community activities")}</option>
            </select>
          </label>
        </div>
        <Section id="questionnaire-activities" title={t(`可处理的${source}`, `Your ${source}`)} description={t(`第 ${page} 页 · 只列出当前账号可编辑问卷或可读取报名的活动。`, `Page ${page} · Only activities whose questionnaire you can edit or whose sign-ups you can read.`)}>
          {loading && <p role="status">{t("正在加载可管理活动…", "Loading activities…")}</p>}
          {error && (
            <div className={work.decision} role="alert">
              <p>{localizeManageMessage(error, locale)}</p>
              <button type="button" className={buttonClass("ghost", "small")} onClick={() => setRetry(retry + 1)}>
                {t("重新加载", "Reload")}
              </button>
            </div>
          )}
          {!loading && !error && (
            <>
              {docs.length ? (
                <div className={work.records}>
                  {docs.map((doc) => (
                    <article className={work.record} key={doc.id} data-state={doc._status === "draft" ? "draft" : "open"}>
                      <div className={work.recordHead}>
                        <h3>{doc.title}</h3>
                        <StatusPill tone={doc._status === "draft" ? "warning" : "info"}>{doc._status === "draft" ? t("草稿 · 发布后可填写", "Draft · open after publishing") : t("活动问卷", "Activity questionnaire")}</StatusPill>
                      </div>
                      <p className={work.meta}>
                        <span>{doc.canManage ? t("可编辑问卷", "Can edit questionnaire") : t("问卷只读", "Questionnaire read-only")}</span>
                        {doc.canViewSignups && <span>{t("可查看报名", "Can view sign-ups")}</span>}
                      </p>
                      <nav className={work.actions} aria-label={t(`${doc.title}的操作`, `Actions for ${doc.title}`)}>
                        {doc.canManage && (
                          <Link className={buttonClass("primary", "small")} href={`/activities/${kind}/${doc.id}/manage`}>
                            {t("编辑问卷", "Edit questionnaire")}
                          </Link>
                        )}
                        {doc.canViewSignups && (
                          <Link className={work.chipLink} href={`/activities/${kind}/${doc.id}/signups`}>
                            {t("报名与统计", "Sign-ups and statistics")}
                          </Link>
                        )}
                        <Link className={work.chipLink} href={`/activities/${kind}/${doc.id}/fill`}>
                          {t("打开填写入口", "Open the form")}
                        </Link>
                      </nav>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t("暂无可管理的活动", "No activities to manage")}
                  icon="inbox"
                  compact
                  actions={
                    <button type="button" className={buttonClass("ghost", "small")} onClick={() => setRetry(retry + 1)}>
                      {t("重新加载", "Reload")}
                    </button>
                  }
                >
                  {t("试试切换活动来源。新获得的任职和资料授权会在重新加载后生效。", "Try switching the activity source. New roles and data permissions take effect after reloading.")}
                </EmptyState>
              )}
              <nav className={work.actions} aria-label={t("问卷列表分页", "Questionnaire list pages")}>
                <button type="button" className={buttonClass("ghost", "small")} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t("上一页", "Previous")}
                </button>
                <span className={work.meta}>{t(`第 ${page} 页`, `Page ${page}`)}</span>
                <button type="button" className={buttonClass("ghost", "small")} disabled={!next} onClick={() => setPage(page + 1)}>
                  {t("下一页", "Next")}
                </button>
              </nav>
            </>
          )}
        </Section>
      </div>
    </TaskFrame>
  );
}
