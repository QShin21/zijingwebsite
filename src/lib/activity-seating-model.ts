
export type SeatingKind = "events" | "community-posts";
export type SeatStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "revoked";
export type SeatDecision = "confirmed" | "rejected";
export type SeatingMode = "selection" | "random";
export const seatLimit = 10;
export const seatProofLimit = 10;
export const seatProofBytes = 8 * 1024 * 1024;
export const seatTicketBytes = 8 * 1024 * 1024;
export const seatGridLimit = 100;
export const seatStatusLabels: Record<SeatStatus, string> = {
  pending: "待审核",
  confirmed: "已确认",
  rejected: "已驳回",
  cancelled: "已取消",
  revoked: "已撤销",
};

export const seatRows = [
  { row: 1, count: 27, offset: 5 },
  { row: 2, count: 31, offset: 3 },
  { row: 3, count: 35, offset: 1 },
  { row: 4, count: 37, offset: 0 },
  { row: 5, count: 37, offset: 0 },
  { row: 6, count: 37, offset: 0 },
  { row: 7, count: 37, offset: 0 },
  { row: 8, count: 26, offset: 6, accent: true },
  { row: 9, count: 26, offset: 6, accent: true },
  { row: 10, count: 24, offset: 7, accent: true },
  { row: 11, count: 31, offset: 3 },
  { row: 12, count: 33, offset: 2 },
] as const;

export function seatLabel(seat: string) {
  const [row, number] = seat.split("-");
  return `${row}排${number}座`;
}

export const seatKeys = seatRows.flatMap(({ row, count }) =>
  Array.from({ length: count }, (_, index) => `${row}-${index + 1}`),
);
export type SeatRow = { row: number; count: number; offset: number; accent?: boolean };
export type SeatGrid = { rowCount: number; columnCount: number; gaps: string[] };
export function validSeatKey(seat: string) {
  const match = /^([1-9]\d{0,2})-([1-9]\d{0,2})$/.exec(seat);
  return Boolean(match && Number(match[1]) <= seatGridLimit && Number(match[2]) <= seatGridLimit);
}
export function rowsForGrid(grid: SeatGrid | null | undefined): readonly SeatRow[] {
  return grid ? Array.from({ length: grid.rowCount }, (_, index) => ({ row: index + 1, count: grid.columnCount, offset: 0 })) : seatRows;
}
export function keysForGrid(grid: SeatGrid | null | undefined) {
  if (!grid) return seatKeys;
  const gaps = new Set(grid.gaps);
  return Array.from({ length: grid.rowCount }, (_, row) =>
    Array.from({ length: grid.columnCount }, (_, column) => `${row + 1}-${column + 1}`)).flat().filter(seat => !gaps.has(seat));
}
export function seatInGrid(grid: SeatGrid | null | undefined, seat: string) {
  if (!validSeatKey(seat)) return false;
  if (!grid) return seatKeys.includes(seat);
  const [row, column] = seat.split("-").map(Number);
  return row <= grid.rowCount && column <= grid.columnCount && !grid.gaps.includes(seat);
}
export function seatTicketFilename(filename: string) {
  const match = /^(\d{1,3})排(\d{1,3})座\.(jpg|jpeg|png)$/i.exec(filename.trim());
  if (!match) return null;
  const seat = `${Number(match[1])}-${Number(match[2])}`;
  if (!validSeatKey(seat)) return null;
  return { seat, format: match[3].toLowerCase() === "png" ? "png" : "jpeg" } as const;
}
export const seatPhonePattern = /^\+?[1-9]\d{6,14}$/;
export const seatProofID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type SeatRequest = {
  id: number;
  seats: string[];
  requestedCount: number;
  allocationMode: SeatingMode;
  status: SeatStatus;
  revision: number;
  createdAt: string;
  reviewedAt: string | null;
};

export type SeatReview = SeatRequest & {
  memberName: string;
  phone: string;
  proofs: string[];
  releasedSeats: { seat: string; releasedAt: string }[];
  addedSeats: { seat: string; addedAt: string }[];
};

export type SeatAssignment = {
  title: string;
  request: SeatRequest;
  rows: readonly SeatRow[];
  seatLimit: number;
  occupancy: Partial<Record<string, "pending" | "confirmed">>;
  blockedSeats: string[];
  missingSeats?: string[];
};

export type SeatingAvailability = {
  enabled: boolean;
  mode: SeatingMode;
  open: boolean;
  scheduled: boolean;
  opensAt: string | null;
  serverTime: number;
};

export type SeatingState = SeatingAvailability & {
  loggedIn: boolean;
  canReview: boolean;
  title: string;
  rows: readonly SeatRow[];
  seatLimit: number;
  proofLimit: number;
  proofBytes: number;
  occupancy: Partial<Record<string, "pending" | "confirmed">>;
  blockedSeats: string[];
  missingSeats?: string[];
  mine: SeatRequest | null;
  ticketImages: { seat: string; version: string; extension: "jpg" | "png" }[];
  mineDetails: { phone: string; proofs: string[]; canEdit: boolean } | null;
  drafts: string[];
};

export type SeatingWorkbench = SeatingAvailability & {
  title: string;
  docs: SeatReview[];
  page: number;
  hasNextPage: boolean;
};

export const seatAPI = (kind: SeatingKind, id: number) =>
  `/api/activities/${kind}/${id}/seating`;
