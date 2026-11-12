import { read, ViewError } from "@/components/v2/data";
import { notFound } from "next/navigation";
import { getCommunityIconEditor } from "@/lib/community-icons";
import { CommunityIconEditor } from "@/components/CommunityIconEditor";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import work from "@/components/v2/work.module.css";

export const metadata = {
  title: "修改社群图标",
  robots: { index: false, follow: false },
};
export default async function CommunityAppearance({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let state;
  try {
    state = await read(
      getCommunityIconEditor,
      { slug },
      `/community/${slug}/appearance`,
    );
  } catch (error) {
    if (error instanceof ViewError && error.status === 403) notFound();
    throw error;
  }
  return (
    <TaskFrame
      eyebrow={state.title}
      title="修改社群图标"
      description="上传对应游戏的图标，调整位置与大小。保存后会显示在社群卡片和社群页顶部。"
      back={{ href: `/community/${slug}`, label: "返回社群" }}
      steps={["选择图片", "调整裁切与预览", "保存图标"]}
      aside={
        <TaskNote title="图片建议">
          <p>
            支持 PNG、JPEG、WebP，最大 4 MB。推荐使用清晰的游戏标志或方形图标。
          </p>
          <p>裁切为正方形。保留的原图可用于之后重新调整，透明背景会保留。</p>
        </TaskNote>
      }
    >
      <section className={work.panel} aria-label="社群图标编辑">
        <CommunityIconEditor slug={slug} initial={state} />
      </section>
    </TaskFrame>
  );
}
