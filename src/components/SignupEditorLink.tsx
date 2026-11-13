import type { UIFieldServerProps } from "payload";
import { getT } from "@/lib/i18n/server";
export async function SignupEditorLink({
  id,
  collectionSlug,
  data,
}: UIFieldServerProps) {
  if (collectionSlug === "community-posts" && data.category !== "event")
    return null;
  const { t } = await getT();
  return (
    <div style={{ margin: "20px 0" }}>
      <strong>{t("活动报名问卷", "Activity sign-up questionnaire")}</strong>
      <p>
        {id ? (
          <a
            href={`/activities/${collectionSlug}/${id}/manage`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("编辑报名问卷、查看报名名单 ↗", "Edit the questionnaire and view sign-ups ↗")}
          </a>
        ) : (
          t("请先保存活动草稿，再打开问卷编辑器。", "Save the activity draft before opening the questionnaire editor.")
        )}
      </p>
    </div>
  );
}
