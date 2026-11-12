
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SeatWorkbench } from "@/components/activity-pages/SeatWorkbench";
import styles from "@/components/activity-pages/ActivityPages.module.css";
import { canReviewActivitySeats, seatActivity } from "@/lib/activity-seating";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "选座工作台", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const value = Number(id);
  if ((kind !== "events" && kind !== "community-posts") || !/^[1-9]\d*$/.test(id) || value > 2147483647)
    notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user))
    redirect(`/login?returnTo=${encodeURIComponent(`/activities/${kind}/${id}/seating`)}`);
  const activity = await seatActivity(p, kind, value, user).catch(() => null);
  if (!activity || !canReviewActivitySeats(user, activity.game)) notFound();
  return (
    <main className={styles.page}>
      <Link href={kind === "events" ? "/events" : "/community"}>返回活动列表</Link>
      <h1>选座工作台</h1>
      <p>{activity.title}</p>
      <SeatWorkbench kind={kind} id={value} />
    </main>
  );
}
