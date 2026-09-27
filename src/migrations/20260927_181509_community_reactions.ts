import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_community_reactions_target_type" AS ENUM('community-posts', 'forum-posts');
  CREATE TYPE "public"."enum_community_reactions_kind" AS ENUM('like', 'attend');
  ALTER TYPE "public"."enum_comments_target_type" ADD VALUE 'community-posts';
  CREATE TABLE "community_reactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target_type" "enum_community_reactions_target_type" NOT NULL,
  	"target_id" numeric NOT NULL,
  	"kind" "enum_community_reactions_kind" NOT NULL,
  	"author_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_reactions_id" integer;
  ALTER TABLE "community_reactions" ADD CONSTRAINT "community_reactions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "community_reactions_target_type_idx" ON "community_reactions" USING btree ("target_type");
  CREATE INDEX "community_reactions_target_id_idx" ON "community_reactions" USING btree ("target_id");
  CREATE INDEX "community_reactions_author_idx" ON "community_reactions" USING btree ("author_id");
  CREATE UNIQUE INDEX "community_reactions_key_idx" ON "community_reactions" USING btree ("key");
  CREATE INDEX "community_reactions_updated_at_idx" ON "community_reactions" USING btree ("updated_at");
  CREATE INDEX "community_reactions_created_at_idx" ON "community_reactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_reactions_fk" FOREIGN KEY ("community_reactions_id") REFERENCES "public"."community_reactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_community_reactions_id_idx" ON "payload_locked_documents_rels" USING btree ("community_reactions_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db;
  throw new Error("Preserve reactions and comments: restore a reviewed database backup for rollback.");
}
