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
import { SeatRequestError, seatJSON, seatRequest } from "./seat-request";
import styles from "./ActivitySeating.module.css";

export type SeatVisual = "available" | "selected" | "pending" | "confirmed" | "blocked";
export const seatLegend: readonly (readonly [SeatVisual, string])[] = [
  ["available", "可选"],
  ["selected", "已选"],
  ["pending", "待审核"],
  ["confirmed", "已确认"],
  ["blocked", "未开放"],
];
/** Seat sizes (px) for the three zoom steps. Even the compact step keeps a 24px target pitch. */
export const seatZooms = [20, 26, 34] as const;
export const seatGap = 4;
const zoomNames = ["紧凑", "标准", "放大"];
const proofTypes = ["image/jpeg", "image/png", "image/webp"];
type SeatLayout = Pick<SeatingState, "rows" | "occupancy"> & Partial<Pick<SeatingState, "blockedSeats">>;

/** Widest zoom whose whole board fits `width`; narrow screens keep the touch-friendly standard step and scroll. */
export function fittedZoom(rows: SeatLayout["rows"], width: number) {
  const columns = Math.max(...rows.map((row) => row.offset + row.count));
  for (let index = seatZooms.length - 1; index >= 0; index -= 1) if (48 + columns * (seatZooms[index] + seatGap) <= width) return index;
  return 1;
}

/** Legend and centre-zone key, shared by the member map, the workbench and the visual specimen. */
export function SeatLegend() {
  return (
    <ul className={styles.legend} aria-label="座位状态图例">
      {seatLegend.map(([value, label]) => (
        <li key={value}>
          <span className={styles.swatch} data-state={value} aria-hidden="true" />
          {label}
        </li>
      ))}
      <li>
        <span className={styles.swatch} data-state="available" data-accent="true" aria-hidden="true" />
        中心区 8–10 排
      </li>
    </ul>
  );
}

/** Zoom stepper for the seat map; the map itself scrolls inside its own box. */
export function SeatZoom({ zoom, onChange }: { zoom: number; onChange: (zoom: number) => void }) {
  return (
    <div className={styles.zoom} role="group" aria-label="座位图缩放">
      <button type="button" onClick={() => onChange(Math.max(0, zoom - 1))} disabled={zoom <= 0} aria-label="缩小座位图">
        −
      </button>
      <span aria-live="polite">{zoomNames[zoom] ?? zoomNames[1]}</span>
      <button type="button" onClick={() => onChange(Math.min(seatZooms.length - 1, zoom + 1))} disabled={zoom >= seatZooms.length - 1} aria-label="放大座位图">
        +
      </button>
    </div>
  );
}

/**
 * The seat map. Layout and occupancy come from the server, selection from the caller.
 * One seat is in the tab order (roving tabindex); arrow keys move between enabled seats,
 * Space/Enter toggles. Taken seats are disabled and announced with their state.
 */
export function SeatMap({
  state,
  selected,
  editable,
  toggle,
  zoom = 1,
  label = "座位图",
  manage = false,
}: {
  state: SeatLayout;
  selected: readonly string[];
  editable: boolean;
  toggle?: (seat: string) => void;
  zoom?: number;
  label?: string;
  manage?: boolean;
}) {
  const [focused, setFocused] = useState("");
  const keys = state.rows.flatMap(({ row, count }) => Array.from({ length: count }, (_, index) => `${row}-${index + 1}`));
  const blocked = new Set(state.blockedSeats || []);
  const selectable = (seat: string) => !state.occupancy[seat] || (manage && blocked.has(seat));
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
      aria-label={label}
      onKeyDown={moveFocus}
      // A read-only map has no enabled seats, so the scroll box itself takes focus for keyboard scrolling.
      tabIndex={editable ? undefined : 0}
      style={{ "--seat-size": `${seatZooms[zoom] ?? seatZooms[1]}px`, "--seat-gap": `${seatGap}px` } as CSSProperties}
    >
      <div className={styles.board}>
        <div className={styles.stage} aria-hidden="true">
          <span className={styles.stageArc} />
          <span className={styles.stageLabel}>舞台 · 屏幕</span>
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
                  const taken = state.occupancy[seat];
                  const picked = selected.includes(seat);
                  const value: SeatVisual = blocked.has(seat) ? "blocked" : taken || (picked ? "selected" : "available");
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
                      aria-pressed={selectable(seat) ? picked : undefined}
                      aria-label={`${seatLabel(seat)}${accent ? " · 中心区" : ""} · ${seatLegend.find(([key]) => key === value)?.[1]}${picked && value === "blocked" ? " · 已选" : ""}`}
                      title={seatLabel(seat)}
                      onFocus={() => setFocused(seat)}
                      onClick={() => toggle?.(seat)}
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
  return (
    <div className={styles.selection} aria-live="polite">
      <p className={styles.selectionCount}>
        <strong>{selected.length}</strong>
        <span>/ {limit} 个座位</span>
      </p>
      {selected.length ? (
        <ul className={styles.chips} aria-label="已选座位">
          {selected.map((seat) => (
            <li key={seat}>
              {onRemove ? (
                <button type="button" className={styles.chip} disabled={disabled} onClick={() => onRemove(seat)} aria-label={`取消 ${seatLabel(seat)}`}>
                  {seatLabel(seat)}
                  <span aria-hidden="true">×</span>
                </button>
              ) : (
                <span className={styles.chip}>{seatLabel(seat)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.hint}>在座位图中点选 1–{limit} 个座位。</p>
      )}
    </div>
  );
}

/** The member's own request: seats and status only, never phone numbers or proofs. */
export function SeatReceipt({ mine, editable }: { mine: Pick<SeatRequest, "seats" | "status">; editable: boolean }) {
  return (
    <div className={styles.receipt} data-status={mine.status}>
      <p className={styles.receiptHead}>
        <span className={styles.badge} data-status={mine.status}>
          {seatStatusLabels[mine.status]}
        </span>
        <strong>我的选座申请</strong>
      </p>
      <p className={styles.receiptSeats}>{mine.seats.map(seatLabel).join("、")}</p>
      {mine.status === "pending" && <p className={styles.hint}>座位已为你保留，等待管理员核对凭证后锁定。</p>}
      {mine.status === "confirmed" && <p className={styles.hint}>审核已通过，座位已锁定。</p>}
      {mine.status === "rejected" && (
        <p className={styles.hint}>{editable ? "申请已驳回，座位已释放；可以重新选座并提交凭证。" : "申请已驳回，座位已释放。"}</p>
      )}
    </div>
  );
}

/**
 * Member seat selection on the V2 event detail (club events and community events).
 * Renders nothing until the server reports seating enabled, an own request, or review
 * rights; every capability comes from the server state. Nothing is cached or stored.
 */
export function ActivitySeating({ kind, id, returnTo }: { kind: SeatingKind; id: number; returnTo: string }) {
  const endpoint = seatAPI(kind, id);
  const [state, setState] = useState<SeatingState>();
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(1);
  const lock = useRef(false);
  const alive = useRef(true);
  const fitted = useRef(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const fresh = await seatRequest<SeatingState>(endpoint, { signal });
      if (!alive.current || signal?.aborted) return;
      setState(fresh);
      setFailed(false);
      // Seats taken by someone else since the last read drop out of the local selection.
      setSelected((values) => values.filter((seat) => !fresh.occupancy[seat]));
    },
    [endpoint],
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
        if (!controller.signal.aborted && alive.current) setError(cause instanceof Error ? cause.message : "选座信息读取失败");
      });
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [state?.scheduled, state?.opensAt, state?.serverTime, load]);

  // Pick the widest zoom that fits once the map first appears; members can still change it.
  useEffect(() => {
    if (fitted.current || !state?.enabled || !mapRef.current) return;
    fitted.current = true;
    setZoom(fittedZoom(state.rows, mapRef.current.clientWidth));
  }, [state]);

  function retry() {
    if (lock.current) return;
    lock.current = true;
    setBusy("正在加载");
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
          活动选座
        </h2>
        <p className={styles.error} role="alert">
          选座信息暂时无法加载。
        </p>
        <button type="button" className={buttonClass("ghost", "small")} onClick={retry} disabled={Boolean(busy)}>
          {busy ? "正在加载…" : "重新加载"}
        </button>
      </section>
    );
  }
  if (!state.enabled && !state.canReview && !state.mine) return null;
  const editable = state.open && state.loggedIn && (!state.mine || state.mine.status === "rejected");
  const total = state.rows.reduce((sum, row) => sum + row.count, 0);

  /** One action at a time; failures keep the form; errors and conflicts (409) refresh the map. */
  async function run(label: string, task: () => Promise<void>, reloadAfter = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    let reload = reloadAfter;
    try {
      await task();
    } catch (cause) {
      reload = true;
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : "操作失败，请重试");
        if (cause instanceof SeatRequestError && cause.status === 409) setNotice("座位或凭证状态已变化，已为你刷新座位图。");
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
    setState((current) => current && { ...current, loggedIn: false, canReview: false, mine: null, drafts: [] });
    setSelected([]);
    setPhone("");
  }

  function toggle(seat: string) {
    if (!state || lock.current || !editable || state.occupancy[seat]) return;
    setError("");
    if (selected.includes(seat)) setSelected(selected.filter((value) => value !== seat));
    else if (selected.length < state.seatLimit) setSelected([...selected, seat]);
    else setError(`每人最多选择 ${state.seatLimit} 个座位`);
  }

  function upload(files: File[]) {
    if (!state || !files.length || lock.current) return;
    if (files.length > state.proofLimit - state.drafts.length) {
      setError(`最多上传 ${state.proofLimit} 张凭证，还可上传 ${Math.max(0, state.proofLimit - state.drafts.length)} 张`);
      return;
    }
    if (files.some((file) => !proofTypes.includes(file.type))) {
      setError("凭证仅支持 JPEG、PNG 或 WebP 图片");
      return;
    }
    if (files.some((file) => !file.size || file.size > state.proofBytes)) {
      setError(`单张凭证最多 ${state.proofBytes / 1024 / 1024} MB`);
      return;
    }
    void run("正在上传凭证", async () => {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const saved = await seatRequest<{ id: string }>(`${endpoint}/proofs`, { method: "POST", body: form });
        if (!alive.current) return;
        setState((current) => current && { ...current, drafts: [...current.drafts, saved.id] });
      }
    });
  }

  function remove(proof: string) {
    void run("正在移除凭证", async () => {
      await seatRequest(`${endpoint}/proofs/${encodeURIComponent(proof)}`, { method: "DELETE" });
      if (alive.current) setState((current) => current && { ...current, drafts: current.drafts.filter((value) => value !== proof) });
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state || lock.current) return;
    const normalized = phone.trim().replace(/[\s-]/g, "");
    if (!selected.length) return setError("请先在座位图中选择座位");
    if (!seatPhonePattern.test(normalized)) return setError("请填写有效的手机号");
    if (!state.drafts.length) return setError("请上传至少 1 张活动参与凭证");
    void run(
      "正在提交选座",
      async () => {
        const { mine } = await seatRequest<{ mine: SeatRequest }>(endpoint, seatJSON("POST", { seats: selected, phone: normalized, proofs: state.drafts }));
        if (!alive.current) return;
        setState((current) => current && { ...current, mine, drafts: [] });
        setSelected([]);
        setPhone("");
        setNotice("选座申请已提交，座位进入待审核。");
      },
      true,
    );
  }

  return (
    <section className={styles.section} aria-labelledby="activity-seating-title" id="activity-seating" aria-busy={Boolean(busy)}>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <p className={styles.kicker}>SEATING</p>
          <h2 id="activity-seating-title">活动选座</h2>
          <p className={styles.meta}>
            {state.rows.length} 排 · {total} 座 · 每人最多 {state.seatLimit} 座
          </p>
        </div>
        <div className={styles.headActions}>
          <span className={styles.openState} data-open={state.open ? "true" : undefined}>
            {state.scheduled ? "等待开放" : state.open ? "选座开放" : state.enabled ? "选座已关闭" : "选座未启用"}
          </span>
          {state.enabled && (
            <button type="button" className={buttonClass("ghost", "small")} disabled={Boolean(busy)} onClick={() => void run("正在刷新座位", async () => undefined, true)}>
              刷新座位
            </button>
          )}
          {state.canReview && (
            <Link className={buttonClass("primary", "small")} href={`/activities/${kind}/${id}/seating`}>
              选座工作台
            </Link>
          )}
        </div>
      </header>

      {state.mine && <SeatReceipt mine={state.mine} editable={editable} />}

      {state.enabled && (
        <div className={styles.mapBlock} ref={mapRef}>
          <div className={styles.mapTools}>
            <SeatLegend />
            <SeatZoom zoom={zoom} onChange={setZoom} />
          </div>
          <SeatMap state={state} selected={selected} editable={editable && !busy} toggle={toggle} zoom={zoom} label="活动座位图" />
          <p className={styles.mapHint}>座位图可左右滑动；键盘用方向键在可选座位间移动，空格或回车选择。</p>
        </div>
      )}

      {state.scheduled && <p className={styles.note} role="status">将于北京时间 {formatDateTime(state.opensAt)} 开放选座。</p>}
      {state.enabled && !state.open && !state.scheduled && <p className={styles.note}>当前活动选座已关闭，不再接收新的申请；已提交的申请仍由管理员处理。</p>}
      {!state.enabled && state.canReview && <p className={styles.note}>本活动尚未开启选座，可在选座工作台开启。</p>}
      {state.open && !state.loggedIn && (
        <Link className={buttonClass("accent")} href={`/login?returnTo=${encodeURIComponent(`${returnTo}#activity-seating`)}`}>
          登录后选座
        </Link>
      )}

      {editable && (
        <form onSubmit={submit} className={styles.form} noValidate>
          <SeatSelection selected={selected} limit={state.seatLimit} disabled={Boolean(busy)} onRemove={(seat) => setSelected(selected.filter((value) => value !== seat))} />
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>手机号</span>
              <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={24} value={phone} onChange={(event) => setPhone(event.currentTarget.value)} disabled={Boolean(busy)} />
              <small>仅供本活动审核联系使用。</small>
            </label>
            <label className={styles.field}>
              <span>活动参与凭证</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={Boolean(busy) || state.drafts.length >= state.proofLimit}
                onChange={(event) => {
                  upload(Array.from(event.currentTarget.files || []));
                  event.currentTarget.value = "";
                }}
              />
              <small>
                已上传 {state.drafts.length} / {state.proofLimit} 张 · JPEG/PNG/WebP · 单张最多 {state.proofBytes / 1024 / 1024} MB
              </small>
            </label>
          </div>
          {state.drafts.length > 0 && (
            <ul className={styles.proofs} aria-label="已上传凭证">
              {state.drafts.map((proof, index) => (
                <li key={proof}>
                  <a href={`${endpoint}/proofs/${encodeURIComponent(proof)}`} target="_blank" rel="noreferrer">
                    凭证 {index + 1}
                  </a>
                  <button type="button" className={buttonClass("ghost", "small")} disabled={Boolean(busy)} onClick={() => remove(proof)} aria-label={`移除凭证 ${index + 1}`}>
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.submitRow}>
            <button className={buttonClass("primary")} type="submit" disabled={Boolean(busy)}>
              提交选座
            </button>
            <p className={styles.hint}>提交后座位进入待审核；每人每场活动只保留一份待审核或已确认的申请。</p>
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
          {error}
        </p>
      )}
    </section>
  );
}
