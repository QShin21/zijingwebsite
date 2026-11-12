"use client";

import { useState } from "react";

/** Presentation only: keep the GET field names and values used by the calendar. */
export function ScheduleTimeFields({ range, month }: { range: string; month: string }) {
  const [selectedRange, setSelectedRange] = useState(range);
  const byMonth = selectedRange === "month";
  return (
    <>
      <label>
        时间
        <select name="range" value={selectedRange} onChange={(event) => setSelectedRange(event.target.value)}>
          <option value="upcoming">即将开始</option>
          <option value="past">已结束</option>
          <option value="month">按月份</option>
        </select>
      </label>
      <label>
        月份
        <input type="month" name="month" defaultValue={month} readOnly={!byMonth} aria-disabled={!byMonth} />
      </label>
    </>
  );
}
