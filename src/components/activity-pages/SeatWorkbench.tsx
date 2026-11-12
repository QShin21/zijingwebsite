
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { seatAPI, seatLabel, seatStatusLabels, type SeatDecision, type SeatStatus, type SeatingKind, type SeatingWorkbench } from "@/lib/activity-seating-model";
import { beijingInputTime, formatDate } from "@/lib/rules";
import { seatJSON, seatRequest } from "./seat-request";
import styles from "./ActivitySeating.module.css";

export function SeatWorkbench({ kind, id }: { kind: SeatingKind; id: number }) {
  const endpoint = seatAPI(kind, id);
  const [data, setData] = useState<SeatingWorkbench>();
  const [status, setStatus] = useState<SeatStatus>("pending");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await seatRequest<SeatingWorkbench>(`${endpoint}?mode=review&status=${status}&page=${page}`, { signal });
    setData(result);
  }, [endpoint, page, status]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(cause => {
      if (!controller.signal.aborted) setError((cause as Error).message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  async function update(method: "POST" | "PUT", input: object, message: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await seatRequest(endpoint, seatJSON(method, input));
      if (method === "PUT") setOpeningTime(null);
      setNotice(message);
      await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  function review(id: number, decision: SeatDecision) {
    void update("POST", { action: "review", id, status: decision },
      decision === "confirmed" ? "已通过并锁定座位" : "已驳回并释放座位");
  }

  function show(nextStatus: SeatStatus, nextPage: number) {
    if (nextStatus === status && nextPage === page) {
      setLoading(true);
      setError("");
      void load().catch(cause => setError((cause as Error).message)).finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    setStatus(nextStatus);
    setPage(nextPage);
  }

  const plannedTime = openingTime ?? beijingInputTime(data?.opensAt);
  function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update("PUT", { enabled: true, opensAt: plannedTime }, "已保存定时开放");
  }

  return (
    <section className={styles.workbench} aria-label="选座审核">
      {data && (
        <>
          <div className={styles.heading}>
            <p>活动选座 · <strong>{data.scheduled ? "等待开放" : data.open ? "已开放" : data.enabled ? "已关闭" : "未启用"}</strong></p>
            <div className={styles.actions}>
              {(!data.enabled || data.scheduled) && (
                <button type="button" className="button light" disabled={loading || saving} onClick={() =>
                  update("PUT", { enabled: true }, "已启用选座")}>
                  {data.scheduled ? "立即开放" : "启用选座"}
                </button>
              )}
              {data.enabled && (
                <button type="button" className="button light" disabled={loading || saving} onClick={() =>
                  update("PUT", { enabled: false }, "已停用选座")}>停用选座</button>
              )}
            </div>
          </div>
          <form className={styles.schedule} onSubmit={schedule}>
            <label className={styles.field}>定时开放（北京时间）
              <input type="datetime-local" value={plannedTime} required disabled={loading || saving}
                onChange={event => setOpeningTime(event.currentTarget.value)} />
            </label>
            <button className="button" type="submit" disabled={loading || saving}>保存开放时间</button>
          </form>
          {data.scheduled && <p>将于北京时间 {formatDate(data.opensAt)} 开放选座。</p>}
        </>
      )}
      <div className={styles.actions} aria-label="审核状态筛选">
        {(Object.keys(seatStatusLabels) as SeatStatus[]).map(value => (
          <button type="button" key={value} className={value === status ? "button" : "button light"}
            aria-pressed={value === status} disabled={saving || loading} onClick={() => show(value, 1)}>
            {seatStatusLabels[value]}
          </button>
        ))}
        <button type="button" className="button light" disabled={saving || loading} onClick={() => show(status, page)}>刷新</button>
      </div>
      {loading && <p role="status">正在读取申请…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && data && (
        <>
          {!data.docs.length && <p>此页暂无{seatStatusLabels[status]}的选座申请。</p>}
          <ul className={styles.reviewList}>
            {data.docs.map(row => (
              <li key={row.id} className={styles.reviewCard}>
                <div className={styles.heading}>
                  <h2>{row.memberName}</h2>
                  <span>{seatStatusLabels[row.status]}</span>
                </div>
                <dl className={styles.reviewDetails}>
                  <dt>手机号</dt><dd><a href={`tel:${row.phone}`}>{row.phone}</a></dd>
                  <dt>座位</dt><dd>{row.seats.map(seatLabel).join("、")}</dd>
                  <dt>提交时间</dt><dd>{formatDate(row.createdAt)}</dd>
                  {row.reviewedAt && <><dt>审核时间</dt><dd>{formatDate(row.reviewedAt)}</dd></>}
                </dl>
                <ul className={styles.proofs}>
                  {row.proofs.map((proof, index) => (
                    <li key={proof}><a className="button light" href={`${endpoint}/proofs/${proof}`} target="_blank" rel="noreferrer">
                      查看凭证 {index + 1}
                    </a></li>
                  ))}
                </ul>
                {row.status === "pending" && (
                  <div className={styles.actions}>
                    <button type="button" className="button" disabled={saving} onClick={() => review(row.id, "confirmed")}>通过并锁定</button>
                    <button type="button" className="button light" disabled={saving} onClick={() => review(row.id, "rejected")}>驳回并释放</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {(page > 1 || data.hasNextPage) && (
            <nav className={styles.actions} aria-label="申请列表分页">
              <button type="button" className="button light" disabled={saving || page <= 1} onClick={() => show(status, page - 1)}>上一页</button>
              <span>第 {page} 页</span>
              <button type="button" className="button light" disabled={saving || !data.hasNextPage} onClick={() => show(status, page + 1)}>下一页</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
