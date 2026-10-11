"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function QuestionnaireWorkbench() {
  const [kind, setKind] = useState("events"),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [docs, setDocs] = useState<
      { id: number; title: string; _status?: string }[]
    >([]),
    [next, setNext] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/activities/manage?kind=${kind}&page=${page}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "读取失败");
        setDocs(data.docs);
        setNext(data.hasNextPage);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, page, retry]);
  return (
    <section className="panel member-form">
      <h1>问卷工作台</h1>
      <p>
        管理你有权限的活动问卷、预览填写效果，并查看回收统计。新活动可从内容管理后台或游戏社群的活动发布入口创建。
      </p>
      <label>
        活动来源
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
        >
          <option value="events">站点活动</option>
          <option value="community-posts">社群活动</option>
        </select>
      </label>
      <p role="status">{loading ? "正在加载…" : error}</p>
      {error && <button onClick={() => setRetry(retry + 1)}>重新加载</button>}
      {!loading && !error && (
        <>
          {docs.map((doc) => (
            <article className="questionnaire-stat" key={doc.id}>
              <h2>{doc.title}</h2>
              <p>
                {doc._status === "draft" ? "草稿 · 发布后可填写" : "活动问卷"}
              </p>
              <div className="signup-tools">
                <Link href={`/activities/${kind}/${doc.id}/manage`}>
                  编辑与统计
                </Link>
                <Link href={`/activities/${kind}/${doc.id}/fill`}>
                  填写入口
                </Link>
              </div>
            </article>
          ))}
          {!docs.length && <p>暂无可管理的活动。</p>}
          <div className="signup-tools">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              上一页
            </button>
            <span>第 {page} 页</span>
            <button disabled={!next} onClick={() => setPage(page + 1)}>
              下一页
            </button>
          </div>
        </>
      )}
    </section>
  );
}
