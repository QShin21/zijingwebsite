import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, canReviewShowcase } from "@/lib/rules";
import { ShowcaseForm } from "@/components/ShowcaseForm";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("分享社群风采", "Share to showcase"), robots: { index: false, follow: false } };
}

export default async function NewShowcase({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getT();
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  if (!canParticipate(user)) {
    redirect(`/login?returnTo=${encodeURIComponent(`/community/${slug}/showcase/new`)}`);
  }
  const base = `/community/${slug}/showcase`;
  return (
    <TaskFrame
      eyebrow={t(`${game.title} · 社群风采`, `${game.title} · Showcase`)}
      title={t("分享社群风采", "Share to showcase")}
      description={t("记录共同经历，分享你有权发布的活动照片与视频。", "Record shared moments with activity photos and videos you have the right to publish.")}
      back={{ href: base, label: t("社群风采", "Showcase") }}
      steps={[t("填写标题与内容", "Title and text"), t("添加照片或视频", "Add photos or video"), t("提交并等待展示", "Submit for review")]}
      aside={
        <TaskNote title={t(`记录${game.title}的共同经历`, `Record a ${game.title} moment`)} links={[{ href: `${base}?view=mine`, label: t("我的投稿", "My posts") }]}>
          <p>{t("标题必填，文字、照片与视频按实际情况补充。提交后可在“我的投稿”查看记录与审核状态。", "A title is required; add text, photos and video as needed. After submitting, check status under “My posts”.")}</p>
        </TaskNote>
      }
    >
      <section className={work.panel} aria-label={t("分享社群风采", "Share to showcase")}>
        <ShowcaseForm game={game.id} slug={slug} manager={canReviewShowcase(user, game.id)} />
      </section>
    </TaskFrame>
  );
}
