import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./schedule-calendar.module.css";

export function ScheduleCalendar({
  month,
  today,
  selectedDay,
  days,
  href,
}: {
  month: string;
  today: string | null;
  selectedDay?: string;
  days: { date: string; count: number; mine: number }[];
  href: (patch: { range: "month"; month: string; day?: string }) => string;
}) {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const markers = new Map(days.map((day) => [day.date, day]));
  const shift = (step: number) => {
    const date = new Date(Date.UTC(year, number - 1 + step, 1));
    return date.toISOString().slice(0, 7);
  };
  return (
    <section className={styles.calendar} aria-label="活动日历">
      <header className={styles.head}>
        <h2>
          {year}年{number}月
        </h2>
        <nav aria-label="切换日历月份">
          <Link
            href={href({ range: "month", month: shift(-1), day: undefined })}
            aria-label="上个月"
          >
            <Icon name="back" size={18} />
          </Link>
          <Link
            href={href({ range: "month", month: shift(1), day: undefined })}
            aria-label="下个月"
          >
            <Icon name="arrow" size={18} />
          </Link>
        </nav>
      </header>
      <div className={styles.week} aria-hidden="true">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.days}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const marker = markers.get(date);
          return (
            <Link
              key={date}
              href={`${href({ range: "month", month, day: date })}#event-results`}
              aria-label={`${year}年${number}月${i + 1}日，${marker?.count ?? 0}场活动${marker?.mine ? `，已报名${marker.mine}场` : ""}`}
              aria-current={date === selectedDay ? "date" : undefined}
              data-today={date === today || undefined}
              data-events={Boolean(marker?.count) || undefined}
              data-mine={Boolean(marker?.mine) || undefined}
            >
              <span>{i + 1}</span>
              <i aria-hidden="true" />
            </Link>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span>
          <i />
          有活动
        </span>
        <span>
          <i />
          我已报名
        </span>
        <span>
          <i />
          今天
        </span>
      </div>
      <Link
        className={styles.monthLink}
        href={`${href({ range: "month", month, day: undefined })}#event-results`}
      >
        查看整月日程 <Icon name="arrow" size={16} />
      </Link>
    </section>
  );
}
