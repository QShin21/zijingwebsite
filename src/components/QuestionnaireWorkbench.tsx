"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import pages from "./activity-pages/ActivityPages.module.css";
import styles from "./activity-pages/Workspace.module.css";
export function QuestionnaireWorkbench() {
  const [kind, setKind] = useState("events"), [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [docs, setDocs] = useState<{ id: number; title: string; _status?: string; canManage: boolean; canViewSignups: boolean }[]>([]);
  const [next, setNext] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/activities/manage?kind=${kind}&page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "暂时无法读取活动列表。");
        if (!controller.signal.aborted) { setDocs(data.docs); setNext(data.hasNextPage); }
      }).catch(error => { if (!controller.signal.aborted) setError(error instanceof TypeError ? "网络连接中断，请检查连接后重新加载。" : error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, page, retry]);
  return <section className={`${pages.page} ${styles.workspace}`} aria-busy={loading}>
    <nav className={pages.breadcrumbs} aria-label="工作台导航"><Link href="/account">个人中心</Link><span aria-hidden="true">/</span><span>问卷工作台</span></nav>
    <header className={pages.hero}><div><p className={pages.eyebrow}>活动管理</p><h1>问卷工作台</h1><p>编辑活动问卷，查看授权范围内的报名与统计。新活动从内容管理后台或游戏社群的发布入口创建。</p></div><Link href="/events">浏览活动 →</Link></header>
    <p className={styles.scope}>问卷编辑、读取报名与导出分别授权。活动列表和每次请求都会核对你当前的任职范围。</p>
    <div className={styles.toolbar}><label>活动来源<select value={kind} onChange={event => { setKind(event.target.value); setPage(1); }}><option value="events">站点活动</option><option value="community-posts">社群活动</option></select></label></div>
    {loading && <p role="status">正在加载可管理活动…</p>}
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(retry + 1)}>重新加载</button></div>}
    {!loading && !error && <>
      <div className={styles.records}>{docs.map(doc => <article className={styles.record} key={doc.id}>
        <div className={pages.meta}><span className={pages.status}>{doc._status === "draft" ? "草稿 · 发布后可填写" : "活动问卷"}</span><span>{doc.canManage ? "可编辑问卷" : "问卷只读"}</span>{doc.canViewSignups && <span>可查看报名</span>}</div>
        <h2>{doc.title}</h2><div className="signup-tools">
          {doc.canManage && <Link href={`/activities/${kind}/${doc.id}/manage`}>编辑问卷 →</Link>}
          {doc.canViewSignups && <Link href={`/activities/${kind}/${doc.id}/signups`}>报名与统计 →</Link>}
          <Link href={`/activities/${kind}/${doc.id}/fill`}>打开填写入口</Link>
        </div>
      </article>)}</div>
      {!docs.length && <div className={pages.empty}><h2>暂无可管理的活动</h2><p>你可以切换活动来源；新获得的任职和资料授权会在刷新后生效。</p><Link href="/community">查看游戏社群 →</Link></div>}
      <nav className="signup-tools" aria-label="问卷列表分页"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} 页</span><button type="button" disabled={!next} onClick={() => setPage(page + 1)}>下一页</button></nav>
    </>}
  </section>;
}
