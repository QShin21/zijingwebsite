import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame } from "@/lib/rules";
import { CommunityActivityComposer } from "@/components/CommunityActivityComposer";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import work from "@/components/v2/work.module.css";

export const metadata = { title: "发布活动与通知", robots: { index: false, follow: false } };

export default async function NewCommunityUpdate({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  if (!managesGame(user, game.id)) notFound();
  const updates = `/community/${slug}/updates`;

  return (
    <TaskFrame
      eyebrow={`${game.title} · 活动与通知`}
      title="发布活动与通知"
      description="发布范围为当前游戏社群。活动可配置报名问卷，通知用于发布安排与说明。"
      back={{ href: updates, label: "活动与通知" }}
      steps={["选择活动或通知", "填写内容与报名问卷", "发布到社群"]}
      aside={
        <TaskNote title={`发布到${game.title}`} links={[{ href: updates, label: "查看已发布内容" }]}>
          <p>选择活动或通知，填写标题与内容。发布后，同学可在社群的活动与通知页面查看。</p>
          <p>需要社团首页展示时，发布后在内容页申请社团级展示。</p>
        </TaskNote>
      }
    >
      <section className={work.panel} aria-label="发布内容">
        <CommunityActivityComposer game={game.id} />
      </section>
    </TaskFrame>
  );
}
