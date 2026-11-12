// Presentation-only date helpers. All club times are shown in Beijing time.
import type { CSSProperties } from "react";
const zone = "Asia/Shanghai";
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function parts(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: values.hour,
    minute: values.minute,
    weekday: weekdays[Math.max(0, weekdayIndex)],
    key: `${values.year}-${values.month}-${values.day}`,
  };
}
export type DateParts = NonNullable<ReturnType<typeof parts>>;
export function dateParts(iso: string | null | undefined): DateParts | null {
  return iso ? parts(iso) : null;
}
export function dayKey(iso: string | null | undefined) {
  return dateParts(iso)?.key ?? null;
}
export function formatDay(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.month}月${p.day}日 ${p.weekday}` : "";
}
export function formatDate(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.year}年${p.month}月${p.day}日` : "";
}
export function formatShort(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.month}/${p.day}` : "";
}
export function formatTime(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.hour}:${p.minute}` : "";
}
export function formatDateTime(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.month}月${p.day}日 ${p.weekday} ${p.hour}:${p.minute}` : "";
}
/** "18:30–21:00", "11月14日 18:30 – 11月15日 02:00" or "18:30 开始". */
export function formatRange(start: string | null | undefined, end: string | null | undefined) {
  const a = dateParts(start), b = dateParts(end);
  if (!a) return b ? `${formatDateTime(end)} 结束` : "时间待定";
  if (!b) return `${a.hour}:${a.minute} 开始`;
  if (a.key === b.key) return `${a.hour}:${a.minute}–${b.hour}:${b.minute}`;
  return `${a.month}月${a.day}日 ${a.hour}:${a.minute} – ${b.month}月${b.day}日 ${b.hour}:${b.minute}`;
}
/** Whole Beijing calendar days from today to the given instant (negative for past). */
export function daysUntil(iso: string | null | undefined, now = new Date()) {
  const target = dateParts(iso), today = parts(now.toISOString());
  if (!target || !today) return null;
  const utc = (p: DateParts) => Date.UTC(p.year, p.month - 1, p.day);
  return Math.round((utc(target) - utc(today)) / 86400000);
}
export function countdown(iso: string | null | undefined, now = new Date()) {
  const days = daysUntil(iso, now);
  if (days === null) return null;
  if (days < 0) return null;
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `还有 ${days} 天`;
}
export function deadlineText(iso: string | null | undefined, now = new Date()) {
  const days = daysUntil(iso, now);
  if (days === null) return null;
  if (days < 0) return `已于 ${formatShort(iso)} 截止`;
  if (days === 0) return `今天 ${formatTime(iso)} 截止`;
  return `${formatShort(iso)} 截止 · 剩 ${days} 天`;
}
export function todayLabel(beijingDate: string) {
  const [year, month, day] = beijingDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}月${day}日 ${weekday}`;
}
/** Community hue chip colors are produced in CSS from --hue. */
export function hueStyle(hue: number | null | undefined) {
  return { "--hue": String(Number.isFinite(hue) ? hue : 262) } as CSSProperties;
}
export function initial(title: string) {
  const trimmed = title.trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : "紫";
}
