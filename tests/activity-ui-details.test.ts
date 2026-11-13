import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeatMap } from "@/components/activity-pages/ActivitySeating";
import { seatKeys, seatRows } from "@/lib/activity-seating-model";

const fullLayout = {
  rows: seatRows,
  occupancy: Object.fromEntries(seatKeys.map((seat) => [seat, "pending" as const])),
  blockedSeats: [],
};

function renderMap(props: Partial<Parameters<typeof SeatMap>[0]> = {}) {
  return renderToStaticMarkup(createElement(SeatMap, {
    state: fullLayout,
    selected: [],
    editable: true,
    ...props,
  }));
}

describe("座位图键盘入口", () => {
  it("满座时允许键盘聚焦滚动区域，并保留各座位的状态说明", () => {
    const html = renderMap();
    expect(html).toMatch(/role="group" aria-label="座位图" tabindex="0"/);
    expect(html).toMatch(/data-seat="1-1"[^>]*disabled=""[^>]*aria-label="1排1座 · 待审核"/);
  });

  it("存在可选座位时将焦点交给首个可选座位", () => {
    const occupancy = { ...fullLayout.occupancy };
    delete occupancy["1-2"];
    const html = renderMap({ state: { ...fullLayout, occupancy } });
    expect(html).not.toMatch(/role="group" aria-label="座位图" tabindex="0"/);
    expect(html).toMatch(/data-seat="1-2"[^>]*tabindex="0"[^>]*aria-label="1排2座 · 可选"/);
  });

  it("只读座位图和可检查座位的管理视图各有键盘入口", () => {
    const readOnly = renderMap({ editable: false });
    expect(readOnly).toMatch(/role="group" aria-label="座位图" tabindex="0"/);
    const review = renderMap({ onInspect: () => {} });
    expect(review).not.toMatch(/role="group" aria-label="座位图" tabindex="0"/);
    expect(review).toMatch(/data-seat="1-1"[^>]*tabindex="0"[^>]*aria-label="1排1座 · 待审核 · 查看申请"/);
  });
});
