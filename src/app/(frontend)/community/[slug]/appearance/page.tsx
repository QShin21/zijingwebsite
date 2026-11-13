import { read, ViewError } from "@/components/v2/data";
import { notFound } from "next/navigation";
import { getCommunityIconEditor } from "@/lib/community-icons";
import { CommunityIconEditor } from "@/components/CommunityIconEditor";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("修改社群图标", "Edit community icon"), robots: { index: false, follow: false } };
}
export default async function CommunityAppearance({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { t } = await getT();
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
      title={t("修改社群图标", "Edit community icon")}
      description={t("上传对应游戏的图标，调整位置与大小。保存后会显示在社群卡片和社群页顶部。", "Upload the game's icon and adjust its position and size. It appears on the community card and page header after saving.")}
      back={{ href: `/community/${slug}`, label: t("返回社群", "Back to community") }}
      steps={[t("选择图片", "Choose image"), t("调整裁切与预览", "Crop and preview"), t("保存图标", "Save icon")]}
      aside={
        <TaskNote title={t("图片建议", "Image tips")}>
          <p>
            {t("支持 PNG、JPEG、WebP，最大 4 MB。推荐使用清晰的游戏标志或方形图标。", "PNG, JPEG or WebP, up to 4 MB. A clear game logo or square icon works best.")}
          </p>
          <p>{t("裁切为正方形。保留的原图可用于之后重新调整，透明背景会保留。", "Cropped to a square. The original is kept for later adjustments, and transparency is preserved.")}</p>
        </TaskNote>
      }
    >
      <section className={work.panel} aria-label={t("社群图标编辑", "Community icon editor")}>
        <CommunityIconEditor slug={slug} initial={state} />
      </section>
    </TaskFrame>
  );
}
