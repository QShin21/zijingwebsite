import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION notify_community_chat() RETURNS trigger AS $$
    BEGIN
      IF TG_OP <> 'DELETE' THEN
        PERFORM pg_notify('community_chat_changed', NEW.game_id::text);
      END IF;
      IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.game_id IS DISTINCT FROM NEW.game_id) THEN
        PERFORM pg_notify('community_chat_changed', OLD.game_id::text);
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER community_chat_changed
      AFTER INSERT OR UPDATE OR DELETE ON community_messages
      FOR EACH ROW EXECUTE FUNCTION notify_community_chat();
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS community_chat_changed ON community_messages;
    DROP FUNCTION IF EXISTS notify_community_chat();
  `);
}
