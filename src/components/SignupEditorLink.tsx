import type { UIFieldServerProps } from "payload";
export function SignupEditorLink({
  id,
  collectionSlug,
  data,
}: UIFieldServerProps) {
  if (collectionSlug === "community-posts" && data.category !== "event")
    return null;
  return (
    <div style={{ margin: "20px 0" }}>
      <strong>活动报名问卷</strong>
      <p>
        {id ? (
          <a
            href={`/activities/${collectionSlug}/${id}/manage`}
            target="_blank"
            rel="noopener noreferrer"
          >
            编辑报名问卷、查看报名名单 ↗
          </a>
        ) : (
          "请先保存活动草稿，再打开问卷编辑器。"
        )}
      </p>
    </div>
  );
}
