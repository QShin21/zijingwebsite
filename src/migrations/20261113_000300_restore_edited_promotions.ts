import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Only reverse the automatic edit-triggered withdrawal of previously approved
// records. Explicit demotions and deletions retain their existing state.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    UPDATE content_promotions AS p
    SET status = 'approved',
        kind = CASE WHEN p.source_collection = 'community-posts'
          THEN (SELECT CASE WHEN c.category::text = 'event' THEN 'event'::enum_content_promotions_kind ELSE 'notice'::enum_content_promotions_kind END
                FROM community_posts AS c WHERE c.id = p.source_i_d)
          ELSE 'showcase'::enum_content_promotions_kind END,
        review_note = '已恢复升推，后续修改无需重新申请。',
        history = COALESCE(p.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'action', 'restoreAfterEdit', 'actor', 'system', 'actorName', '系统',
          'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'from', 'needsReview', 'to', 'approved', 'reason', '已恢复编辑前的升推状态', 'version', p.approved_version)),
        updated_at = now()
    WHERE p.status = 'needsReview' AND p.approved_version IS NOT NULL AND p.approved_at IS NOT NULL
      AND p.history->-1->>'action' = 'sourceChanged'
      AND ((p.source_collection = 'community-posts' AND EXISTS (SELECT 1 FROM community_posts c WHERE c.id = p.source_i_d))
        OR (p.source_collection = 'community-showcase' AND EXISTS (SELECT 1 FROM community_showcase s WHERE s.id = p.source_i_d)));
  `);
}

export async function down() {
  throw new Error("保留恢复后的升推记录及其历史。");
}
