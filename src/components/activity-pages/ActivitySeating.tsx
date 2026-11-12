
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import {
  seatAPI, seatKeys, seatLabel, seatPhonePattern, seatStatusLabels,
  type SeatRequest, type SeatingKind, type SeatingState,
} from "@/lib/activity-seating-model";
import { seatJSON, seatRequest } from "./seat-request";
import styles from "./ActivitySeating.module.css";

const legend = [
  ["available", "可选"], ["selected", "已选"], ["pending", "待审核"], ["confirmed", "已确认"],
] as const;

function SeatMap({ state, selected, editable, toggle }: {
  state: SeatingState;
  selected: string[];
  editable: boolean;
  toggle: (seat: string) => void;
}) {
  const [focused, setFocused] = useState("");
  const first = !state.occupancy[focused] && focused ? focused : seatKeys.find(seat => !state.occupancy[seat]);

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) ||
        !(event.target instanceof HTMLButtonElement)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-seat]:enabled"));
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      buttons[index + direction]?.focus();
      return;
    }
    const row = Number(event.target.dataset.row), column = Number(event.target.dataset.column);
    const next = buttons.filter(button => direction * (Number(button.dataset.row) - row) > 0);
    next.sort((a, b) => direction * (Number(a.dataset.row) - Number(b.dataset.row)) ||
      Math.abs(Number(a.dataset.column) - column) - Math.abs(Number(b.dataset.column) - column));
    next[0]?.focus();
  }

  return (
    <>
      <ul className={styles.legend} aria-label="座位状态">
        {legend.map(([value, label]) => <li key={value}><span data-state={value} aria-hidden="true" />{label}</li>)}
      </ul>
      <p className={styles.scrollHint}>左右滑动查看整排座位。</p>
      <div className={styles.viewport} aria-label="座位图" onKeyDown={moveFocus}>
        <div className={styles.board}>
          <div className={styles.screen}>屏幕 / 舞台</div>
          {state.rows.map(row => (
            <div className={styles.row} key={row.row}>
              <span className={styles.rowNumber} aria-label={`第 ${row.row} 排`}>{row.row}</span>
              <div className={styles.rowSeats}
                data-accent={"accent" in row && row.accent ? "true" : undefined}
                style={{ "--offset": row.offset } as CSSProperties}>
                {Array.from({ length: row.count }, (_, index) => {
                  const seat = `${row.row}-${index + 1}`;
                  const taken = state.occupancy[seat];
                  const picked = selected.includes(seat);
                  const value = taken || (picked ? "selected" : "available");
                  return (
                    <button
                      type="button" key={seat} data-seat={seat} data-state={value}
                      data-row={row.row} data-column={row.offset + index}
                      className={styles.seat} disabled={!editable || Boolean(taken)}
                      tabIndex={seat === first ? 0 : -1} aria-pressed={picked}
                      aria-label={`${seatLabel(seat)} · ${legend.find(([key]) => key === value)?.[1]}`}
                      title={seatLabel(seat)} onFocus={() => setFocused(seat)} onClick={() => toggle(seat)}
                    >{index + 1}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function ActivitySeating({ kind, id, returnTo }: { kind: SeatingKind; id: number; returnTo: string }) {
  const endpoint = seatAPI(kind, id);
  const [state, setState] = useState<SeatingState>();
  const [selected, setSelected] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const fresh = await seatRequest<SeatingState>(endpoint, { signal });
    setState(fresh);
    setSelected(values => values.filter(seat => !fresh.occupancy[seat]));
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => { /* A quiet first read keeps inactive activities uncluttered. */ });
    return () => controller.abort();
  }, [load]);

  if (!state || (!state.enabled && !state.canReview && !state.mine)) return null;
  const editable = state.open && state.loggedIn && (!state.mine || state.mine.status === "rejected");

  function toggle(seat: string) {
    if (!state || busy || !editable) return;
    setError("");
    if (selected.includes(seat)) setSelected(selected.filter(value => value !== seat));
    else if (selected.length < state.seatLimit) setSelected([...selected, seat]);
    else setError(`每人最多选择 ${state.seatLimit} 个座位`);
  }

  async function refresh() {
    setBusy("正在刷新");
    setError("");
    try { await load(); } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function upload(files: File[]) {
    if (!state || !files.length) return;
    if (files.length > state.proofLimit - state.drafts.length || files.some(file => file.size > state.proofBytes)) {
      setError(`最多上传 ${state.proofLimit} 张凭证，单张最多 ${state.proofBytes / 1024 / 1024} MB`);
      return;
    }
    setBusy("正在上传凭证");
    setError("");
    try {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const saved = await seatRequest<{ id: string }>(endpoint + "/proofs", { method: "POST", body: form });
        setState(current => current && { ...current, drafts: [...current.drafts, saved.id] });
      }
    } catch (cause) {
      setError((cause as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy("");
    }
  }

  async function remove(proof: string) {
    setBusy("正在移除凭证");
    setError("");
    try {
      await seatRequest(`${endpoint}/proofs/${proof}`, { method: "DELETE" });
      setState(current => current && { ...current, drafts: current.drafts.filter(id => id !== proof) });
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state || busy) return;
    if (!selected.length || !state.drafts.length || !seatPhonePattern.test(phone.trim().replace(/[\s-]/g, ""))) {
      setError("请选择座位、上传凭证并填写有效手机号");
      return;
    }
    setBusy("正在提交选座");
    setError("");
    try {
      const { mine } = await seatRequest<{ mine: SeatRequest }>(
        endpoint, seatJSON("POST", { seats: selected, phone, proofs: state.drafts }),
      );
      setState(current => current && { ...current, mine, drafts: [] });
      setSelected([]);
      setPhone("");
      setNotice("选座申请已提交");
    } catch (cause) { setError((cause as Error).message); }
    finally {
      await load().catch(() => {});
      setBusy("");
    }
  }

  return (
    <section className={styles.section} aria-label="活动选座" id="activity-seating">
      <header className={styles.heading}>
        <h2>活动选座</h2>
        <div className={styles.actions}>
          {state.enabled && <button type="button" className="button light" disabled={Boolean(busy)} onClick={refresh}>刷新座位</button>}
          {state.canReview && <Link className="button light" href={`/activities/${kind}/${id}/seating`}>选座工作台</Link>}
        </div>
      </header>
      {state.mine && (
        <p className={styles.receipt}>
          <strong>我的申请 · {seatStatusLabels[state.mine.status]}</strong>
          <span>{state.mine.seats.map(seatLabel).join("、")}</span>
          {state.mine.status === "rejected" && editable && <span>可以重新选座并提交凭证。</span>}
        </p>
      )}
      {state.enabled && (
        <SeatMap state={state} selected={selected} editable={editable && !busy} toggle={toggle} />
      )}
      {state.enabled && !state.open && <p>当前活动选座已关闭。</p>}
      {state.open && !state.loggedIn && (
        <Link className="button" href={`/login?returnTo=${encodeURIComponent(returnTo + "#activity-seating")}`}>登录后选座</Link>
      )}
      {editable && (
        <form onSubmit={submit} className={styles.form}>
          <div aria-live="polite">
            <strong>已选 {selected.length} / {state.seatLimit} 个座位</strong>
            {selected.length > 0 && <p>{selected.map(seatLabel).join("、")}</p>}
          </div>
          <label className={styles.field}>手机号
            <input name="phone" type="tel" autoComplete="tel" required maxLength={24} value={phone}
              onChange={event => setPhone(event.currentTarget.value)} disabled={Boolean(busy)} />
          </label>
          <label className={styles.field}>活动参与凭证
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple
              disabled={Boolean(busy) || state.drafts.length >= state.proofLimit}
              onChange={event => {
                void upload(Array.from(event.currentTarget.files || []));
                event.currentTarget.value = "";
              }} />
            <small>已上传 {state.drafts.length} / {state.proofLimit} 张，单张最多 {state.proofBytes / 1024 / 1024} MB。手机号与凭证供本活动审核使用。</small>
          </label>
          {!!state.drafts.length && (
            <ul className={styles.proofs}>
              {state.drafts.map((proof, index) => (
                <li key={proof}>
                  <a href={`${endpoint}/proofs/${proof}`} target="_blank" rel="noreferrer">凭证 {index + 1}</a>
                  <button type="button" className="button light" disabled={Boolean(busy)}
                    onClick={() => remove(proof)} aria-label={`移除凭证 ${index + 1}`}>移除</button>
                </li>
              ))}
            </ul>
          )}
          <button className="button" type="submit" disabled={Boolean(busy)}>提交选座</button>
        </form>
      )}
      {busy && <p role="status">{busy}…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
