import { randomInt } from "node:crypto";
import { seatRows } from "./activity-seating-model";

type Position = { key: string; row: number; column: number };

/** Prefer a contiguous block in one row; otherwise choose a compact nearby group. */
export function allocateRandomSeats(available: ReadonlySet<string>, count: number): string[] | null {
  if (!Number.isInteger(count) || count < 1 || count > 10) return null;
  const positions: Position[] = seatRows.flatMap(({ row, count: length, offset }) =>
    Array.from({ length }, (_, index) => ({ key: `${row}-${index + 1}`, row, column: offset + index }))
      .filter(position => available.has(position.key)),
  );
  if (positions.length < count) return null;
  const blocks: string[][] = [];
  for (const { row, count: length } of seatRows) {
    for (let start = 1; start <= length - count + 1; start++) {
      const seats = Array.from({ length: count }, (_, index) => `${row}-${start + index}`);
      if (seats.every(seat => available.has(seat))) blocks.push(seats);
    }
  }
  if (blocks.length) return blocks[randomInt(blocks.length)];

  let best = Number.POSITIVE_INFINITY;
  const groups: Position[][] = [];
  for (const anchor of positions) {
    const distance = (value: Position) => 4 * (value.row - anchor.row) ** 2 + (value.column - anchor.column) ** 2;
    const group = [...positions].sort((a, b) => distance(a) - distance(b) || a.row - b.row || a.column - b.column).slice(0, count);
    let score = 0;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++)
      score += 4 * (group[i].row - group[j].row) ** 2 + (group[i].column - group[j].column) ** 2;
    if (score < best) { best = score; groups.length = 0; }
    if (score === best) groups.push(group);
  }
  return groups[randomInt(groups.length)].sort((a, b) => a.row - b.row || a.column - b.column).map(value => value.key);
}
