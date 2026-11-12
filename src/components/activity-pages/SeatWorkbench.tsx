"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { beijingInputTime } from "@/lib/rules";
import {
  seatAPI,
  seatLabel,
  seatStatusLabels,
  type SeatDecision,
  type SeatReview,
  type SeatStatus,
  type SeatingKind,
  type SeatingState,
  type SeatingWorkbench,
} from "@/lib/activity-seating-model";
import { EmptyState, KeyValues, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import { formatDateTime } from "@/components/v2/format";
import work from "@/components/v2/work.module.css";
import { SeatLegend, SeatMap, SeatZoom } from "./ActivitySeating";
import { SeatRequestError, seatJSON, seatRequest } from "./seat-request";
import styles from "./ActivitySeating.module.css";

export const seatStatusOrder: readonly SeatStatus[] = ["pending", "confirmed", "rejected", "cancelled", "revoked"];
export const seatTone: Record<SeatStatus, Tone> = { pending: "warning", confirmed: "success", rejected: "neutral", cancelled: "neutral", revoked: "neutral" };
/** Map seat statuses onto the shared V2 record accents (work.module.css). */
const recordState: Record<SeatStatus, string> = { pending: "pending", confirmed: "approved", rejected: "rejected", cancelled: "rejected", revoked: "rejected" };

/** Seat counts for the overview: pending holds, confirmed locks and what is still free. */
export function seatCounts(state: Pick<SeatingState, "rows" | "occupancy"> & Partial<Pick<SeatingState, "blockedSeats">>) {
  const total = state.rows.reduce((sum, row) => sum + row.count, 0);
  const blockedSeats = new Set(state.blockedSeats || []);
  const values = Object.entries(state.occupancy).filter(([seat]) => !blockedSeats.has(seat)).map(([, status]) => status);
  const pending = values.filter((value) => value === "pending").length;
  const confirmed = values.filter((value) => value === "confirmed").length;
  const blocked = blockedSeats.size;
  return { total, pending, confirmed, blocked, free: Math.max(0, total - pending - confirmed - blocked) };
}

/**
 * One review record. Presentational: the workbench passes live handlers and an authorized
 * proof URL builder; the synthetic specimen passes neither, so its actions stay disabled
 * and proofs render as labelled text tiles.
 */
export function SeatReviewCard({
  review,
  proofHref,
  busy = false,
  confirming = false,
  onDecide,
  onRevoke,
  confirmingSeat,
  onAskSeat,
  onCancelSeat,
  onReleaseSeat,
  onAskReject,
  onCancelReject,
}: {
  review: SeatReview;
  proofHref?: (proof: string) => string;
  busy?: boolean;
  confirming?: boolean;
  onDecide?: (id: number, decision: SeatDecision) => void;
  onRevoke?: (id: number) => void;
  confirmingSeat?: string;
  onAskSeat?: (id: number, seat: string) => void;
  onCancelSeat?: () => void;
  onReleaseSeat?: (id: number, seat: string) => void;
  onAskReject?: (id: number) => void;
  onCancelReject?: () => void;
}) {
  const live = Boolean(onDecide);
  return (
    <article className={work.record} data-state={recordState[review.status]} aria-labelledby={`seat-review-${review.id}`}>
      <header className={work.recordHead}>
        <div>
          <h3 id={`seat-review-${review.id}`}>{review.memberName}</h3>
          <p className={work.meta}>
            <span>申请 #{review.id}</span>
            <span>提交 {formatDateTime(review.createdAt)}</span>
            {review.reviewedAt && <span>审核 {formatDateTime(review.reviewedAt)}</span>}
          </p>
        </div>
        <StatusPill tone={seatTone[review.status]}>{seatStatusLabels[review.status]}</StatusPill>
      </header>
      <div className={work.split}>
        <div className={work.submission}>
          <h4>申请信息</h4>
          <KeyValues
            items={[
              { label: "手机号", value: live ? <a href={`tel:${review.phone}`}>{review.phone}</a> : review.phone },
              { label: "座位", value: `${review.seats.length} 个 · ${review.seats.map(seatLabel).join("、")}` },
              ...(review.releasedSeats?.length ? [{ label: "已撤销座位", value: review.releasedSeats.map(item => seatLabel(item.seat)).join("、") }] : []),
            ]}
          />
          <details className={work.disclosure} open={review.status === "pending"}>
            <summary>活动参与凭证（{review.proofs.length} 张）</summary>
            <ul className={styles.proofGrid}>
              {review.proofs.map((proof, index) => {
                const href = proofHref?.(proof);
                return (
                  <li key={proof}>
                    {href ? (
                      <a className={styles.proofThumb} href={href} target="_blank" rel="noreferrer">
                        {/* Authorized, no-store image endpoint; loads only when the disclosure is open and in view. */}
                        <img src={href} alt={`${review.memberName}的凭证 ${index + 1}`} loading="lazy" decoding="async" width={160} height={160} />
                        <span>凭证 {index + 1}</span>
                      </a>
                    ) : (
                      <span className={styles.proofTile}>
                        凭证 {index + 1}
                        <small>合成样本 · 无图片</small>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
        <section className={work.decision} aria-label={`${review.memberName}的审核操作`}>
          <h4>审核决定</h4>
          {review.status === "pending" ? (
            <>
              <p className={styles.hint}>通过后座位锁定；驳回后座位释放给其他成员。已确认的申请可在已确认列表中撤销。</p>
              <div className={work.actions}>
                {confirming ? (
                  <>
                    <button type="button" className={buttonClass("danger")} disabled={busy || !live} onClick={() => onDecide?.(review.id, "rejected")}>
                      确认驳回并释放
                    </button>
                    <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={onCancelReject}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={buttonClass("primary")} disabled={busy || !live} onClick={() => onDecide?.(review.id, "confirmed")}>
                      通过并锁定
                    </button>
                    <button type="button" className={buttonClass("ghost")} disabled={busy || !live} onClick={() => onAskReject?.(review.id)}>
                      驳回并释放
                    </button>
                  </>
                )}
              </div>
              {!live && <p className={styles.hint}>合成样本：操作已停用。</p>}
            </>
          ) : review.status === "confirmed" ? (
            <>
              <p className={styles.hint}>已通过，座位已锁定。可撤销单个座位或整份申请。</p>
              <details className={work.disclosure}>
                <summary>撤销单个座位</summary>
                <p className={styles.hint}>选择需要释放的座位。</p>
                <div className={work.actions}>
                  {review.seats.map(seat => <button type="button" key={seat} className={buttonClass("ghost", "small")}
                    disabled={busy || !onReleaseSeat} onClick={() => onAskSeat?.(review.id, seat)}>撤销 {seatLabel(seat)}</button>)}
                </div>
                {confirmingSeat && review.seats.includes(confirmingSeat) && (
                  <div className={work.actions}>
                    <p className={styles.hint}>{review.seats.length === 1 ? "这是最后一个座位，撤销后整份申请将变为已撤销。" : "该座位将释放，其余座位继续保持已确认。"}</p>
                    <button type="button" className={buttonClass("danger", "small")} disabled={busy || !onReleaseSeat}
                      onClick={() => onReleaseSeat?.(review.id, confirmingSeat)}>确认撤销 {seatLabel(confirmingSeat)}</button>
                    <button type="button" className={buttonClass("ghost", "small")} disabled={busy} onClick={onCancelSeat}>返回</button>
                  </div>
                )}
              </details>
              <div className={work.actions}>
                {confirming ? (
                  <>
                    <button type="button" className={buttonClass("danger")} disabled={busy || !onRevoke} onClick={() => onRevoke?.(review.id)}>确认撤销并释放</button>
                    <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={onCancelReject}>返回</button>
                  </>
                ) : <button type="button" className={buttonClass("ghost")} disabled={busy || !onRevoke} onClick={() => onAskReject?.(review.id)}>撤销确认</button>}
              </div>
            </>
          ) : (
            <p className={styles.hint}>{review.status === "cancelled" ? "申请人已取消，座位已释放。" : review.status === "revoked" ? "管理员已撤销确认，座位已释放。" : "已驳回，座位已释放。"}</p>
          )}
        </section>
      </div>
    </article>
  );
}

type View = { status: SeatStatus; page: number };

/**
 * Reviewer workbench. Server routes re-check review rights on every call; this client only
 * reflects them. One action at a time, stale replies dropped, a refresh after every action
 * (a 409 means another reviewer already decided).
 */
export function SeatWorkbench({ kind, id }: { kind: SeatingKind; id: number }) {
  const endpoint = seatAPI(kind, id);
  const [view, setView] = useState<View>({ status: "pending", page: 1 });
  const [data, setData] = useState<SeatingWorkbench>();
  const [layout, setLayout] = useState<SeatingState>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [confirmingSeat, setConfirmingSeat] = useState<{ id: number; seat: string } | null>(null);
  const [zoom, setZoom] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const lock = useRef(false);
  const ticket = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async (next: View, signal?: AbortSignal) => {
      const current = ++ticket.current;
      const query = new URLSearchParams({ mode: "review", status: next.status, page: String(next.page) });
      const [records, seats] = await Promise.all([
        seatRequest<SeatingWorkbench>(`${endpoint}?${query}`, { signal }),
        // The occupancy overview is a convenience; the review list must not fail with it.
        seatRequest<SeatingState>(endpoint, { signal }).catch(() => undefined),
      ]);
      if (!alive.current || signal?.aborted || current !== ticket.current) return;
      setData(records);
      setLayout(seats);
      setSelected([]);
    },
    [endpoint],
  );

  /** A failed read must not leave another filter's or a revoked reviewer's phone numbers and proofs on screen. */
  const forget = useCallback((cause: unknown, always: boolean) => {
    if (!alive.current) return;
    if (always || (cause instanceof SeatRequestError && (cause.status === 401 || cause.status === 403))) {
      setData(undefined);
      setLayout(undefined);
      setConfirming(null);
      setConfirmingSeat(null);
      setSelected([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(view, controller.signal)
      .catch((cause) => {
        if (controller.signal.aborted || !alive.current) return;
        forget(cause, true);
        setError(cause instanceof Error ? cause.message : "选座申请读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted && alive.current) setLoading(false);
      });
    return () => controller.abort();
  }, [forget, load, view]);

  function show(status: SeatStatus, page: number) {
    if (lock.current) return;
    setConfirming(null);
    setConfirmingSeat(null);
    setError("");
    setNotice("");
    setLoading(true);
    setView({ status, page });
  }

  async function act(label: string, task: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const message = await task();
      if (alive.current) setNotice(message);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "操作失败，请重试");
    } finally {
      if (alive.current) await load(view).catch((cause) => forget(cause, false));
      lock.current = false;
      if (alive.current) {
        setBusy("");
        setConfirming(null);
        setConfirmingSeat(null);
      }
    }
  }

  function setEnabled(enabled: boolean) {
    void act(enabled ? "正在开启选座" : "正在关闭选座", async () => {
      await seatRequest(endpoint, seatJSON("PUT", { enabled }));
      setOpeningTime(null);
      return enabled ? "选座已开启，成员可以提交申请。" : "选座已关闭：已有申请仍可审核。";
    });
  }

  function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const opensAt = openingTime ?? beijingInputTime(data?.opensAt);
    void act("正在保存开放时间", async () => {
      await seatRequest(endpoint, seatJSON("PUT", { enabled: true, opensAt }));
      setOpeningTime(null);
      return "已保存定时开放。";
    });
  }

  function decide(request: number, status: SeatDecision) {
    const record = data?.docs.find(value => value.id === request);
    if (!record) return;
    void act(status === "confirmed" ? "正在通过申请" : "正在驳回申请", async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "review", id: request, status, revision: record.revision }));
      return status === "confirmed" ? "已通过并锁定座位。" : "已驳回并释放座位。";
    });
  }

  function revoke(request: number) {
    const record = data?.docs.find(value => value.id === request);
    if (!record || record.status !== "confirmed") return;
    void act("正在撤销确认", async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "revoke", id: request, revision: record.revision }));
      return "已撤销确认，全部座位已释放。";
    });
  }

  function releaseSeat(request: number, seat: string) {
    const record = data?.docs.find(value => value.id === request);
    if (!record || record.status !== "confirmed" || !record.seats.includes(seat)) return;
    void act("正在撤销座位", async () => {
      const result = await seatRequest<{ fullyRevoked: boolean }>(endpoint, seatJSON("POST", { action: "revoke-seat", id: request, revision: record.revision, seat }));
      return result.fullyRevoked ? `已撤销 ${seatLabel(seat)}，申请已全部撤销。` : `已撤销 ${seatLabel(seat)}，其余座位保持已确认。`;
    });
  }

  function setBlocks(blocked: boolean) {
    if (!layout) return;
    const blockedSeats = new Set(layout.blockedSeats || []);
    const seats = selected.filter(seat => blockedSeats.has(seat) === !blocked);
    if (!seats.length) return;
    void act(blocked ? "正在锁定座位" : "正在解锁座位", async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "block", seats, blocked }));
      return `已${blocked ? "锁定" : "解锁"} ${seats.length} 个座位。`;
    });
  }

  const counts = layout ? seatCounts(layout) : null;
  const disabled = loading || Boolean(busy);
  const lockedSelection = selected.filter(seat => layout?.blockedSeats?.includes(seat)).length;
  const availableSelection = selected.length - lockedSelection;
  return (
    <div className={styles.workbench} aria-busy={disabled}>
      {data && (
        <section className={styles.control} aria-label="选座设置">
          <div className={styles.controlText}>
            <p>
              <StatusPill tone={data.open ? "live" : "neutral"}>{data.scheduled ? "等待开放" : data.open ? "选座开放中" : data.enabled ? "选座已关闭" : "选座未开启"}</StatusPill>
            </p>
            <p>
              {data.scheduled
                ? "开放时间到达后，成员可以在活动页选座并提交凭证。"
                : data.enabled
                ? "成员可以在活动页选座并提交凭证。关闭后不再接收新申请，已提交的申请仍在此审核。"
                : "开启后成员可在活动页选择 1–10 个座位并提交手机号与凭证；未公开的活动不能开启。"}
            </p>
            {data.scheduled && <p>将于北京时间 {formatDateTime(data.opensAt)} 开放选座。</p>}
            {data.enabled && layout && !layout.open && !data.scheduled && <p>活动已结束、取消或暂未公开，成员端当前不能提交新申请。</p>}
            <form className={styles.schedule} onSubmit={schedule}>
              <label className={styles.field}>定时开放（北京时间）
                <input type="datetime-local" value={openingTime ?? beijingInputTime(data.opensAt)} required disabled={disabled} onChange={event => setOpeningTime(event.currentTarget.value)} />
              </label>
              <button type="submit" className={buttonClass("primary")} disabled={disabled}>保存开放时间</button>
            </form>
          </div>
          <div className={work.actions}>
            {(!data.enabled || data.scheduled) && <button type="button" className={buttonClass("primary")} disabled={disabled} onClick={() => setEnabled(true)}>{data.scheduled ? "立即开放" : "开启选座"}</button>}
            {data.enabled && <button type="button" className={buttonClass("ghost")} disabled={disabled} onClick={() => setEnabled(false)}>关闭选座</button>}
          </div>
        </section>
      )}

      {counts && (
        <ul className={work.stats} aria-label="座位概况">
          <li data-hot={counts.pending > 0 || undefined}>
            <strong>{counts.pending}</strong>
            <span>待审核占用</span>
          </li>
          <li>
            <strong>{counts.confirmed}</strong>
            <span>已确认锁定</span>
          </li>
          <li>
            <strong>{counts.blocked}</strong>
            <span>未开放</span>
          </li>
          <li>
            <strong>{counts.free}</strong>
            <span>剩余可选 / {counts.total}</span>
          </li>
        </ul>
      )}

      {layout && (
        <details className={`${work.disclosure} ${styles.overview}`} open>
          <summary>管理未开放座位</summary>
          <p className={styles.blockHint}>点选空座锁定，或点选未开放的座位解锁。已有申请的座位保留原状态。</p>
          <div className={styles.mapBlock}>
            <div className={styles.mapTools}>
              <SeatLegend />
              <SeatZoom zoom={zoom} onChange={setZoom} />
            </div>
            <SeatMap state={layout} selected={selected} editable={!disabled} manage zoom={zoom} label="管理未开放座位" toggle={seat => setSelected(current => current.includes(seat) ? current.filter(value => value !== seat) : [...current, seat])} />
          </div>
          <div className={styles.blockControls}>
            <span className={styles.blockHint}>已选 {availableSelection} 个空座、{lockedSelection} 个未开放座位</span>
            <button type="button" className={buttonClass("primary", "small")} disabled={disabled || !availableSelection} onClick={() => setBlocks(true)}>锁定所选空座</button>
            <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || !lockedSelection} onClick={() => setBlocks(false)}>解锁所选座位</button>
            <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || !selected.length} onClick={() => setSelected([])}>清除选择</button>
          </div>
        </details>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="按审核状态筛选">
          {seatStatusOrder.map((value) => (
            <button type="button" key={value} className={styles.filter} aria-pressed={value === view.status} disabled={disabled} onClick={() => show(value, 1)}>
              {seatStatusLabels[value]}
            </button>
          ))}
        </div>
        <button type="button" className={buttonClass("ghost", "small")} disabled={disabled} onClick={() => show(view.status, view.page)}>
          刷新
        </button>
      </div>

      {(loading || busy) && (
        <p className={styles.status} role="status">
          {busy ? `${busy}…` : "正在读取申请…"}
        </p>
      )}
      {notice && (
        <p className={styles.status} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          {data.docs.length ? (
            <div className={work.records}>
              {data.docs.map((review) => (
                <SeatReviewCard
                  key={review.id}
                  review={review}
                  proofHref={(proof) => `${endpoint}/proofs/${encodeURIComponent(proof)}`}
                  busy={Boolean(busy)}
                  confirming={confirming === review.id}
                  onDecide={decide}
                  onRevoke={revoke}
                  confirmingSeat={confirmingSeat?.id === review.id ? confirmingSeat.seat : undefined}
                  onAskSeat={(request, seat) => { setConfirming(null); setConfirmingSeat({ id: request, seat }); }}
                  onCancelSeat={() => setConfirmingSeat(null)}
                  onReleaseSeat={releaseSeat}
                  onAskReject={request => { setConfirmingSeat(null); setConfirming(request); }}
                  onCancelReject={() => setConfirming(null)}
                />
              ))}
            </div>
          ) : (
            <EmptyState compact icon="check" title={`此页没有${seatStatusLabels[view.status]}的选座申请`}>
              {view.status === "pending" ? "新的选座申请提交后会出现在这里。" : "切换上方状态可查看其他申请。"}
            </EmptyState>
          )}
          {(view.page > 1 || data.hasNextPage) && (
            <nav className={styles.pagination} aria-label="选座申请分页">
              <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || view.page <= 1} onClick={() => show(view.status, view.page - 1)}>
                上一页
              </button>
              <span>第 {view.page} 页</span>
              <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || !data.hasNextPage} onClick={() => show(view.status, view.page + 1)}>
                下一页
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
