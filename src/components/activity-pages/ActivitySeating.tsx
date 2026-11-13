"use client";

import Link from "next/link";
import { formatDateTime } from "@/components/v2/format";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import {
  seatAPI,
  seatLabel,
  seatPhonePattern,
  seatStatusLabels,
  type SeatRequest,
  type SeatingKind,
  type SeatingState,
} from "@/lib/activity-seating-model";
import { buttonClass } from "@/components/v2/ui";
import { SeatRequestError, localizeSeatError, seatJSON, seatRequest } from "./seat-request";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locale";
import styles from "./ActivitySeating.module.css";

export type SeatVisual = "available" | "selected" | "pending" | "confirmed" | "blocked";
export const seatLegend: readonly (readonly [SeatVisual, string])[] = [
  ["available", "可选"], // i18n-exempt: paired with seatLegendEn
  ["selected", "已选"], // i18n-exempt: paired with seatLegendEn
  ["pending", "待审核"], // i18n-exempt: paired with seatLegendEn
  ["confirmed", "已确认"], // i18n-exempt: paired with seatLegendEn
  ["blocked", "未开放"], // i18n-exempt: paired with seatLegendEn
];
const seatLegendEn: Record<SeatVisual, string> = { available: "Available", selected: "Selected", pending: "Pending review", confirmed: "Confirmed", blocked: "Closed" };
const seatStatusEn: Record<SeatRequest["status"], string> = { pending: "Pending review", confirmed: "Confirmed", rejected: "Rejected", cancelled: "Cancelled", revoked: "Revoked" };

/** Seat name in the interface language ("1排1座" / "Row 1 Seat 1"); stored keys stay "row-number". */
export function seatName(seat: string, locale: Locale) {
  if (locale !== "en") return seatLabel(seat);
  const [row, number] = seat.split("-");
  return `Row ${row} Seat ${number}`;
}
export function seatStatusName(status: SeatRequest["status"], locale: Locale) {
  return locale === "en" ? seatStatusEn[status] ?? seatStatusLabels[status] : seatStatusLabels[status];
}
export function seatVisualName(value: SeatVisual, locale: Locale) {
  return locale === "en" ? seatLegendEn[value] : seatLegend.find(([key]) => key === value)?.[1];
}
/** Seat sizes (px) for the three zoom steps. Even the compact step keeps a 24px target pitch. */
export const seatZooms = [20, 26, 34] as const;
export const seatGap = 4;
const zoomNames = ["紧凑", "标准", "放大"]; // i18n-exempt: paired with zoomNamesEn
const zoomNamesEn = ["Compact", "Standard", "Large"];
const proofTypes = ["image/jpeg", "image/png", "image/webp"];
type SeatLayout = Pick<SeatingState, "rows" | "occupancy"> & Partial<Pick<SeatingState, "blockedSeats" | "missingSeats">>;

/** Widest zoom whose whole board fits `width`; narrow screens keep the touch-friendly standard step and scroll. */
export function fittedZoom(rows: SeatLayout["rows"], width: number) {
  const columns = Math.max(...rows.map((row) => row.offset + row.count));
  for (let index = seatZooms.length - 1; index >= 0; index -= 1) if (48 + columns * (seatZooms[index] + seatGap) <= width) return index;
  return 1;
}

/** Legend and centre-zone key, shared by the member map, the workbench and the visual specimen. */
export function SeatLegend({ showAccent = true }: { showAccent?: boolean }) {
  const t = useT(),
    locale = useLocale();
  return (
    <ul className={styles.legend} aria-label={t("座位状态图例", "Seat status legend")}>
      {seatLegend.map(([value]) => (
        <li key={value}>
          <span className={styles.swatch} data-state={value} aria-hidden="true" />
          {seatVisualName(value, locale)}
        </li>
      ))}
      {showAccent && <li>
        <span className={styles.swatch} data-state="available" data-accent="true" aria-hidden="true" />
        {t("中心区 8–10 排", "Centre zone, rows 8–10")}
      </li>}
    </ul>
  );
}

/** Zoom stepper for the seat map; the map itself scrolls inside its own box. */
export function SeatZoom({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  const t = useT(),
    names = useLocale() === "en" ? zoomNamesEn : zoomNames;
  return (
    <div className={styles.zoom} role="group" aria-label={t("座位图缩放", "Seat map zoom")}>
      <button type="button" onClick={() => onChange(Math.max(0, zoom - 1))} disabled={zoom <= 0} aria-label={t("缩小座位图", "Zoom out")}>
        −
      </button>
      <span aria-live="polite">{names[zoom] ?? names[1]}</span>
      <button type="button" onClick={() => onChange(Math.min(seatZooms.length - 1, zoom + 1))} disabled={zoom >= seatZooms.length - 1} aria-label={t("放大座位图", "Zoom in")}>
        +
      </button>
    </div>
  );
}

/**
 * The seat map. Layout and occupancy come from the server, selection from the caller.
 * One seat is in the tab order (roving tabindex); arrow keys move between enabled seats,
 * Space/Enter toggles selectable seats; reviewers can inspect occupied seats.
 */
export function SeatMap({
  state,
  selected,
  editable,
  toggle,
  zoom = 1,
  label,
  manage = false,
  own = [],
  onInspect,
}: {
  state: SeatLayout;
  selected: readonly string[];
  editable: boolean;
  toggle?: (seat: string) => void;
  zoom?: number;
  label?: string;
  manage?: boolean;
  own?: readonly string[];
  onInspect?: (seat: string) => void;
}) {
  const t = useT(),
    locale = useLocale();
  const [focused, setFocused] = useState("");
  const missing = new Set(state.missingSeats || []);
  const keys = state.rows.flatMap(({ row, count }) => Array.from({ length: count }, (_, index) => `${row}-${index + 1}`)).filter(seat => !missing.has(seat));
  const blocked = new Set(state.blockedSeats || []);
  const inspectable = (seat: string) => Boolean(onInspect && state.occupancy[seat] && !blocked.has(seat) && !own.includes(seat));
  const selectable = (seat: string) => !state.occupancy[seat] || (manage && blocked.has(seat)) || own.includes(seat) || inspectable(seat);
  const first = focused && keys.includes(focused) && selectable(focused) ? focused : keys.find(selectable);

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || !(event.target instanceof HTMLButtonElement)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-seat]:enabled"));
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      buttons[index + direction]?.focus();
      return;
    }
    const row = Number(event.target.dataset.row),
      column = Number(event.target.dataset.column);
    const next = buttons.filter((button) => direction * (Number(button.dataset.row) - row) > 0);
    next.sort(
      (a, b) =>
        direction * (Number(a.dataset.row) - Number(b.dataset.row)) ||
        Math.abs(Number(a.dataset.column) - column) - Math.abs(Number(b.dataset.column) - column),
    );
    next[0]?.focus();
  }

  return (
    <div
      className={styles.viewport}
      role="group"
      aria-label={label ?? t("座位图", "Seat map")}
      onKeyDown={moveFocus}
      // Give keyboard users a scroll target when no seat can receive focus.
      tabIndex={!editable || !first ? 0 : undefined}
      style={{ "--seat-size": `${seatZooms[zoom] ?? seatZooms[1]}px`, "--seat-gap": `${seatGap}px` } as CSSProperties}
    >
      <div className={styles.board}>
        <div className={styles.stage} aria-hidden="true">
          <span className={styles.stageArc} />
          <span className={styles.stageLabel}>{t("舞台 · 屏幕", "Stage · Screen")}</span>
        </div>
        {state.rows.map((row) => {
          const accent = "accent" in row && row.accent;
          return (
            <div className={styles.row} key={row.row} data-accent={accent ? "true" : undefined}>
              <span className={styles.rowNumber} aria-hidden="true">
                {row.row}
              </span>
              <div className={styles.rowSeats} style={{ "--offset": row.offset } as CSSProperties}>
                {Array.from({ length: row.count }, (_, index) => {
                  const seat = `${row.row}-${index + 1}`;
                  if (missing.has(seat)) return <span key={seat} className={styles.seatGap} aria-hidden="true" />;
                  const taken = state.occupancy[seat];
                  const picked = selected.includes(seat);
                  const value: SeatVisual = blocked.has(seat) ? "blocked" : own.includes(seat) && picked ? "selected" : taken || (picked ? "selected" : "available");
                  return (
                    <button
                      type="button"
                      key={seat}
                      data-seat={seat}
                      data-state={value}
                      data-picked={picked ? "true" : undefined}
                      data-row={row.row}
                      data-column={row.offset + index}
                      className={styles.seat}
                      disabled={!editable || !selectable(seat)}
                      tabIndex={seat === first ? 0 : -1}
                      aria-pressed={selectable(seat) && !inspectable(seat) ? picked : undefined}
                      aria-label={[seatName(seat, locale), accent && t("中心区", "Centre zone"), seatVisualName(value, locale), picked && value === "blocked" && t("已选", "Selected"), inspectable(seat) && t("查看申请", "View request")].filter(Boolean).join(" · ")}
                      title={seatName(seat, locale)}
                      onFocus={() => setFocused(seat)}
                      onClick={() => inspectable(seat) ? onInspect?.(seat) : toggle?.(seat)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Selection summary: count against the limit and removable seat chips. */
export function SeatSelection({
  selected,
  limit,
  onRemove,
  disabled = false,
}: {
  selected: readonly string[];
  limit: number;
  onRemove?: (seat: string) => void;
  disabled?: boolean;
}) {
  const t = useT(),
    locale = useLocale();
  return (
    <div className={styles.selection} aria-live="polite">
      <p className={styles.selectionCount}>
        <strong>{selected.length}</strong>
        <span>{t(`/ ${limit} 个座位`, `/ ${limit} seats`)}</span>
      </p>
      {selected.length ? (
        <ul className={styles.chips} aria-label={t("已选座位", "Selected seats")}>
          {selected.map((seat) => (
            <li key={seat}>
              {onRemove ? (
                <button type="button" className={styles.chip} disabled={disabled} onClick={() => onRemove(seat)} aria-label={t(`取消 ${seatLabel(seat)}`, `Remove ${seatName(seat, locale)}`)}>
                  {seatName(seat, locale)}
                  <span aria-hidden="true">×</span>
                </button>
              ) : (
                <span className={styles.chip}>{seatName(seat, locale)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>{t(`在座位图中点选 1–${limit} 个座位。`, `Pick 1–${limit} seats on the map.`)}</p>
      )}
    </div>
  );
}

/** The member's own request: seats and status only, never phone numbers or proofs. */
export function SeatReceipt({ mine, editable, endpoint, ticketImages = [] }: { mine: Pick<SeatRequest, "seats" | "status"> & Partial<Pick<SeatRequest, "requestedCount">>; editable: boolean; endpoint?: string; ticketImages?: SeatingState["ticketImages"] }) {
  const t = useT(),
    locale = useLocale();
  return (
    <div className={styles.receipt} data-status={mine.status}>
      <p className={styles.receiptHead}>
        <span className={styles.badge} data-status={mine.status}>
          {seatStatusName(mine.status, locale)}
        </span>
        <strong>{t("我的选座申请", "My seat request")}</strong>
      </p>
      <p className={styles.receiptSeats}>{mine.seats.length ? mine.seats.map((seat) => seatName(seat, locale)).join(t("、", ", ")) : t(`${mine.requestedCount ?? 0} 个座位`, `${mine.requestedCount ?? 0} seats`)}</p>
      {mine.status === "pending" && <p className={styles.hint}>{mine.seats.length ? t("座位已为你保留，等待管理员核对凭证后锁定。", "Your seats are held until an admin checks your proof and locks them.") : t("申请等待审核，通过后可查看座位。", "Your request is pending review. Seats appear once it is approved.")}</p>}
      {mine.status === "confirmed" && <p className={styles.hint}>{t("审核已通过，座位已锁定。", "Approved. Your seats are locked.")}</p>}
      {mine.status === "confirmed" && endpoint && <div className={styles.tickets}>
        <strong>{t("座位电子票据", "Seat e-tickets")}</strong>
        {mine.seats.map(seat => {
          const ticket = ticketImages.find(item => item.seat === seat);
          const href = ticket ? `${endpoint}/tickets/${encodeURIComponent(seat)}?v=${encodeURIComponent(ticket.version)}` : "";
          return <div className={styles.ticketCard} key={seat}>
            <strong>{seatName(seat, locale)}</strong>
            {ticket ? <>
              {/* Images are private, same-origin, and served only to the current seat owner or reviewer. */}
              <img src={href} alt={t(`${seatLabel(seat)}电子票据`, `${seatName(seat, locale)} e-ticket`)} loading="lazy" />
              <a href={href} download={t(`${seatLabel(seat)}电子票据.${ticket.extension}`, `${seatName(seat, locale)} e-ticket.${ticket.extension}`)}>{t("保存票据图片", "Save ticket image")}</a>
            </> : <p className={styles.hint}>{t("票据上传后将在这里显示。", "Your ticket will appear here once uploaded.")}</p>}
          </div>;
        })}
      </div>}
      {mine.status === "rejected" && (
        <p className={styles.hint}>{editable ? t("申请已驳回，座位已释放；可以重新选座并提交凭证。", "Request rejected and seats released. You can pick seats and submit proof again.") : t("申请已驳回，座位已释放。", "Request rejected and seats released.")}</p>
      )}
      {mine.status === "cancelled" && <p className={styles.hint}>{editable ? t("申请已取消，座位已释放；可以重新选座。", "Request cancelled and seats released. You can pick seats again.") : t("申请已取消，座位已释放。", "Request cancelled and seats released.")}</p>}
      {mine.status === "revoked" && <p className={styles.hint}>{editable ? t("管理员已撤销确认，座位已释放；可以重新选座。", "An admin revoked the confirmation and released the seats. You can pick seats again.") : t("管理员已撤销确认，座位已释放。", "An admin revoked the confirmation and released the seats.")}</p>}
    </div>
  );
}

/**
 * Member seat selection on the V2 event detail (club events and community events).
 * Renders nothing until the server reports seating enabled, an own request, or review
 * rights; every capability comes from the server state. Nothing is cached or stored.
 */
export function ActivitySeating({ kind, id, returnTo }: { kind: SeatingKind; id: number; returnTo: string }) {
  const t = useT(),
    locale = useLocale();
  const endpoint = seatAPI(kind, id);
  const [state, setState] = useState<SeatingState>();
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState("1");
  const [editing, setEditing] = useState(false);
  const [editProofs, setEditProofs] = useState<string[]>([]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(1);
  const lock = useRef(false);
  const alive = useRef(true);
  const fitted = useRef(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const editVersion = useRef<number | null>(null);
  const lastMode = useRef<SeatingState["mode"] | null>(null);
  const readTicket = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const ticket = ++readTicket.current;
      const fresh = await seatRequest<SeatingState>(endpoint, { signal });
      if (!alive.current || signal?.aborted || ticket !== readTicket.current) return;
      setState(fresh);
      setFailed(false);
      const changed = lastMode.current !== null && lastMode.current !== fresh.mode;
      lastMode.current = fresh.mode;
      if (changed) {
        setCount(String(fresh.mine?.requestedCount || 1));
        setSelected(editVersion.current !== null && fresh.mode === "selection" ? fresh.mine?.seats || [] : []);
        setNotice(t("座位模式已更新，请按当前模式填写申请。", "The seating mode changed. Fill in the request for the current mode."));
        return;
      }
      // Seats taken by someone else since the last read drop out of the local selection.
      setSelected((values) => values.filter((seat) => !fresh.occupancy[seat] ||
        (editVersion.current !== null && fresh.mine?.status === "pending" && fresh.mine.seats.includes(seat))));
    },
    [endpoint, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((cause) => {
      if (controller.signal.aborted || !alive.current) return;
      // 4xx: hidden activity or a viewer without access. Stay quiet; only outages offer a retry.
      if (cause instanceof SeatRequestError && cause.status >= 400 && cause.status < 500) return;
      setFailed(true);
    });
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!state?.scheduled || !state.opensAt) return;
    const controller = new AbortController();
    const delay = Math.min(2147483647, Math.max(0, Date.parse(state.opensAt) - state.serverTime) + 200);
    const timer = setTimeout(() => {
      void load(controller.signal).catch(cause => {
        if (!controller.signal.aborted && alive.current) setError(cause instanceof Error ? cause.message : t("选座信息读取失败", "Failed to load seating."));
      });
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [state?.scheduled, state?.opensAt, state?.serverTime, load]);

  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || lock.current) return;
      void load().catch(cause => {
        if (!alive.current || !(cause instanceof SeatRequestError) || (cause.status !== 401 && cause.status !== 403)) return;
        setState(current => current && { ...current, loggedIn: false, canReview: false, mine: null, mineDetails: null, drafts: [],
          ...(current.mode === "random" ? { occupancy: {}, blockedSeats: [] } : {}) });
        setEditing(false); setEditProofs([]); editVersion.current = null; setSelected([]); setPhone("");
      });
    }, 15000);
    return () => clearInterval(timer);
  }, [state, load]);

  // Pick the widest zoom that fits once the map first appears; members can still change it.
  useEffect(() => {
    if (fitted.current || !state || (!state.enabled && !editing) || !mapRef.current) return;
    fitted.current = true;
    setZoom(fittedZoom(state.rows, mapRef.current.clientWidth));
  }, [state, editing]);

  function retry() {
    if (lock.current) return;
    lock.current = true;
    setBusy(t("正在加载", "Loading"));
    load()
      .catch(() => {
        if (alive.current) setFailed(true);
      })
      .finally(() => {
        lock.current = false;
        if (alive.current) setBusy("");
      });
  }

  if (!state) {
    if (!failed) return null;
    return (
      <section className={styles.section} aria-labelledby="activity-seating-title" id="activity-seating">
        <h2 id="activity-seating-title" className={styles.quietTitle}>
          {t("活动选座", "Seat selection")}
        </h2>
        <p className={styles.error} role="alert">
          {t("选座信息暂时无法加载。", "Seating cannot be loaded right now.")}
        </p>
        <button type="button" className={buttonClass("ghost", "small")} onClick={retry} disabled={Boolean(busy)}>
          {busy ? t("正在加载…", "Loading…") : t("重新加载", "Reload")}
        </button>
      </section>
    );
  }
  if (!state.enabled && !state.canReview && !state.mine) return null;
  const activeEdit = editing && state.mine?.status === "pending" && state.mineDetails?.canEdit === true;
  const editable = Boolean(activeEdit || (state.open && state.loggedIn && (!state.mine || state.mine.status === "rejected" || state.mine.status === "cancelled" || state.mine.status === "revoked")));
  const visibleProofs = activeEdit ? editProofs : state.drafts;
  const total = state.rows.reduce((sum, row) => sum + row.count, 0) - (state.missingSeats?.length || 0);
  const randomMode = state.mode === "random";

  /** One action at a time; failures keep the form; errors and conflicts (409) refresh the map. */
  async function run(label: string, task: () => Promise<void>, reloadAfter = false) {
    if (lock.current) return;
    lock.current = true;
    readTicket.current++;
    setBusy(label);
    setError("");
    setNotice("");
    let reload = reloadAfter;
    try {
      await task();
    } catch (cause) {
      reload = true;
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : t("操作失败，请重试", "The action failed. Please try again."));
        if (cause instanceof SeatRequestError && cause.status === 409) setNotice(t("座位或凭证状态已变化，已为你刷新座位图。", "Seats or proofs changed. The seat map has been refreshed."));
      }
    } finally {
      if (reload && alive.current) await load().catch(forget);
      lock.current = false;
      if (alive.current) setBusy("");
    }
  }

  /** Session gone or rights revoked (401/403): drop own drafts, selection and phone; public occupancy may stay. */
  function forget(cause: unknown) {
    if (!alive.current || !(cause instanceof SeatRequestError) || (cause.status !== 401 && cause.status !== 403)) return;
    setState((current) => current && { ...current, loggedIn: false, canReview: false, mine: null, mineDetails: null, drafts: [],
      ...(current.mode === "random" ? { occupancy: {}, blockedSeats: [] } : {}) });
    setEditing(false);
    setConfirmCancel(false);
    setEditProofs([]);
    editVersion.current = null;
    setSelected([]);
    setPhone("");
  }

  function toggle(seat: string) {
    if (!state || lock.current || !editable || (state.occupancy[seat] && !(activeEdit && state.mine?.seats.includes(seat)))) return;
    setError("");
    if (selected.includes(seat)) setSelected(selected.filter((value) => value !== seat));
    else if (selected.length < state.seatLimit) setSelected([...selected, seat]);
    else setError(t(`每人最多选择 ${state.seatLimit} 个座位`, `Up to ${state.seatLimit} seats per person`));
  }

  function upload(files: File[]) {
    if (!state || !files.length || lock.current) return;
    if (files.length > state.proofLimit - visibleProofs.length) {
      setError(t(`最多上传 ${state.proofLimit} 张凭证，还可上传 ${Math.max(0, state.proofLimit - visibleProofs.length)} 张`, `Up to ${state.proofLimit} proofs; ${Math.max(0, state.proofLimit - visibleProofs.length)} more allowed`));
      return;
    }
    if (files.some((file) => !proofTypes.includes(file.type))) {
      setError(t("凭证仅支持 JPEG、PNG 或 WebP 图片", "Proofs must be JPEG, PNG or WebP images"));
      return;
    }
    if (files.some((file) => !file.size || file.size > state.proofBytes)) {
      setError(t(`单张凭证最多 ${state.proofBytes / 1024 / 1024} MB`, `Each proof can be up to ${state.proofBytes / 1024 / 1024} MB`));
      return;
    }
    void run(t("正在上传凭证", "Uploading proof"), async () => {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const saved = await seatRequest<{ id: string }>(`${endpoint}/proofs`, { method: "POST", body: form });
        if (!alive.current) return;
        setState((current) => current && { ...current, drafts: [...current.drafts, saved.id] });
        if (activeEdit) setEditProofs(current => [...current, saved.id]);
      }
    });
  }

  function remove(proof: string) {
    if (activeEdit && !state?.drafts.includes(proof)) {
      setEditProofs(current => current.filter(value => value !== proof));
      return;
    }
    void run(t("正在移除凭证", "Removing proof"), async () => {
      await seatRequest(`${endpoint}/proofs/${encodeURIComponent(proof)}`, { method: "DELETE" });
      if (alive.current) setState((current) => current && { ...current, drafts: current.drafts.filter((value) => value !== proof) });
      if (alive.current && activeEdit) setEditProofs(current => current.filter(value => value !== proof));
    });
  }

  function startEdit() {
    if (!state?.mine || !state.mineDetails?.canEdit) return;
    editVersion.current = state.mine.revision;
    setSelected([...state.mine.seats]);
    setCount(String(state.mine.requestedCount || state.mine.seats.length || 1));
    setPhone(state.mineDetails.phone);
    setEditProofs([...state.mineDetails.proofs, ...state.drafts]);
    setEditing(true);
    setError("");
    setNotice("");
  }

  function cancelEdit() {
    editVersion.current = null;
    setEditing(false);
    setEditProofs([]);
    setSelected([]);
    setPhone("");
    setError("");
  }

  function cancelRequest() {
    if (!state?.mine || state.mine.status !== "pending") return;
    const { id: requestID, revision } = state.mine;
    void run(t("正在取消申请", "Cancelling request"), async () => {
      const { mine } = await seatRequest<{ mine: SeatRequest }>(endpoint, seatJSON("DELETE", { id: requestID, revision }));
      if (!alive.current) return;
      setState(current => current && { ...current, mine, mineDetails: null, drafts: [] });
      editVersion.current = null;
      setEditing(false);
      setEditProofs([]);
      setConfirmCancel(false);
      setSelected([]);
      setPhone("");
      setNotice(t("申请已取消，全部座位已释放。", "Request cancelled. All seats released."));
    }, true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state || lock.current) return;
    const normalized = phone.trim().replace(/[\s-]/g, "");
    const requestedCount = Number(count);
    if (randomMode && (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > state.seatLimit)) return setError(t(`请输入 1 至 ${state.seatLimit} 个座位`, `Enter 1 to ${state.seatLimit} seats`));
    if (!randomMode && !selected.length) return setError(t("请先在座位图中选择座位", "Pick seats on the map first"));
    if (!seatPhonePattern.test(normalized)) return setError(t("请填写有效的手机号", "Enter a valid phone number"));
    if (!visibleProofs.length || visibleProofs.length > state.proofLimit) return setError(t(`请选择 1 至 ${state.proofLimit} 张活动参与凭证`, `Choose 1 to ${state.proofLimit} participation proofs`));
    void run(
      activeEdit ? t("正在保存修改", "Saving changes") : t("正在提交选座", "Submitting seat request"),
      async () => {
        const payload = randomMode ? { mode: "random", count: requestedCount, phone: normalized, proofs: visibleProofs } : { mode: "selection", seats: selected, phone: normalized, proofs: visibleProofs };
        const { mine } = await seatRequest<{ mine: SeatRequest }>(endpoint, activeEdit
          ? seatJSON("PATCH", { ...payload, id: state.mine!.id, revision: editVersion.current }) : seatJSON("POST", payload));
        if (!alive.current) return;
        setState((current) => current && { ...current, mine, drafts: [] });
        editVersion.current = null;
        setEditing(false);
        setEditProofs([]);
        setSelected([]);
        setPhone("");
        setNotice(activeEdit ? t("修改已保存，申请继续等待审核。", "Changes saved. The request is still pending review.") : randomMode ? t("申请已提交，审核通过后安排座位。", "Request submitted. Seats are assigned after approval.") : t("选座申请已提交，座位进入待审核。", "Seat request submitted and pending review."));
      },
      true,
    );
  }

  return (
    <section className={styles.section} aria-labelledby="activity-seating-title" id="activity-seating" aria-busy={Boolean(busy)}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <p className={styles.kicker}>SEATING</p>
          <h2 id="activity-seating-title">{t("活动选座", "Seat selection")}</h2>
          <p className={styles.meta}>
            {randomMode ? t(`随机安排 · 每人最多 ${state.seatLimit} 座`, `Random assignment · up to ${state.seatLimit} seats each`) : t(`${state.rows.length} 排 · ${total} 座 · 每人最多 ${state.seatLimit} 座`, `${state.rows.length} rows · ${total} seats · up to ${state.seatLimit} each`)}
          </p>
        </div>
        <div className={styles.headActions}>
          <span className={styles.openState} data-open={state.open ? "true" : undefined}>
            {state.scheduled ? t("等待开放", "Opening soon") : state.open ? t("选座开放", "Open") : state.enabled ? t("选座已关闭", "Closed") : t("选座未启用", "Not enabled")}
          </span>
          {state.enabled && (
            <button type="button" className={buttonClass("ghost", "small")} disabled={Boolean(busy)} onClick={() => void run(t("正在刷新座位", "Refreshing seats"), async () => undefined, true)}>
              {randomMode ? t("刷新申请状态", "Refresh status") : t("刷新座位", "Refresh seats")}
            </button>
          )}
          {state.canReview && (
            <Link className={buttonClass("primary", "small")} href={`/activities/${kind}/${id}/seating`}>
              {t("选座工作台", "Seating workbench")}
            </Link>
          )}
        </div>
      </header>

      {state.mine && <SeatReceipt mine={state.mine} editable={editable} endpoint={endpoint} ticketImages={state.ticketImages || []} />}
      {state.mine?.status === "pending" && state.mineDetails?.canEdit && !activeEdit && (
        <div><button type="button" className={buttonClass("primary", "small")} disabled={Boolean(busy)} onClick={startEdit}>{t("修改申请", "Edit request")}</button></div>
      )}
      {state.mine?.status === "pending" && (
        <div className={styles.blockControls}>
          {confirmCancel ? (
            <>
              <span className={styles.blockHint}>{t("取消后全部座位将释放。", "Cancelling releases all your seats.")}</span>
              <button type="button" className={buttonClass("danger", "small")} disabled={Boolean(busy)} onClick={cancelRequest}>{t("确认取消申请", "Confirm cancellation")}</button>
              <button type="button" className={buttonClass("ghost", "small")} disabled={Boolean(busy)} onClick={() => setConfirmCancel(false)}>{t("返回", "Back")}</button>
            </>
          ) : <button type="button" className={buttonClass("ghost", "small")} disabled={Boolean(busy)} onClick={() => setConfirmCancel(true)}>{t("取消选座申请", "Cancel seat request")}</button>}
        </div>
      )}

      {(state.enabled || activeEdit) && (!randomMode || state.canReview) && (
        <div className={styles.mapBlock} ref={mapRef}>
          <div className={styles.mapTools}>
            <SeatLegend showAccent={state.rows.some(row => row.accent)} />
            <SeatZoom zoom={zoom} onChange={setZoom} />
          </div>
          <SeatMap state={state} selected={selected} editable={!randomMode && editable && !busy} own={activeEdit && !randomMode ? state.mine?.seats : []} toggle={toggle} zoom={zoom} label={t("活动座位图", "Activity seat map")} />
          <p className={styles.mapHint}>{t("座位图可左右滑动；键盘用方向键在可选座位间移动，空格或回车选择。", "Scroll the map sideways. With a keyboard, use arrow keys to move between seats and Space or Enter to select.")}</p>
        </div>
      )}
      {randomMode && <p className={styles.note}>{t("当前为随机座位模式，审核通过后系统安排座位，并优先安排同排连坐。", "Random seating: seats are assigned after approval, keeping your group together in one row where possible.")}</p>}

      {state.scheduled && <p className={styles.note} role="status">{t(`将于北京时间 ${formatDateTime(state.opensAt)} 开放选座。`, `Seat selection opens ${formatDateTime(state.opensAt, locale)} (Beijing time).`)}</p>}
      {state.enabled && !state.open && !state.scheduled && <p className={styles.note}>{t("当前活动选座已关闭，不再接收新的申请；已提交的申请仍由管理员处理。", "Seat selection is closed to new requests. Admins still process submitted requests.")}</p>}
      {!state.enabled && state.canReview && <p className={styles.note}>{t("本活动尚未开启选座，可在选座工作台开启。", "Seat selection is not enabled yet. Turn it on in the seating workbench.")}</p>}
      {state.open && !state.loggedIn && (
        <Link className={buttonClass("accent")} href={`/login?returnTo=${encodeURIComponent(`${returnTo}#activity-seating`)}`}>
          {t("登录后选座", "Sign in to pick seats")}
        </Link>
      )}

      {editable && (
        <form onSubmit={submit} className={styles.form} noValidate>
          {randomMode ? (
            <label className={styles.field}><span>{t("订座数量", "Number of seats")}</span><input type="number" min={1} max={state.seatLimit} step={1} required value={count} onChange={event => setCount(event.currentTarget.value)} disabled={Boolean(busy)} /><small>{t("审核通过后安排座位，尽量让同行人员坐在一起。", "Seats are assigned after approval, keeping your group together where possible.")}</small></label>
          ) : <SeatSelection selected={selected} limit={state.seatLimit} disabled={Boolean(busy)} onRemove={(seat) => setSelected(selected.filter((value) => value !== seat))} />}
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>{t("手机号", "Phone number")}</span>
              <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={24} value={phone} onChange={(event) => setPhone(event.currentTarget.value)} disabled={Boolean(busy)} />
              <small>{t("仅供本活动审核联系使用。", "Used only to contact you about this review.")}</small>
            </label>
            <label className={styles.field}>
              <span>{t("活动参与凭证", "Participation proof")}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={Boolean(busy) || visibleProofs.length >= state.proofLimit}
                onChange={(event) => {
                  upload(Array.from(event.currentTarget.files || []));
                  event.currentTarget.value = "";
                }}
              />
              <small>
                {t(`已选择 ${visibleProofs.length} / ${state.proofLimit} 张 · JPEG/PNG/WebP · 单张最多 ${state.proofBytes / 1024 / 1024} MB`, `${visibleProofs.length} / ${state.proofLimit} selected · JPEG/PNG/WebP · up to ${state.proofBytes / 1024 / 1024} MB each`)}
              </small>
            </label>
          </div>
          {visibleProofs.length > 0 && (
            <ul className={styles.proofs} aria-label={t("已上传凭证", "Uploaded proofs")}>
              {visibleProofs.map((proof, index) => (
                <li key={proof}>
                  <a href={`${endpoint}/proofs/${encodeURIComponent(proof)}`} target="_blank" rel="noreferrer">
                    {t(`凭证 ${index + 1}`, `Proof ${index + 1}`)}
                  </a>
                  <button type="button" className={buttonClass("ghost", "small")} disabled={Boolean(busy)} onClick={() => remove(proof)} aria-label={t(`移除凭证 ${index + 1}`, `Remove proof ${index + 1}`)}>
                    {t("移除", "Remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.submitRow}>
            <button className={buttonClass("primary")} type="submit" disabled={Boolean(busy)}>
              {activeEdit ? t("保存修改", "Save changes") : t("提交选座", "Submit seat request")}
            </button>
            {activeEdit && <button className={buttonClass("ghost")} type="button" disabled={Boolean(busy)} onClick={cancelEdit}>{t("取消修改", "Discard changes")}</button>}
            <p className={styles.hint}>{randomMode ? t("审核通过后系统安排座位。", "Seats are assigned after approval. ") : t("提交后座位进入待审核。", "Submitted seats wait for review. ")}{t("每人每场活动只保留一份待审核或已确认的申请。", "Each person keeps one pending or confirmed request per activity.")}</p>
          </div>
        </form>
      )}

      {busy && (
        <p className={styles.status} role="status">
          {busy}…
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
    </section>
  );
}
