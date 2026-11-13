"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { seatLabel, seatTicketBytes, seatTicketFilename } from "@/lib/activity-seating-model";
import { seatRequest } from "./seat-request";
import styles from "./ActivitySeating.module.css";

export function SeatTicketManager({ endpoint, disabled }: { endpoint: string; disabled: boolean }) {
  const [seats, setSeats] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const alive = useRef(true);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const result = await seatRequest<{ seats: string[] }>(`${endpoint}/tickets`);
    if (alive.current) setSeats(result.seats);
  }, [endpoint]);
  useEffect(() => {
    alive.current = true;
    load().catch(() => { if (alive.current) setErrors(["票据清单读取失败，请刷新页面重试。"]); });
    return () => { alive.current = false; };
  }, [load]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";
    if (!files.length || lock.current) return;
    lock.current = true;
    setMessage(""); setErrors([]);
    const selected = new Map<string, number>();
    for (const file of files) {
      const parsed = seatTicketFilename(file.name);
      if (parsed) selected.set(parsed.seat, (selected.get(parsed.seat) || 0) + 1);
    }
    const failures: string[] = [];
    let saved = 0;
    for (const [index, file] of files.entries()) {
      if (!alive.current) break;
      setBusy(`正在上传 ${index + 1} / ${files.length}`);
      const parsed = seatTicketFilename(file.name);
      if (!parsed) { failures.push(`${file.name}：文件名或座位无效`); continue; }
      if (selected.get(parsed.seat)! > 1) { failures.push(`${file.name}：本次选择中同一座位有多个文件`); continue; }
      if (!file.size || file.size > seatTicketBytes) { failures.push(`${file.name}：单张图片最多 8 MB`); continue; }
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("filename", file.name);
        await seatRequest(`${endpoint}/tickets`, { method: "POST", body: form });
        saved++;
      } catch (cause) {
        failures.push(`${file.name}：${cause instanceof Error ? cause.message : "上传失败"}`);
      }
    }
    if (alive.current) {
      try { await load(); } catch { failures.push("票据清单刷新失败，请刷新页面核对。"); }
      setMessage(`已保存 ${saved} 张票据${failures.length ? `，${failures.length} 张未完成` : ""}。`);
      setErrors(failures);
      setBusy("");
    }
    lock.current = false;
  }
  return (
    <section className={styles.ticketManager} aria-label="座位票据管理">
      <h3>座位电子票据</h3>
      <p className={styles.hint}>批量选择 JPG 或 PNG 图片，按“01排01座.jpg”命名。单张最多 8 MB；同一座位重新上传会更新票据。</p>
      <p className={styles.hint}>已上传 {seats.length} 个座位的票据。已确认座位的成员可在本人回执查看和保存。</p>
      <label className={styles.ticketUpload}>选择票据图片
        <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple disabled={disabled || Boolean(busy)} onChange={upload} />
      </label>
      {busy && <p className={styles.hint} role="status">{busy}…</p>}
      {message && <p role="status">{message}</p>}
      {errors.length > 0 && <ul className={styles.ticketErrors} role="alert">{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>}
      {seats.length > 0 && <details><summary>查看已上传座位</summary><p className={styles.hint}>{seats.map(seatLabel).join("、")}</p></details>}
    </section>
  );
}
