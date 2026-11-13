"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { beijingInputTime } from "@/lib/rules";
import {
  seatAPI,
  seatLabel,
  seatLimit,
  seatStatusLabels,
  type SeatDecision,
  type SeatAssignment,
  type SeatReview,
  type SeatStatus,
  type SeatingKind,
  type SeatingMode,
  type SeatingState,
  type SeatingWorkbench,
} from "@/lib/activity-seating-model";
import { EmptyState, KeyValues, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import { formatDateTime } from "@/components/v2/format";
import work from "@/components/v2/work.module.css";
import { SeatLegend, SeatMap, SeatSelection, SeatZoom, seatName, seatStatusName } from "./ActivitySeating";
import { SeatTicketManager } from "./SeatTicketManager";
import { SeatLayoutEditor } from "./SeatLayoutEditor";
import { SeatRequestError, localizeSeatError, seatJSON, seatRequest } from "./seat-request";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import styles from "./ActivitySeating.module.css";

export const seatStatusOrder: readonly SeatStatus[] = ["pending", "confirmed", "rejected", "cancelled", "revoked"];
export const seatTone: Record<SeatStatus, Tone> = { pending: "warning", confirmed: "success", rejected: "neutral", cancelled: "neutral", revoked: "neutral" };
/** Map seat statuses onto the shared V2 record accents (work.module.css). */
const recordState: Record<SeatStatus, string> = { pending: "pending", confirmed: "approved", rejected: "rejected", cancelled: "rejected", revoked: "rejected" };

/** Seat counts for the overview: pending holds, confirmed locks and what is still free. */
export function seatCounts(state: Pick<SeatingState, "rows" | "occupancy"> & Partial<Pick<SeatingState, "blockedSeats" | "missingSeats">>) {
  const missing = new Set(state.missingSeats || []);
  const total = state.rows.reduce((sum, row) => sum + row.count, 0) - missing.size;
  const blockedSeats = new Set((state.blockedSeats || []).filter(seat => !missing.has(seat)));
  const values = Object.entries(state.occupancy).filter(([seat]) => !blockedSeats.has(seat) && !missing.has(seat)).map(([, status]) => status);
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
  onAdd,
  onChangeSeats,
  onRandomCount,
  mapCard = false,
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
  onAdd?: (id: number) => void;
  onChangeSeats?: (id: number) => void;
  onRandomCount?: (id: number, count: number) => void;
  mapCard?: boolean;
}) {
  const t = useT(),
    locale = useLocale(),
    seats = (values: string[]) => values.map((seat) => seatName(seat, locale)).join(t("、", ", "));
  const live = Boolean(onDecide);
  const unassigned = review.status === "pending" && review.allocationMode === "random" && !review.seats.length;
  const headingID = `seat-review-${mapCard ? "map-" : ""}${review.id}`;
  return (
    <article className={work.record} data-state={recordState[review.status]} aria-labelledby={headingID}>
      <header className={work.recordHead}>
        <div>
          <h3 id={headingID}>{review.memberName}</h3>
          <p className={work.meta}>
            <span>{t(`申请 #${review.id}`, `Request #${review.id}`)}</span>
            <span>{t(`提交 ${formatDateTime(review.createdAt)}`, `Submitted ${formatDateTime(review.createdAt, locale)}`)}</span>
            {review.reviewedAt && <span>{t(`审核 ${formatDateTime(review.reviewedAt)}`, `Reviewed ${formatDateTime(review.reviewedAt, locale)}`)}</span>}
          </p>
        </div>
        <StatusPill tone={seatTone[review.status]}>{seatStatusName(review.status, locale)}</StatusPill>
      </header>
      <div className={work.split}>
        <div className={work.submission}>
          <h4>{t("申请信息", "Request details")}</h4>
          <KeyValues
            items={[
              { label: t("手机号", "Phone"), value: live ? <a href={`tel:${review.phone}`}>{review.phone}</a> : review.phone },
              { label: t("座位", "Seats"), value: unassigned ? t(`${review.requestedCount} 个 · 审核通过后安排`, `${review.requestedCount} · assigned after approval`) : t(`${review.seats.length} 个 · ${review.seats.map(seatLabel).join("、")}`, `${review.seats.length} · ${seats(review.seats)}`) },
              ...(review.releasedSeats?.length ? [{ label: t("已释放座位", "Released seats"), value: seats(review.releasedSeats.map(item => item.seat)) }] : []),
              ...(review.addedSeats?.length ? [{ label: t("管理员增加座位", "Seats added by admins"), value: seats(review.addedSeats.map(item => item.seat)) }] : []),
            ]}
          />
          <details className={work.disclosure} open={review.status === "pending"}>
            <summary>{t(`活动参与凭证（${review.proofs.length} 张）`, `Participation proofs (${review.proofs.length})`)}</summary>
            <ul className={styles.proofGrid}>
              {review.proofs.map((proof, index) => {
                const href = proofHref?.(proof);
                return (
                  <li key={proof}>
                    {href ? (
                      <a className={styles.proofThumb} href={href} target="_blank" rel="noreferrer">
                        {/* Authorized, no-store image endpoint; loads only when the disclosure is open and in view. */}
                        <img src={href} alt={t(`${review.memberName}的凭证 ${index + 1}`, `${review.memberName}'s proof ${index + 1}`)} loading="lazy" decoding="async" width={160} height={160} />
                        <span>{t(`凭证 ${index + 1}`, `Proof ${index + 1}`)}</span>
                      </a>
                    ) : (
                      <span className={styles.proofTile}>
                        {t(`凭证 ${index + 1}`, `Proof ${index + 1}`)}
                        <small>{t("合成样本 · 无图片", "Synthetic sample · no image")}</small>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
        <section className={work.decision} aria-label={t(`${review.memberName}的审核操作`, `Review actions for ${review.memberName}`)}>
          <h4>{t("审核决定", "Decision")}</h4>
          {unassigned ? (
            <form className={work.actions} onSubmit={event => {
              event.preventDefault();
              const count = Number(new FormData(event.currentTarget).get("count"));
              if (Number.isInteger(count) && count >= 1 && count <= seatLimit) onRandomCount?.(review.id, count);
            }}>
              <label className={styles.field}>{t("申请数量", "Requested seats")}<input key={`${review.id}-${review.revision}`} type="number" name="count" min={1} max={seatLimit} defaultValue={review.requestedCount} required disabled={busy || !onRandomCount} /></label>
              <button type="submit" className={buttonClass("ghost", "small")} disabled={busy || !onRandomCount}>{t("调整数量", "Change count")}</button>
            </form>
          ) : (review.status === "pending" || review.status === "confirmed") && (
            <div className={work.actions}>
              <button type="button" className={buttonClass("ghost")} disabled={busy || !onAdd || review.seats.length >= seatLimit} onClick={() => onAdd?.(review.id)}>{t("增加座位", "Add seats")}</button>
              <button type="button" className={buttonClass("ghost")} disabled={busy || !onChangeSeats} onClick={() => onChangeSeats?.(review.id)}>{t("更换座位", "Change seats")}</button>
              {review.seats.length >= seatLimit && <p className={styles.hint}>{t(`已达到每份申请 ${seatLimit} 个座位的上限。`, `This request has reached the ${seatLimit}-seat limit.`)}</p>}
            </div>
          )}
          {review.status === "pending" ? (
            <>
              <p className={styles.hint}>{unassigned ? t("通过后系统优先安排同排连坐；座位不足时可调整数量或释放座位。", "On approval, seats are assigned together in one row where possible. If seats run short, change the count or release seats.") : t("通过后座位锁定；驳回后座位释放给其他成员。已确认的申请可撤销或逐座释放。", "Approving locks the seats; rejecting releases them to other members. Confirmed requests can be revoked in full or seat by seat.")}</p>
              <div className={work.actions}>
                {confirming ? (
                  <>
                    <button type="button" className={buttonClass("danger")} disabled={busy || !live} onClick={() => onDecide?.(review.id, "rejected")}>
                      {t("确认驳回并释放", "Confirm reject and release")}
                    </button>
                    <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={onCancelReject}>
                      {t("取消", "Cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={buttonClass("primary")} disabled={busy || !live} onClick={() => onDecide?.(review.id, "confirmed")}>
                      {t("通过并锁定", "Approve and lock")}
                    </button>
                    <button type="button" className={buttonClass("ghost")} disabled={busy || !live} onClick={() => onAskReject?.(review.id)}>
                      {t("驳回并释放", "Reject and release")}
                    </button>
                  </>
                )}
              </div>
              {!live && <p className={styles.hint}>{t("合成样本：操作已停用。", "Synthetic sample: actions are disabled.")}</p>}
            </>
          ) : review.status === "confirmed" ? (
            <>
              <p className={styles.hint}>{t("已通过，座位已锁定。可撤销单个座位或整份申请。", "Approved and locked. You can revoke single seats or the whole request.")}</p>
              <details className={work.disclosure}>
                <summary>{t("撤销单个座位", "Revoke a single seat")}</summary>
                <p className={styles.hint}>{t("选择需要释放的座位。", "Choose the seat to release.")}</p>
                <div className={work.actions}>
                  {review.seats.map(seat => <button type="button" key={seat} className={buttonClass("ghost", "small")}
                    disabled={busy || !onReleaseSeat} onClick={() => onAskSeat?.(review.id, seat)}>{t(`撤销 ${seatLabel(seat)}`, `Revoke ${seatName(seat, locale)}`)}</button>)}
                </div>
                {confirmingSeat && review.seats.includes(confirmingSeat) && (
                  <div className={work.actions}>
                    <p className={styles.hint}>{review.seats.length === 1 ? t("这是最后一个座位，撤销后整份申请将变为已撤销。", "This is the last seat. Revoking it revokes the whole request.") : t("该座位将释放，其余座位继续保持已确认。", "This seat will be released; the other seats stay confirmed.")}</p>
                    <button type="button" className={buttonClass("danger", "small")} disabled={busy || !onReleaseSeat}
                      onClick={() => onReleaseSeat?.(review.id, confirmingSeat)}>{t(`确认撤销 ${seatLabel(confirmingSeat)}`, `Confirm revoking ${seatName(confirmingSeat, locale)}`)}</button>
                    <button type="button" className={buttonClass("ghost", "small")} disabled={busy} onClick={onCancelSeat}>{t("返回", "Back")}</button>
                  </div>
                )}
              </details>
              <div className={work.actions}>
                {confirming ? (
                  <>
                    <button type="button" className={buttonClass("danger")} disabled={busy || !onRevoke} onClick={() => onRevoke?.(review.id)}>{t("确认撤销并释放", "Confirm revoke and release")}</button>
                    <button type="button" className={buttonClass("ghost")} disabled={busy} onClick={onCancelReject}>{t("返回", "Back")}</button>
                  </>
                ) : <button type="button" className={buttonClass("ghost")} disabled={busy || !onRevoke} onClick={() => onAskReject?.(review.id)}>{t("撤销确认", "Revoke confirmation")}</button>}
              </div>
            </>
          ) : (
            <p className={styles.hint}>{review.status === "cancelled" ? t("申请人已取消，座位已释放。", "Cancelled by the applicant. Seats released.") : review.status === "revoked" ? t("管理员已撤销确认，座位已释放。", "Revoked by an admin. Seats released.") : t("已驳回，座位已释放。", "Rejected. Seats released.")}</p>
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
  const t = useT(),
    locale = useLocale();
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
  const [assignment, setAssignment] = useState<SeatAssignment>();
  const [addOrigin, setAddOrigin] = useState<"map" | "list">("list");
  const [assignmentMode, setAssignmentMode] = useState<"add" | "change">("add");
  const [adding, setAdding] = useState<string[]>([]);
  const [inspected, setInspected] = useState<{ seat: string; request: SeatReview | null }>();
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const lock = useRef(false);
  const ticket = useRef(0);
  const alive = useRef(true);
  const inspection = useRef<HTMLElement>(null);
  const addition = useRef<HTMLElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (inspected) inspection.current?.scrollIntoView({ block: "nearest" });
  }, [inspected]);

  useEffect(() => {
    if (assignment) addition.current?.scrollIntoView({ block: "nearest" });
  }, [assignment]);

  const load = useCallback(
    async (next: View, signal?: AbortSignal) => {
      const current = ++ticket.current;
      const query = new URLSearchParams({ mode: "review", status: next.status, page: String(next.page) });
      const [records, seats] = await Promise.all([
        seatRequest<SeatingWorkbench>(`${endpoint}?${query}`, { signal }),
        // The occupancy overview is a convenience; the review list must not fail with it.
        seatRequest<SeatingState>(`${endpoint}?mode=review-map`, { signal }).catch(() => undefined),
      ]);
      if (!alive.current || signal?.aborted || current !== ticket.current) return;
      setData(records);
      setLayout(seats);
      setSelected([]);
      setAssignment(undefined);
      setAdding([]);
      setInspected(undefined);
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
      setAssignment(undefined);
      setAdding([]);
      setInspected(undefined);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(view, controller.signal)
      .catch((cause) => {
        if (controller.signal.aborted || !alive.current) return;
        forget(cause, true);
        setError(cause instanceof Error ? cause.message : t("选座申请读取失败", "Failed to load seat requests."));
      })
      .finally(() => {
        if (!controller.signal.aborted && alive.current) setLoading(false);
      });
    return () => controller.abort();
  }, [forget, load, view, t]);

  function show(status: SeatStatus, page: number) {
    if (lock.current) return;
    setConfirming(null);
    setConfirmingSeat(null);
    setAssignment(undefined);
    setAdding([]);
    setInspected(undefined);
    setError("");
    setNotice("");
    setLoading(true);
    setView({ status, page });
  }

  async function act(label: string, task: () => Promise<string>, seatToRefresh?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const message = await task();
      if (alive.current) setNotice(message);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : t("操作失败，请重试", "The action failed. Please try again."));
    } finally {
      if (alive.current) await load(view).catch((cause) => forget(cause, false));
      if (alive.current && seatToRefresh) {
        try {
          const result = await seatRequest<{ seat: string; request: SeatReview | null }>(`${endpoint}?mode=seat-review&seat=${encodeURIComponent(seatToRefresh)}`);
          if (alive.current) setInspected(result);
        } catch (cause) {
          forget(cause, false);
          if (alive.current) setError(cause instanceof Error ? cause.message : t("座位申请读取失败，请重试", "Failed to load the seat's request. Please try again."));
        }
      }
      lock.current = false;
      if (alive.current) {
        setBusy("");
        setConfirming(null);
        setConfirmingSeat(null);
        setAssignment(undefined);
        setAdding([]);
      }
    }
  }

  function setEnabled(enabled: boolean) {
    void act(enabled ? t("正在开启选座", "Opening seat selection") : t("正在关闭选座", "Closing seat selection"), async () => {
      await seatRequest(endpoint, seatJSON("PUT", { enabled }));
      setOpeningTime(null);
      return enabled ? t("选座已开启，成员可以提交申请。", "Seat selection is open. Members can submit requests.") : t("选座已关闭：已有申请仍可审核。", "Seat selection is closed. Existing requests can still be reviewed.");
    });
  }

  function setMode(mode: SeatingMode) {
    void act(t("正在切换座位模式", "Switching seating mode"), async () => {
      await seatRequest(endpoint, seatJSON("PUT", { mode }));
      return mode === "random" ? t("已切换为随机座位模式。", "Switched to random seating.") : t("已切换为自主选座模式。", "Switched to self-selected seating.");
    });
  }

  function randomCount(record: SeatReview, count: number) {
    if (record.status !== "pending" || record.allocationMode !== "random" || record.seats.length) return;
    void act(t("正在调整申请数量", "Changing requested seats"), async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "random-count", id: record.id, revision: record.revision, count }));
      return t("申请数量已更新，请重新核对后审核。", "Requested seats updated. Check again before reviewing.");
    });
  }

  function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const opensAt = openingTime ?? beijingInputTime(data?.opensAt);
    void act(t("正在保存开放时间", "Saving opening time"), async () => {
      await seatRequest(endpoint, seatJSON("PUT", { enabled: true, opensAt }));
      setOpeningTime(null);
      return t("已保存定时开放。", "Scheduled opening saved.");
    });
  }

  function decide(record: SeatReview, status: SeatDecision, seat?: string) {
    if (record.status !== "pending") return;
    void act(status === "confirmed" ? t("正在通过申请", "Approving request") : t("正在驳回申请", "Rejecting request"), async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "review", id: record.id, status, revision: record.revision,
        ...(record.allocationMode === "random" && !record.seats.length ? { expectedCount: record.requestedCount } : {}) }));
      return status === "confirmed" ? (record.allocationMode === "random" && !record.seats.length ? t("已通过并安排座位。", "Approved and seats assigned.") : t("已通过并锁定座位。", "Approved and seats locked.")) : t("已驳回并释放座位。", "Rejected and seats released.");
    }, seat);
  }

  function revoke(record: SeatReview, seat?: string) {
    if (record.status !== "confirmed") return;
    void act(t("正在撤销确认", "Revoking confirmation"), async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "revoke", id: record.id, revision: record.revision }));
      return t("已撤销确认，全部座位已释放。", "Confirmation revoked. All seats released.");
    }, seat);
  }

  function releaseSeat(record: SeatReview, seat: string, inspectedSeat?: string) {
    if (record.status !== "confirmed" || !record.seats.includes(seat)) return;
    void act(t("正在撤销座位", "Revoking seat"), async () => {
      const result = await seatRequest<{ fullyRevoked: boolean }>(endpoint, seatJSON("POST", { action: "revoke-seat", id: record.id, revision: record.revision, seat }));
      return result.fullyRevoked ? t(`已撤销 ${seatLabel(seat)}，申请已全部撤销。`, `Revoked ${seatName(seat, locale)}. The whole request is now revoked.`) : t(`已撤销 ${seatLabel(seat)}，其余座位保持已确认。`, `Revoked ${seatName(seat, locale)}. The other seats stay confirmed.`);
    }, inspectedSeat);
  }

  async function startAssignment(request: number, origin: "map" | "list", mode: "add" | "change") {
    if (lock.current) return;
    lock.current = true;
    setBusy(t("正在读取可选座位", "Loading available seats"));
    setError("");
    setNotice("");
    setAssignment(undefined);
    setAddOrigin(origin);
    setAssignmentMode(mode);
    setAdding([]);
    setConfirming(null);
    setConfirmingSeat(null);
    try {
      const result = await seatRequest<SeatAssignment>(`${endpoint}?mode=assignment&request=${request}`);
      if (alive.current) {
        setAssignment(result);
        setAdding(mode === "change" ? result.request.seats.slice() : []);
      }
    } catch (cause) {
      forget(cause, false);
      if (alive.current) setError(cause instanceof Error ? cause.message : t("座位读取失败，请重试", "Failed to load seats. Please try again."));
    } finally {
      lock.current = false;
      if (alive.current) setBusy("");
    }
  }

  async function inspectSeat(seat: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(t("正在读取座位申请", "Loading the seat's request"));
    setInspected(undefined);
    setAssignment(undefined);
    setAdding([]);
    setConfirming(null);
    setConfirmingSeat(null);
    setError("");
    setNotice("");
    try {
      const result = await seatRequest<{ seat: string; request: SeatReview | null }>(`${endpoint}?mode=seat-review&seat=${encodeURIComponent(seat)}`);
      if (alive.current) setInspected(result);
    } catch (cause) {
      forget(cause, false);
      if (alive.current) setError(cause instanceof Error ? cause.message : t("座位申请读取失败，请重试", "Failed to load the seat's request. Please try again."));
    } finally {
      lock.current = false;
      if (alive.current) setBusy("");
    }
  }

  function saveAssignment() {
    if (!assignment || !adding.length) return;
    const { id: request, revision, status } = assignment.request;
    const changing = assignmentMode === "change";
    if (changing && (adding.length !== assignment.request.seats.length || assignment.request.seats.every(seat => adding.includes(seat)))) return;
    const refreshSeat = addOrigin === "map" ? (changing && inspected && !adding.includes(inspected.seat) ? adding[0] : inspected?.seat) : undefined;
    void act(changing ? t("正在更换座位", "Changing seats") : t("正在增加座位", "Adding seats"), async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: changing ? "change-seats" : "add-seats", id: request, revision, status, seats: adding }));
      return changing ? t(`已为申请 #${request} 更换座位。`, `Seats changed for request #${request}.`) : t(`已为申请 #${request} 增加 ${adding.length} 个座位。`, `Added ${adding.length} seats to request #${request}.`);
    }, refreshSeat);
  }

  function setBlocks(blocked: boolean) {
    if (!layout) return;
    const blockedSeats = new Set(layout.blockedSeats || []);
    const seats = selected.filter(seat => blockedSeats.has(seat) === !blocked);
    if (!seats.length) return;
    void act(blocked ? t("正在锁定座位", "Locking seats") : t("正在解锁座位", "Unlocking seats"), async () => {
      await seatRequest(endpoint, seatJSON("POST", { action: "block", seats, blocked }));
      return t(`已${blocked ? "锁定" : "解锁"} ${seats.length} 个座位。`, `${blocked ? "Locked" : "Unlocked"} ${seats.length} seats.`);
    });
  }

  const counts = layout ? seatCounts(layout) : null;
  const disabled = loading || Boolean(busy);
  const lockedSelection = selected.filter(seat => layout?.blockedSeats?.includes(seat)).length;
  const availableSelection = selected.length - lockedSelection;

  function additionPanel(review: SeatReview, origin: "map" | "list") {
    if (!assignment || assignment.request.id !== review.id || addOrigin !== origin) return null;
    const changing = assignmentMode === "change";
    const limit = changing ? assignment.request.seats.length : assignment.seatLimit - assignment.request.seats.length;
    const unchanged = changing && assignment.request.seats.every(seat => adding.includes(seat));
    return (
      <section ref={addition} className={styles.control} aria-label={t(`为申请 ${review.id} ${changing ? "更换" : "增加"}座位`, `${changing ? "Change" : "Add"} seats for request ${review.id}`)}>
        <div className={styles.controlText}>
          <h3>{t(`为 ${review.memberName} 的申请 #${review.id} ${changing ? "更换" : "增加"}座位`, `${changing ? "Change" : "Add"} seats for ${review.memberName}'s request #${review.id}`)}</h3>
          <p>{changing ? t(`先取消要换出的座位，再选择新座位，保留 ${limit} 个座位。`, `Deselect the seats to swap out, then pick new ones, keeping ${limit} seats. `) : t(`已有 ${assignment.request.seats.length} 个座位，最多还可增加 ${limit} 个。`, `${assignment.request.seats.length} seats held; up to ${limit} more can be added. `)}{t(`申请状态保持${seatStatusLabels[assignment.request.status]}。`, `The request stays ${seatStatusName(assignment.request.status, locale).toLowerCase()}.`)}</p>
          <div className={styles.mapBlock}>
            <div className={styles.mapTools}><SeatLegend showAccent={assignment.rows.some(row => row.accent)} /><SeatZoom zoom={zoom} onChange={setZoom} /></div>
            <SeatMap state={assignment} selected={adding} editable={!disabled} zoom={zoom} own={changing ? assignment.request.seats : []} label={changing ? t("选择更换后的座位", "Choose the new seats") : t("选择要增加的座位", "Choose seats to add")} toggle={seat => {
              setAdding(current => current.includes(seat) ? current.filter(value => value !== seat) : current.length < limit ? [...current, seat] : current);
            }} />
          </div>
          <SeatSelection selected={adding} limit={limit} disabled={disabled} onRemove={seat => setAdding(current => current.filter(value => value !== seat))} />
          <div className={work.actions}>
            <button type="button" className={buttonClass("primary")} disabled={disabled || !adding.length || (changing && (adding.length !== limit || unchanged))} onClick={saveAssignment}>{changing ? t("确认更换座位", "Confirm seat change") : t("确认增加座位", "Confirm added seats")}</button>
            <button type="button" className={buttonClass("ghost")} disabled={disabled} onClick={() => { setAssignment(undefined); setAdding([]); }}>{t("取消", "Cancel")}</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.workbench} aria-busy={disabled}>
      {data && (
        <section className={styles.control} aria-label={t("选座设置", "Seating settings")}>
          <div className={styles.controlText}>
            <p>
              <StatusPill tone={data.open ? "live" : "neutral"}>{data.scheduled ? t("等待开放", "Opening soon") : data.open ? t("选座开放中", "Open") : data.enabled ? t("选座已关闭", "Closed") : t("选座未开启", "Not enabled")}</StatusPill>
            </p>
            <p>
              {data.scheduled
                ? t("开放时间到达后，成员可以在活动页选座并提交凭证。", "Once it opens, members can pick seats and submit proof on the activity page.")
                : data.enabled
                ? t("成员可以在活动页选座并提交凭证。关闭后不再接收新申请，已提交的申请仍在此审核。", "Members can pick seats and submit proof on the activity page. Closing stops new requests; submitted ones are still reviewed here.")
                : t("开启后成员可在活动页选择 1–10 个座位并提交手机号与凭证；未公开的活动不能开启。", "Once open, members can pick 1–10 seats on the activity page and submit a phone number and proof. Unpublished activities cannot open seating.")}
            </p>
            {data.scheduled && <p>{t(`将于北京时间 ${formatDateTime(data.opensAt)} 开放选座。`, `Seat selection opens ${formatDateTime(data.opensAt, locale)} (Beijing time).`)}</p>}
            <p>{t(`当前模式：${data.mode === "random" ? "随机安排" : "自主选座"}。已确认的座位及已有申请保持不变。`, `Current mode: ${data.mode === "random" ? "random assignment" : "self-selected"}. Confirmed seats and existing requests stay unchanged.`)}</p>
            <div className={work.actions} role="group" aria-label={t("座位模式", "Seating mode")}>
              <button type="button" className={buttonClass(data.mode === "selection" ? "primary" : "ghost", "small")} disabled={disabled || data.mode === "selection"} onClick={() => setMode("selection")}>{t("自主选座", "Self-selected")}</button>
              <button type="button" className={buttonClass(data.mode === "random" ? "primary" : "ghost", "small")} disabled={disabled || data.mode === "random"} onClick={() => setMode("random")}>{t("随机座位", "Random seats")}</button>
            </div>
            {data.enabled && layout && !layout.open && !data.scheduled && <p>{t("活动已结束、取消或暂未公开，成员端当前不能提交新申请。", "The activity has ended, been cancelled or is not public, so members cannot submit new requests.")}</p>}
            <form className={styles.schedule} onSubmit={schedule}>
              <label className={styles.field}>{t("定时开放（北京时间）", "Scheduled opening (Beijing time)")}
                <input type="datetime-local" value={openingTime ?? beijingInputTime(data.opensAt)} required disabled={disabled} onChange={event => setOpeningTime(event.currentTarget.value)} />
              </label>
              <button type="submit" className={buttonClass("primary")} disabled={disabled}>{t("保存开放时间", "Save opening time")}</button>
            </form>
          </div>
          <div className={work.actions}>
            {(!data.enabled || data.scheduled) && <button type="button" className={buttonClass("primary")} disabled={disabled} onClick={() => setEnabled(true)}>{data.scheduled ? t("立即开放", "Open now") : t("开启选座", "Open seat selection")}</button>}
            {data.enabled && <button type="button" className={buttonClass("ghost")} disabled={disabled} onClick={() => setEnabled(false)}>{t("关闭选座", "Close seat selection")}</button>}
          </div>
        </section>
      )}

      {data && <SeatLayoutEditor endpoint={endpoint} disabled={disabled} onSaved={() => { void load(view).catch(cause => forget(cause, false)); }} />}
      {data && <SeatTicketManager endpoint={endpoint} disabled={disabled} />}

      {counts && (
        <ul className={work.stats} aria-label={t("座位概况", "Seat overview")}>
          <li data-hot={counts.pending > 0 || undefined}>
            <strong>{counts.pending}</strong>
            <span>{t("待审核占用", "Held, pending review")}</span>
          </li>
          <li>
            <strong>{counts.confirmed}</strong>
            <span>{t("已确认锁定", "Confirmed, locked")}</span>
          </li>
          <li>
            <strong>{counts.blocked}</strong>
            <span>{t("未开放", "Closed")}</span>
          </li>
          <li>
            <strong>{counts.free}</strong>
            <span>{t(`剩余可选 / ${counts.total}`, `Available / ${counts.total}`)}</span>
          </li>
        </ul>
      )}

      {layout && (
        <details className={`${work.disclosure} ${styles.overview}`} open>
          <summary>{t("管理座位和查看申请", "Manage seats and view requests")}</summary>
          <p className={styles.blockHint}>{t("点击待审核或已确认的座位查看申请；点选空座锁定，或点选未开放的座位解锁。", "Click a pending or confirmed seat to view its request. Select empty seats to lock them, or closed seats to unlock them.")}</p>
          <div className={styles.mapBlock}>
            <div className={styles.mapTools}>
              <SeatLegend showAccent={layout.rows.some(row => row.accent)} />
              <SeatZoom zoom={zoom} onChange={setZoom} />
            </div>
            <SeatMap state={layout} selected={selected} editable={!disabled} manage zoom={zoom} label={t("管理座位和查看申请", "Manage seats and view requests")} onInspect={inspectSeat} toggle={seat => setSelected(current => current.includes(seat) ? current.filter(value => value !== seat) : [...current, seat])} />
          </div>
          <div className={styles.blockControls}>
            <span className={styles.blockHint}>{t(`已选 ${availableSelection} 个空座、${lockedSelection} 个未开放座位`, `Selected ${availableSelection} empty and ${lockedSelection} closed seats`)}</span>
            <button type="button" className={buttonClass("primary", "small")} disabled={disabled || !availableSelection} onClick={() => setBlocks(true)}>{t("锁定所选空座", "Lock selected empty seats")}</button>
            <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || !lockedSelection} onClick={() => setBlocks(false)}>{t("解锁所选座位", "Unlock selected seats")}</button>
            <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || !selected.length} onClick={() => setSelected([])}>{t("清除选择", "Clear selection")}</button>
          </div>
          {inspected && (
            <section ref={inspection} aria-label={t(`${seatLabel(inspected.seat)}的申请`, `Request for ${seatName(inspected.seat, locale)}`)}>
              <div className={work.actions}>
                <h3>{t(`${seatLabel(inspected.seat)}的申请`, `Request for ${seatName(inspected.seat, locale)}`)}</h3>
                <button type="button" className={buttonClass("ghost", "small")} disabled={disabled} onClick={() => { setInspected(undefined); setAssignment(undefined); setAdding([]); setConfirming(null); setConfirmingSeat(null); }}>{t("关闭", "Close")}</button>
              </div>
              {inspected.request ? <>
                <SeatReviewCard review={inspected.request} mapCard proofHref={proof => `${endpoint}/proofs/${encodeURIComponent(proof)}`}
                  busy={disabled} confirming={confirming === inspected.request.id}
                  onDecide={(_request, status) => decide(inspected.request!, status, inspected.seat)}
                  onRevoke={() => revoke(inspected.request!, inspected.seat)}
                  confirmingSeat={confirmingSeat?.id === inspected.request.id ? confirmingSeat.seat : undefined}
                  onAskSeat={(request, seat) => { setConfirming(null); setConfirmingSeat({ id: request, seat }); }}
                  onCancelSeat={() => setConfirmingSeat(null)}
                  onReleaseSeat={(_request, seat) => releaseSeat(inspected.request!, seat, inspected.seat)}
                  onAskReject={request => { setConfirmingSeat(null); setConfirming(request); }}
                  onCancelReject={() => setConfirming(null)}
                  onAdd={request => { void startAssignment(request, "map", "add"); }}
                  onChangeSeats={request => { void startAssignment(request, "map", "change"); }} />
                {additionPanel(inspected.request, "map")}
              </> : <p className={styles.hint}>{t("该座位当前没有申请，请刷新座位图。", "This seat has no request now. Refresh the seat map.")}</p>}
            </section>
          )}
        </details>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label={t("按审核状态筛选", "Filter by review status")}>
          {seatStatusOrder.map((value) => (
            <button type="button" key={value} className={styles.filter} aria-pressed={value === view.status} disabled={disabled} onClick={() => show(value, 1)}>
              {seatStatusName(value, locale)}
            </button>
          ))}
        </div>
        <button type="button" className={buttonClass("ghost", "small")} disabled={disabled} onClick={() => show(view.status, view.page)}>
          {t("刷新", "Refresh")}
        </button>
      </div>

      {(loading || busy) && (
        <p className={styles.status} role="status">
          {busy ? `${busy}…` : t("正在读取申请…", "Loading requests…")}
        </p>
      )}
      {notice && (
        <p className={styles.status} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {localizeSeatError(error, locale)}
        </p>
      )}

      {data && !loading && (
        <>
          {data.docs.length ? (
            <div className={work.records}>
              {data.docs.map((review) => (
                <Fragment key={review.id}>
                <SeatReviewCard
                  review={review}
                  proofHref={(proof) => `${endpoint}/proofs/${encodeURIComponent(proof)}`}
                  busy={Boolean(busy)}
                  confirming={confirming === review.id}
                  onDecide={(_request, status) => decide(review, status)}
                  onRevoke={() => revoke(review)}
                  confirmingSeat={confirmingSeat?.id === review.id ? confirmingSeat.seat : undefined}
                  onAskSeat={(request, seat) => { setConfirming(null); setConfirmingSeat({ id: request, seat }); }}
                  onCancelSeat={() => setConfirmingSeat(null)}
                  onReleaseSeat={(_request, seat) => releaseSeat(review, seat)}
                  onAskReject={request => { setConfirmingSeat(null); setConfirming(request); }}
                  onCancelReject={() => setConfirming(null)}
                  onAdd={request => { void startAssignment(request, "list", "add"); }}
                  onChangeSeats={request => { void startAssignment(request, "list", "change"); }}
                  onRandomCount={(_request, count) => randomCount(review, count)}
                />
                {additionPanel(review, "list")}
                </Fragment>
              ))}
            </div>
          ) : (
            <EmptyState compact icon="check" title={t(`此页没有${seatStatusLabels[view.status]}的选座申请`, `No ${seatStatusName(view.status, locale).toLowerCase()} seat requests on this page`)}>
              {view.status === "pending" ? t("新的选座申请提交后会出现在这里。", "New seat requests will appear here.") : t("切换上方状态可查看其他申请。", "Switch status above to see other requests.")}
            </EmptyState>
          )}
          {(view.page > 1 || data.hasNextPage) && (
            <nav className={styles.pagination} aria-label={t("选座申请分页", "Seat request pages")}>
              <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || view.page <= 1} onClick={() => show(view.status, view.page - 1)}>
                {t("上一页", "Previous")}
              </button>
              <span>{t(`第 ${view.page} 页`, `Page ${view.page}`)}</span>
              <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || !data.hasNextPage} onClick={() => show(view.status, view.page + 1)}>
                {t("下一页", "Next")}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
