import { randomInt } from "node:crypto";
import { seatRows, type SeatRow } from "./activity-seating-model";

type Position = { key: string; row: number; column: number };

/** Prefer a contiguous block in one row; otherwise choose a compact nearby group. */
export function allocateRandomSeats(available: ReadonlySet<string>, count: number, rows: readonly SeatRow[] = seatRows): string[] | null {
  if (!Number.isInteger(count) || count < 1 || count > 10) return null;
  const positions: Position[] = rows.flatMap(({ row, count: length, offset }) =>
    Array.from({ length }, (_, index) => ({ key: `${row}-${index + 1}`, row, column: offset + index }))
      .filter(position => available.has(position.key)),
  );
  if (positions.length < count) return null;
  const blocks: string[][] = [];
  for (const { row, count: length } of rows) {
    for (let start = 1; start <= length - count + 1; start++) {
      const seats = Array.from({ length: count }, (_, index) => `${row}-${start + index}`);
      if (seats.every(seat => available.has(seat))) blocks.push(seats);
    }
  }
  if (blocks.length) return blocks[randomInt(blocks.length)];

  const byPosition = new Map(positions.map(position => [`${position.row}:${position.column}`, position]));
  const maxRow = Math.max(...rows.map(row => row.row));
  const maxColumn = Math.max(...rows.map(row => row.offset + row.count));
  const offsets: { row: number; column: number; distance: number }[] = [];
  for (let row = -maxRow; row <= maxRow; row++) for (let column = -maxColumn; column <= maxColumn; column++)
    offsets.push({ row, column, distance: 4 * row ** 2 + column ** 2 });
  offsets.sort((a, b) => a.distance - b.distance || a.row - b.row || a.column - b.column);
  let best = Number.POSITIVE_INFINITY;
  const groups: Position[][] = [];
  for (const anchor of positions) {
    const group: Position[] = [];
    for (const offset of offsets) {
      const candidate = byPosition.get(`${anchor.row + offset.row}:${anchor.column + offset.column}`);
      if (candidate) group.push(candidate);
      if (group.length === count) break;
    }
    let score = 0;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++)
      score += 4 * (group[i].row - group[j].row) ** 2 + (group[i].column - group[j].column) ** 2;
    if (score < best) { best = score; groups.length = 0; }
    if (score === best) groups.push(group);
  }
  return groups[randomInt(groups.length)].sort((a, b) => a.row - b.row || a.column - b.column).map(value => value.key);
}
