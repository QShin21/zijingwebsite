import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forum_posts" ADD COLUMN "pinned" boolean DEFAULT false;
  ALTER TABLE "forum_posts" ADD COLUMN "featured" boolean DEFAULT false;
  ALTER TABLE "forum_posts" ADD COLUMN "heat" numeric DEFAULT 0;
  CREATE INDEX "forum_posts_pinned_idx" ON "forum_posts" USING btree ("pinned");
  CREATE INDEX "forum_posts_featured_idx" ON "forum_posts" USING btree ("featured");
  CREATE INDEX "forum_posts_heat_idx" ON "forum_posts" USING btree ("heat");`)
  await db.execute(sql`
    CREATE FUNCTION community_forum_heat() RETURNS trigger AS $$
    DECLARE prior jsonb; upcoming jsonb;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        prior := to_jsonb(OLD);
        IF prior->>'target_type' = 'forum-posts' AND
          (TG_TABLE_NAME = 'community_reactions' OR prior->>'status' = 'visible') THEN
          UPDATE forum_posts SET heat = GREATEST(0, COALESCE(heat,0) - 1) WHERE id = (prior->>'target_id')::numeric;
        END IF;
      END IF;
      IF TG_OP <> 'DELETE' THEN
        upcoming := to_jsonb(NEW);
        IF upcoming->>'target_type' = 'forum-posts' AND
          (TG_TABLE_NAME = 'community_reactions' OR upcoming->>'status' = 'visible') THEN
          UPDATE forum_posts SET heat = COALESCE(heat,0) + 1 WHERE id = (upcoming->>'target_id')::numeric;
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER comments_forum_heat AFTER INSERT OR UPDATE OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION community_forum_heat();
    CREATE TRIGGER reactions_forum_heat AFTER INSERT OR UPDATE OR DELETE ON community_reactions FOR EACH ROW EXECUTE FUNCTION community_forum_heat();
    UPDATE forum_posts p SET heat =
      (SELECT COUNT(*) FROM comments c WHERE c.target_type = 'forum-posts' AND c.target_id = p.id AND c.status = 'visible') +
      (SELECT COUNT(*) FROM community_reactions r WHERE r.target_type = 'forum-posts' AND r.target_id = p.id);
  `);

}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TRIGGER comments_forum_heat ON comments;
    DROP TRIGGER reactions_forum_heat ON community_reactions;
    DROP FUNCTION community_forum_heat();
    ALTER TABLE forum_posts DROP COLUMN pinned, DROP COLUMN featured, DROP COLUMN heat;`);
}
