
export type SeatingKind = "events" | "community-posts";
export type SeatStatus = "pending" | "confirmed" | "rejected";
export type SeatDecision = Exclude<SeatStatus, "pending">;
export const seatLimit = 10;
export const seatProofLimit = 10;
export const seatProofBytes = 8 * 1024 * 1024;
export const seatStatusLabels: Record<SeatStatus, string> = {
  pending: "待审核",
  confirmed: "已确认",
  rejected: "已驳回",
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
export const seatPhonePattern = /^\+?[1-9]\d{6,14}$/;
export const seatProofID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type SeatRequest = {
  id: number;
  seats: string[];
  status: SeatStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export type SeatReview = SeatRequest & {
  memberName: string;
  phone: string;
  proofs: string[];
};

export type SeatingState = {
  enabled: boolean;
  open: boolean;
  loggedIn: boolean;
  canReview: boolean;
  title: string;
  rows: typeof seatRows;
  seatLimit: number;
  proofLimit: number;
  proofBytes: number;
  occupancy: Partial<Record<string, Exclude<SeatStatus, "rejected">>>;
  mine: SeatRequest | null;
  drafts: string[];
};

export type SeatingWorkbench = {
  title: string;
  enabled: boolean;
  docs: SeatReview[];
  page: number;
  hasNextPage: boolean;
};

export const seatAPI = (kind: SeatingKind, id: number) =>
  `/api/activities/${kind}/${id}/seating`;
