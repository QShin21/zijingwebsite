import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_community_showcase_status" AS ENUM('visible', 'hidden', 'pending', 'rejected');
  CREATE TABLE "community_showcase_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" varchar NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "community_showcase" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"game_id" integer,
  	"author_id" integer NOT NULL,
  	"author_name" varchar,
  	"status" "enum_community_showcase_status" DEFAULT 'visible',
  	"video_u_r_l" varchar,
  	"review_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_showcase_id" integer;
  ALTER TABLE "community_showcase_images" ADD CONSTRAINT "community_showcase_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."community_showcase"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "community_showcase" ADD CONSTRAINT "community_showcase_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_showcase" ADD CONSTRAINT "community_showcase_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "community_showcase_images_order_idx" ON "community_showcase_images" USING btree ("_order");
  CREATE INDEX "community_showcase_images_parent_id_idx" ON "community_showcase_images" USING btree ("_parent_id");
  CREATE INDEX "community_showcase_game_idx" ON "community_showcase" USING btree ("game_id");
  CREATE INDEX "community_showcase_author_idx" ON "community_showcase" USING btree ("author_id");
  CREATE INDEX "community_showcase_updated_at_idx" ON "community_showcase" USING btree ("updated_at");
  CREATE INDEX "community_showcase_created_at_idx" ON "community_showcase" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_showcase_fk" FOREIGN KEY ("community_showcase_id") REFERENCES "public"."community_showcase"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_community_showcase_id_idx" ON "payload_locked_documents_rels" USING btree ("community_showcase_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db;
  throw new Error("Preserve community submissions: restore a reviewed backup to roll back.");
}
