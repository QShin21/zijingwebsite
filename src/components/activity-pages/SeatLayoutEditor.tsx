"use client";

import { useState } from "react";
import { seatGridLimit, seatLabel, type SeatGrid } from "@/lib/activity-seating-model";
import { buttonClass } from "@/components/v2/ui";
import { localizeSeatError, seatJSON, seatRequest } from "./seat-request";
import { seatName } from "./ActivitySeating";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import styles from "./ActivitySeating.module.css";

type LayoutInfo = { layout: SeatGrid | null; revision: number; protectedSeats: string[] };
const initialGrid = (): SeatGrid => ({ rowCount: 10, columnCount: 10, gaps: [] });

export function SeatLayoutEditor({ endpoint, disabled, onSaved }: { endpoint: string; disabled: boolean; onSaved: () => void }) {
  const t = useT(),
    locale = useLocale();
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("座位图读取失败", "Failed to load the seat map")); }
    finally { setBusy(false); }
  }

  function resize() {
    const rows = Number(rowCount), columns = Number(columnCount);
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows > seatGridLimit || columns > seatGridLimit) {
      setError(t(`行数和列数请填写 1–${seatGridLimit} 的整数。`, `Rows and columns must be whole numbers from 1 to ${seatGridLimit}.`)); return;
    }
    if (info?.layout && [...protectedSeats].some(seat => {
      const [row, column] = seat.split("-").map(Number); return row > rows || column > columns;
    })) { setError(t("调整范围需保留已有申请、锁定或票据的座位。", "The new size must keep seats that have requests, locks or tickets.")); return; }
    setGrid({ rowCount: rows, columnCount: columns, gaps: grid.gaps.filter(seat => {
      const [row, column] = seat.split("-").map(Number); return row <= rows && column <= columns;
    }) });
    setError(""); setMessage(t("方格已调整，请确认座位后保存。", "Grid resized. Check the seats, then save."));
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
    if (!info || legacyProtected || grid.gaps.length >= grid.rowCount * grid.columnCount) { setError(t("请至少保留一个座位。", "Keep at least one seat.")); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await seatRequest<LayoutInfo>(`${endpoint}/layout`, seatJSON("PUT", { layout: grid, revision: info.revision }));
      setInfo(result); setGrid(result.layout || grid); setMessage(t("座位图已保存，成员端和工作台已更新。", "Seat map saved. The member view and workbench are updated.")); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("座位图保存失败", "Failed to save the seat map")); }
    finally { setBusy(false); }
  }

  return <section className={styles.layoutEditor} aria-label={t("自定义座位图", "Custom seat map")}>
    <div className={styles.layoutHeading}><div><h3>{t("自定义座位图", "Custom seat map")}</h3><p className={styles.hint}>{t("设置排数、列数，点击方格切换座位与空位。", "Set rows and columns, then click cells to toggle seats and gaps.")}</p></div>
      <button type="button" className={buttonClass("ghost", "small")} disabled={disabled || busy} onClick={() => open ? setOpen(false) : void read()}>{open ? t("收起", "Collapse") : t("编辑座位图", "Edit seat map")}</button>
    </div>
    {open && info && <>
      {legacyProtected && <p className={styles.hint}>{t("当前原座位图已有占用、锁定或票据，继续保留原图。新活动可配置自定义座位图。", "The original seat map already has holds, locks or tickets, so it is kept. New activities can use a custom seat map.")}</p>}
      {!info.layout && !legacyProtected && <p className={styles.hint}>{t("保存后按方格的排号、列号作为座位编号；票据文件名与座位编号对应。", "After saving, each cell's row and column become its seat number; ticket filenames follow the seat numbers.")}</p>}
      <div className={styles.layoutControls}>
        <label className={styles.field}>{t("排数", "Rows")}<input type="number" min="1" max={seatGridLimit} value={rowCount} onChange={event => setRowCount(event.currentTarget.value)} disabled={busy || disabled || legacyProtected} /></label>
        <label className={styles.field}>{t("每排列数", "Seats per row")}<input type="number" min="1" max={seatGridLimit} value={columnCount} onChange={event => setColumnCount(event.currentTarget.value)} disabled={busy || disabled || legacyProtected} /></label>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled || legacyProtected} onClick={resize}>{t("应用行列", "Apply size")}</button>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled || legacyProtected} onClick={() => setAll(true)}>{t("全部设为座位", "Make all seats")}</button>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled || legacyProtected} onClick={() => setAll(false)}>{t("清空方格", "Clear grid")}</button>
      </div>
      <p className={styles.hint}>{t(`当前 ${grid.rowCount} 排 × ${grid.columnCount} 列，${grid.rowCount * grid.columnCount - grid.gaps.length} 个座位；已有申请、锁定或票据的座位保持不变。`, `${grid.rowCount} rows × ${grid.columnCount} columns, ${grid.rowCount * grid.columnCount - grid.gaps.length} seats. Seats with requests, locks or tickets stay unchanged.`)}</p>
      {!legacyProtected && <div className={styles.layoutGridViewport} aria-label={t("编辑座位方格", "Edit seat grid")}>
        <div className={styles.layoutGrid}>
          {Array.from({ length: grid.rowCount }, (_, rowIndex) => <div className={styles.layoutGridRow} key={rowIndex}>
            <strong className={styles.layoutRowNumber}>{t(`${rowIndex + 1}排`, `Row ${rowIndex + 1}`)}</strong>
            {Array.from({ length: grid.columnCount }, (_, columnIndex) => {
              const seat = `${rowIndex + 1}-${columnIndex + 1}`;
              const present = !gaps.has(seat), locked = Boolean(info.layout && protectedSeats.has(seat));
              return <button key={seat} type="button" className={styles.layoutCell} data-present={present || undefined} data-protected={locked || undefined}
                aria-pressed={present} aria-label={t(`${seatLabel(seat)}：${present ? "座位" : "空位"}${locked ? "，已有记录" : ""}`, `${seatName(seat, locale)}: ${present ? "seat" : "gap"}${locked ? ", has records" : ""}`)}
                title={t(`${seatLabel(seat)}${locked ? "（已有记录）" : ""}`, `${seatName(seat, locale)}${locked ? " (has records)" : ""}`)} disabled={busy || disabled || locked} onClick={() => toggle(seat)}>{columnIndex + 1}</button>;
            })}
          </div>)}
        </div>
      </div>}
      <div className={styles.layoutControls}>
        <button type="button" className={buttonClass("primary", "small")} disabled={busy || disabled || legacyProtected || grid.gaps.length >= grid.rowCount * grid.columnCount} onClick={save}>{t("保存座位图", "Save seat map")}</button>
        <button type="button" className={buttonClass("ghost", "small")} disabled={busy || disabled} onClick={read}>{t("重新读取", "Reload")}</button>
      </div>
    </>}
    {message && <p role="status">{message}</p>}
    {error && <p className={styles.error} role="alert">{localizeSeatError(error, locale)}</p>}
  </section>;
}
