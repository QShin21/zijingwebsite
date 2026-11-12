import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, canReviewShowcase } from "@/lib/rules";
import { ShowcaseForm } from "@/components/ShowcaseForm";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import work from "@/components/v2/work.module.css";

export const metadata = { title: "分享社群风采", robots: { index: false, follow: false } };

export default async function NewShowcase({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  if (!canParticipate(user)) {
    redirect(`/login?returnTo=${encodeURIComponent(`/community/${slug}/showcase/new`)}`);
  }
  const base = `/community/${slug}/showcase`;
  return (
    <TaskFrame
      eyebrow={`${game.title} · 社群风采`}
      title="分享社群风采"
      description="记录共同经历，分享你有权发布的活动照片与视频。"
      back={{ href: base, label: "社群风采" }}
      steps={["填写标题与内容", "添加照片或视频", "提交并等待展示"]}
      aside={
        <TaskNote title={`记录${game.title}的共同经历`} links={[{ href: `${base}?view=mine`, label: "我的投稿" }]}>
          <p>标题必填，文字、照片与视频按实际情况补充。提交后可在“我的投稿”查看记录与审核状态。</p>
        </TaskNote>
      }
    >
      <section className={work.panel} aria-label="分享社群风采">
        <ShowcaseForm game={game.id} slug={slug} manager={canReviewShowcase(user, game.id)} />
      </section>
    </TaskFrame>
  );
}
