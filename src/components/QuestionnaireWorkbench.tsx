"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TaskFrame, TaskNote } from "./v2/TaskFrame";
import { ButtonLink, EmptyState, Section, StatusPill, buttonClass } from "./v2/ui";
import work from "./v2/work.module.css";

type Doc = { id: number; title: string; _status?: string; canManage: boolean; canViewSignups: boolean };

export function QuestionnaireWorkbench() {
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
        if (!response.ok) throw new Error(data.error || "暂时无法读取活动列表。");
        if (!controller.signal.aborted) {
          setDocs(data.docs);
          setNext(data.hasNextPage);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof TypeError ? "网络连接中断，请检查连接后重新加载。" : cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, page, retry]);
  const source = kind === "events" ? "站点活动" : "社群活动";
  return (
    <TaskFrame
      wide
      eyebrow="SIGN-UP DESK · 问卷工作台"
      title="问卷工作台"
      description="从活动进入问卷编辑、报名名单与统计。每个入口只显示你当前有权处理的事务。"
      back={{ href: "/account", label: "我的" }}
      actions={
        <ButtonLink href="/events" tone="stage">
          浏览活动
        </ButtonLink>
      }
      aside={
        <TaskNote title="权限与入口" links={[{ href: "/community", label: "查看游戏社群" }]}>
          <p>新活动从内容管理后台或游戏社群的发布入口创建。</p>
          <p>问卷编辑、名单读取与导出分别授权。每次打开都会核对当前任职范围。</p>
        </TaskNote>
      }
    >
      <div className={work.flow} aria-busy={loading}>
        <div className={work.filter}>
          <label>
            活动来源
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
            >
              <option value="events">站点活动</option>
              <option value="community-posts">社群活动</option>
            </select>
          </label>
        </div>
        <Section id="questionnaire-activities" title={`可处理的${source}`} description={`第 ${page} 页 · 只列出当前账号可编辑问卷或可读取报名的活动。`}>
          {loading && <p role="status">正在加载可管理活动…</p>}
          {error && (
            <div className={work.decision} role="alert">
              <p>{error}</p>
              <button type="button" className={buttonClass("ghost", "small")} onClick={() => setRetry(retry + 1)}>
                重新加载
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
                        <StatusPill tone={doc._status === "draft" ? "warning" : "info"}>{doc._status === "draft" ? "草稿 · 发布后可填写" : "活动问卷"}</StatusPill>
                      </div>
                      <p className={work.meta}>
                        <span>{doc.canManage ? "可编辑问卷" : "问卷只读"}</span>
                        {doc.canViewSignups && <span>可查看报名</span>}
                      </p>
                      <nav className={work.actions} aria-label={`${doc.title}的操作`}>
                        {doc.canManage && (
                          <Link className={buttonClass("primary", "small")} href={`/activities/${kind}/${doc.id}/manage`}>
                            编辑问卷
                          </Link>
                        )}
                        {doc.canViewSignups && (
                          <Link className={work.chipLink} href={`/activities/${kind}/${doc.id}/signups`}>
                            报名与统计
                          </Link>
                        )}
                        <Link className={work.chipLink} href={`/activities/${kind}/${doc.id}/fill`}>
                          打开填写入口
                        </Link>
                      </nav>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="暂无可管理的活动"
                  icon="inbox"
                  compact
                  actions={
                    <button type="button" className={buttonClass("ghost", "small")} onClick={() => setRetry(retry + 1)}>
                      重新加载
                    </button>
                  }
                >
                  试试切换活动来源。新获得的任职和资料授权会在重新加载后生效。
                </EmptyState>
              )}
              <nav className={work.actions} aria-label="问卷列表分页">
                <button type="button" className={buttonClass("ghost", "small")} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  上一页
                </button>
                <span className={work.meta}>第 {page} 页</span>
                <button type="button" className={buttonClass("ghost", "small")} disabled={!next} onClick={() => setPage(page + 1)}>
                  下一页
                </button>
              </nav>
            </>
          )}
        </Section>
      </div>
    </TaskFrame>
  );
}
