import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame } from "@/lib/rules";
import { CommunityActivityComposer } from "@/components/CommunityActivityComposer";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("发布活动与通知", "Post events and notices"), robots: { index: false, follow: false } };
}

export default async function NewCommunityUpdate({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getT();
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  if (!managesGame(user, game.id)) notFound();
  const updates = `/community/${slug}/updates`;

  return (
    <TaskFrame
      eyebrow={t(`${game.title} · 活动与通知`, `${game.title} · Events and notices`)}
      title={t("发布活动与通知", "Post events and notices")}
      description={t("发布范围为当前游戏社群。活动可配置报名问卷，通知用于发布安排与说明。", "Posts go to this game community. Events can include a sign-up questionnaire; notices share plans and information.")}
      back={{ href: updates, label: t("活动与通知", "Events and notices") }}
      steps={[t("选择活动或通知", "Choose event or notice"), t("填写内容与报名问卷", "Write content and sign-up form"), t("发布到社群", "Publish to community")]}
      aside={
        <TaskNote title={t(`发布到${game.title}`, `Publish to ${game.title}`)} links={[{ href: updates, label: t("查看已发布内容", "View published posts") }]}>
          <p>{t("选择活动或通知，填写标题与内容。发布后，同学可在社群的活动与通知页面查看。", "Choose event or notice and enter a title and content. Once published, members can find it on the community's events and notices page.")}</p>
          <p>{t("需要社团首页展示时，发布后在内容页申请社团级展示。", "To feature it on the club front page, request promotion from the post page after publishing.")}</p>
        </TaskNote>
      }
    >
      <section className={work.panel} aria-label={t("发布内容", "Publish content")}>
        <CommunityActivityComposer game={game.id} />
      </section>
    </TaskFrame>
  );
}
