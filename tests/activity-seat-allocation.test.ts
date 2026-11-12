import { expect, it } from "vitest";
import { allocateRandomSeats } from "@/lib/activity-seat-allocation";

it("随机分配优先同排连坐，无法连坐时选择相近座位", () => {
  const contiguous = new Set(["5-1", "5-2", "5-3", "6-1", "6-2", "6-4"]);
  expect(allocateRandomSeats(contiguous, 3)).toEqual(["5-1", "5-2", "5-3"]);
  const nearby = new Set(["5-10", "5-12", "6-10", "12-1"]);
  expect(new Set(allocateRandomSeats(nearby, 3))).toEqual(new Set(["5-10", "5-12", "6-10"]));
  expect(allocateRandomSeats(nearby, 5)).toBeNull();
});
