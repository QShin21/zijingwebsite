"use client";

import { useState } from "react";
import { seatGridLimit, seatLabel, type SeatGrid } from "@/lib/activity-seating-model";
import { buttonClass } from "@/components/v2/ui";
import { seatJSON, seatRequest } from "./seat-request";
import styles from "./ActivitySeating.module.css";

type LayoutInfo = { layout: SeatGrid | null; revision: number; protectedSeats: string[] };
const initialGrid = (): SeatGrid => ({ rowCount: 10, columnCount: 10, gaps: [] });

export function SeatLayoutEditor({ endpoint, disabled, onSaved }: { endpoint: string; disabled: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<LayoutInfo>();
  const [grid, setGrid] = useState<SeatGrid>(initialGrid);
  const [rowCount, setRowCount] = useState("10");
  const [columnCount, setColumnCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const protectedSeats = new Set(info?.protectedSeats || []);
  const legacyProtected = Boolean(info && !info.layout && protectedSeats.size);
  const gaps = new Set(grid.gaps);

  async function read() {
    setBusy(true); setError(""); setMessage("");
    try {
      const value = await seatRequest<LayoutInfo>(`${endpoint}/layout`);
      const next = value.layout || initialGrid();
      setInfo(value); setGrid(next); setRowCount(String(next.rowCount)); setColumnCount(String(next.columnCount)); setOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "座位图读取失败"); }
    finally { setBusy(false); }
  }

  function resize() {
    const rows = Number(rowCount), columns = Number(columnCount);
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows > seatGridLimit || columns > seatGridLimit) {
      setError(`行数和列数请填写 1–${seatGridLimit} 的整数。`); return;
    }
    if (info?.layout && [...protectedSeats].some(seat => {
      const [row, column] = seat.split("-").map(Number); return row > rows || column > columns;
    })) { setError("调整范围需保留已有申请、锁定或票据的座位。"); return; }
    setGrid({ rowCount: rows, columnCount: columns, gaps: grid.gaps.filter(seat => {
      const [row, column] = seat.split("-").map(Number); return row <= rows && column <= columns;
    }) });
    setError(""); setMessage("方格已调整，请确认座位后保存。");
  }
  function toggle(seat: string) {
    if (protectedSeats.has(seat) && info?.layout) return;
    setGrid(current => ({ ...current, gaps: current.gaps.includes(seat) ? current.gaps.filter(value => value !== seat) : [...current.gaps, seat] }));
    setMessage(""); setError("");
  }
  function setAll(present: boolean) {
    setGrid(current => ({ ...current, gaps: present ? [] : Array.from({ length: current.rowCount }, (_, row) =>
      Array.from({ length: current.columnCount }, (_, column) => `${row + 1}-${column + 1}`)).flat().filter(seat => !protectedSeats.has(seat)) }));
    setMessage(""); setError("");
  }
  async function save() {
    if (!info || legacyProtected || grid.gaps.length >= grid.rowCount * grid.columnCount) { setError("请至少保留一个座位。"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await seatRequest<LayoutInfo>(`${endpoint}/layout`, seatJSON("PUT", { layout: grid, revision: info.revision }));
      setInfo(result); setGrid(result.layout || grid); setMessage("座位图已保存，成员端和工作台已更新。"); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "座位图保存失败"); }
    finally { setBusy(false); }
  }

  return <section className={styles.layoutEditor} aria-label="自定义座位图">
    <div className={styles.layoutHeading}><div><h3>自定义座位图</h3><p className={styles.hint}>设置排数、列数，点击方格切换座位与空位。</p></div>
      <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || busy} onClick={() => open ? setOpen(false) : void read()}>{open ? "收起" : "编辑座位图"}</button>
    </div>
    {open && info && <>
      {legacyProtected && <p className={styles.hint}>当前原座位图已有占用、锁定或票据，继续保留原图。新活动可配置自定义座位图。</p>}
      {!info.layout && !legacyProtected && <p className={styles.hint}>保存后按方格的排号、列号作为座位编号；票据文件名与座位编号对应。</p>}
      <div className={styles.layoutControls}>
        <label className={styles.field}>排数<input type="number" min="1" max={seatGridLimit} value={rowCount} onChange={event => setRowCount(event.currentTarget.value)} disabled={busy || disabled || legacyProtected} /></label>
        <label className={styles.field}>每排列数<input type="number" min="1" max={seatGridLimit} value={columnCount} onChange={event => setColumnCount(event.currentTarget.value)} disabled={busy || disabled || legacyProtected} /></label>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled || legacyProtected} onClick={resize}>应用行列</button>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled || legacyProtected} onClick={() => setAll(true)}>全部设为座位</button>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled || legacyProtected} onClick={() => setAll(false)}>清空方格</button>
      </div>
      <p className={styles.hint}>当前 {grid.rowCount} 排 × {grid.columnCount} 列，{grid.rowCount * grid.columnCount - grid.gaps.length} 个座位；已有申请、锁定或票据的座位保持不变。</p>
      {!legacyProtected && <div className={styles.layoutGridViewport} aria-label="编辑座位方格">
        <div className={styles.layoutGrid}>
          {Array.from({ length: grid.rowCount }, (_, rowIndex) => <div className={styles.layoutGridRow} key={rowIndex}>
            <strong className={styles.layoutRowNumber}>{rowIndex + 1}排</strong>
            {Array.from({ length: grid.columnCount }, (_, columnIndex) => {
              const seat = `${rowIndex + 1}-${columnIndex + 1}`;
              const present = !gaps.has(seat), locked = Boolean(info.layout && protectedSeats.has(seat));
              return <button key={seat} type="button" className={styles.layoutCell} data-present={present || undefined} data-protected={locked || undefined}
                aria-pressed={present} aria-label={`${seatLabel(seat)}：${present ? "座位" : "空位"}${locked ? "，已有记录" : ""}`}
                title={`${seatLabel(seat)}${locked ? "（已有记录）" : ""}`} disabled={busy || disabled || locked} onClick={() => toggle(seat)}>{columnIndex + 1}</button>;
            })}
          </div>)}
        </div>
      </div>}
      <div className={styles.layoutControls}>
        <button type="button" className={buttonClass("primary", "small")} disabled={busy || disabled || legacyProtected || grid.gaps.length >= grid.rowCount * grid.columnCount} onClick={save}>保存座位图</button>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled} onClick={read}>重新读取</button>
      </div>
    </>}
    {message && <p role="status">{message}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
