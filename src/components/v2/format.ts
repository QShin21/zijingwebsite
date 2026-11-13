// Presentation-only date helpers. All club times are shown in Beijing time.
import type { CSSProperties } from "react";
const zone = "Asia/Shanghai";
import type { Locale } from "@/lib/i18n/locale";
// i18n-exempt: Chinese weekdays are used only in zh mode (weekdaysEn below)
const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
    weekdayEn: weekdaysEn[Math.max(0, weekdayIndex)],
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
// Every formatter takes an optional locale (default Chinese) so existing callers are unchanged.
export function formatDay(iso: string | null | undefined, locale: Locale = "zh") {
  const p = dateParts(iso);
  if (!p) return "";
  return locale === "en" ? `${p.weekdayEn} ${p.day} ${monthsEn[p.month - 1]}` : `${p.month}月${p.day}日 ${p.weekday}`;
}
export function formatDate(iso: string | null | undefined, locale: Locale = "zh") {
  const p = dateParts(iso);
  if (!p) return "";
  return locale === "en" ? `${p.day} ${monthsEn[p.month - 1]} ${p.year}` : `${p.year}年${p.month}月${p.day}日`;
}
export function formatShort(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.month}/${p.day}` : "";
}
export function formatTime(iso: string | null | undefined) {
  const p = dateParts(iso);
  return p ? `${p.hour}:${p.minute}` : "";
}
export function formatDateTime(iso: string | null | undefined, locale: Locale = "zh") {
  const p = dateParts(iso);
  if (!p) return "";
  return locale === "en" ? `${p.weekdayEn} ${p.day} ${monthsEn[p.month - 1]} ${p.hour}:${p.minute}` : `${p.month}月${p.day}日 ${p.weekday} ${p.hour}:${p.minute}`;
}
/** "18:30–21:00", "11月14日 18:30 – 11月15日 02:00" or "18:30 开始". */
export function formatRange(start: string | null | undefined, end: string | null | undefined, locale: Locale = "zh") {
  const a = dateParts(start), b = dateParts(end);
  const en = locale === "en";
  if (!a) return b ? (en ? `Ends ${formatDateTime(end, locale)}` : `${formatDateTime(end)} 结束`) : en ? "Time TBA" : "时间待定";
  if (!b) return en ? `Starts ${a.hour}:${a.minute}` : `${a.hour}:${a.minute} 开始`;
  if (a.key === b.key) return `${a.hour}:${a.minute}–${b.hour}:${b.minute}`;
  if (en) return `${a.day} ${monthsEn[a.month - 1]} ${a.hour}:${a.minute} – ${b.day} ${monthsEn[b.month - 1]} ${b.hour}:${b.minute}`;
  // i18n-exempt: zh branch; English returned above
  return `${a.month}月${a.day}日 ${a.hour}:${a.minute} – ${b.month}月${b.day}日 ${b.hour}:${b.minute}`;
}
/** Whole Beijing calendar days from today to the given instant (negative for past). */
export function daysUntil(iso: string | null | undefined, now = new Date()) {
  const target = dateParts(iso), today = parts(now.toISOString());
  if (!target || !today) return null;
  const utc = (p: DateParts) => Date.UTC(p.year, p.month - 1, p.day);
  return Math.round((utc(target) - utc(today)) / 86400000);
}
export function countdown(iso: string | null | undefined, now = new Date(), locale: Locale = "zh") {
  const days = daysUntil(iso, now);
  if (days === null) return null;
  if (days < 0) return null;
  const en = locale === "en";
  if (days === 0) return en ? "Today" : "今天";
  if (days === 1) return en ? "Tomorrow" : "明天";
  return en ? `In ${days} days` : `还有 ${days} 天`;
}
export function deadlineText(iso: string | null | undefined, now = new Date(), locale: Locale = "zh") {
  const days = daysUntil(iso, now);
  if (days === null) return null;
  const en = locale === "en";
  if (days < 0) return en ? `Closed ${formatShort(iso)}` : `已于 ${formatShort(iso)} 截止`;
  if (days === 0) return en ? `Closes today ${formatTime(iso)}` : `今天 ${formatTime(iso)} 截止`;
  return en ? `Closes ${formatShort(iso)} · ${days} day${days === 1 ? "" : "s"} left` : `${formatShort(iso)} 截止 · 剩 ${days} 天`;
}
export function todayLabel(beijingDate: string, locale: Locale = "zh") {
  const [year, month, day] = beijingDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const index = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return locale === "en" ? `${weekdaysEn[index]} ${day} ${monthsEn[month - 1]}` : `${month}月${day}日 ${weekdays[index]}`;
}
/** Community hue chip colors are produced in CSS from --hue. */
export function hueStyle(hue: number | null | undefined) {
  return { "--hue": String(Number.isFinite(hue) ? hue : 262) } as CSSProperties;
}
export function initial(title: string) {
  const trimmed = title.trim();
  // i18n-exempt: avatar monogram of the club name, decorative
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : "紫";
}
