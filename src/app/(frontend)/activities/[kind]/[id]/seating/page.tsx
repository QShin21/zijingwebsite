import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { SeatWorkbench } from "@/components/activity-pages/SeatWorkbench";
import { TaskFrame } from "@/components/v2/TaskFrame";
import { Notice } from "@/components/v2/ui";
import { canReviewActivitySeats, seatActivity } from "@/lib/activity-seating";
import type { SeatingKind } from "@/lib/activity-seating-model";
import { cms } from "@/lib/content";
import { canParticipate, relationID } from "@/lib/rules";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("选座工作台", "Seating workbench"), robots: { index: false, follow: false } };
}

/** Back link to the V2 event page; falls back to the list when the slug is not readable. */
async function activityHref(p: Payload, kind: SeatingKind, id: number, game: unknown, user: User | null) {
  const fallback = kind === "events" ? "/events" : "/community";
  try {
    if (kind === "events") {
      const event = await p.findByID({
        collection: "events",
        id,
        user,
        overrideAccess: false,
        draft: false,
        depth: 0,
        disableErrors: true,
        select: { slug: true },
      });
      return event?.slug ? `/events/${encodeURIComponent(event.slug)}` : fallback;
    }
    const gameID = relationID(game);
    if (typeof gameID !== "number") return fallback;
    const community = await p.findByID({
      collection: "games",
      id: gameID,
      user,
      overrideAccess: false,
      draft: false,
      depth: 0,
      disableErrors: true,
      select: { slug: true },
    });
    return community?.slug ? `/community/${encodeURIComponent(community.slug)}/updates/${id}` : fallback;
  } catch {
    return fallback;
  }
}

/** Reviewer workbench. Same server gate as the API: member session, then review rights on this activity. */
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const value = Number(id);
  if ((kind !== "events" && kind !== "community-posts") || !/^[1-9]\d*$/.test(id) || value > 2147483647) notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user)) redirect(`/login?returnTo=${encodeURIComponent(`/activities/${kind}/${id}/seating`)}`);
  const activity = await seatActivity(p, kind, value, user).catch(() => null);
  if (!activity || !canReviewActivitySeats(user, activity.game)) notFound();
  const href = await activityHref(p, kind, value, activity.game, user);
  const { t } = await getT();
  return (
    <TaskFrame
      wide
      eyebrow={kind === "events" ? t("SEATING · 社团活动选座", "SEATING · Club activity") : t("SEATING · 社群活动选座", "SEATING · Community activity")}
      title={activity.title}
      description={t("核对成员提交的手机号与活动参与凭证：通过后锁定座位，驳回后释放座位。手机号与凭证仅用于本活动审核。", "Check members' phone numbers and participation proofs: approving locks seats, rejecting releases them. Phone numbers and proofs are used only for this review.")}
      back={{ href, label: t("返回活动", "Back to activity") }}
    >
      {!activity.public && <Notice tone="warning">{t("活动当前未公开：成员看不到座位图，也不能开启选座；已有申请仍可在此审核。", "This activity is not public: members cannot see the seat map and seating cannot be opened. Existing requests can still be reviewed here.")}</Notice>}
      <SeatWorkbench kind={kind} id={value} />
    </TaskFrame>
  );
}
