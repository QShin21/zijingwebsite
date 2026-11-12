import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

/** New V2 controls only. Legacy site.modules and stored content stay untouched. */
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TYPE enum_site_home_sections_kind AS ENUM ('upcoming', 'open', 'notices', 'promoted', 'communities', 'highlights', 'about');
    CREATE TABLE site_home_sections (
      _order integer NOT NULL,
      _parent_id integer NOT NULL REFERENCES site(id) ON DELETE CASCADE,
      id varchar PRIMARY KEY NOT NULL,
      kind enum_site_home_sections_kind NOT NULL,
      enabled boolean DEFAULT true,
      title varchar
    );
    CREATE INDEX site_home_sections_order_idx ON site_home_sections(_order);
    CREATE INDEX site_home_sections_parent_id_idx ON site_home_sections(_parent_id);
  `);
}
export async function down() {
  throw new Error("保留 V2 主场区块配置；回滚应用时保留 additive 结构，不自动删除运营设置。");
}
