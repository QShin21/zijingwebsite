import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_account_status" AS ENUM('active', 'suspended');
  CREATE TYPE "public"."enum_community_applications_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_forum_posts_status" AS ENUM('visible', 'hidden');
  CREATE TYPE "public"."enum_community_messages_status" AS ENUM('visible', 'hidden');
  CREATE TYPE "public"."enum_community_posts_status" AS ENUM('visible', 'hidden');
  CREATE TYPE "public"."enum_community_posts_category" AS ENUM('event', 'notice');
  CREATE TYPE "public"."enum_comments_status" AS ENUM('visible', 'hidden');
  CREATE TYPE "public"."enum_comments_target_type" AS ENUM('events', 'albums', 'news', 'announcements', 'forum-posts');
  CREATE TYPE "public"."enum_games_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__games_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_teams_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__teams_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_seasons_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__seasons_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_honors_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__honors_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_events_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__events_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_recruitment_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__recruitment_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_news_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__news_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_announcements_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_announcements_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__announcements_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__announcements_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_albums_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__albums_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum_pages_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TYPE "public"."enum__pages_v_version_review_state" AS ENUM('editing', 'submitted', 'rejected', 'approved');
  CREATE TABLE "community_applications" (
  "id" serial PRIMARY KEY NOT NULL,
  "applicant_id" integer NOT NULL,
  "game_id" integer,
  "proposed_game" varchar NOT NULL,
  "reason" varchar NOT NULL,
  "status" "enum_community_applications_status" DEFAULT 'pending',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "community_bans" (
  "id" serial PRIMARY KEY NOT NULL,
  "game_id" integer NOT NULL,
  "member_id" integer NOT NULL,
  "active" boolean DEFAULT true,
  "reason" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "forum_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar NOT NULL,
  "body" varchar NOT NULL,
  "game_id" integer,
  "author_id" integer NOT NULL,
  "author_name" varchar,
  "status" "enum_forum_posts_status" DEFAULT 'visible',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "community_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "body" varchar NOT NULL,
  "game_id" integer,
  "author_id" integer NOT NULL,
  "author_name" varchar,
  "status" "enum_community_messages_status" DEFAULT 'visible',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "community_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar NOT NULL,
  "body" varchar NOT NULL,
  "game_id" integer,
  "author_id" integer NOT NULL,
  "author_name" varchar,
  "status" "enum_community_posts_status" DEFAULT 'visible',
  "category" "enum_community_posts_category" NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "body" varchar NOT NULL,
  "game_id" integer,
  "author_id" integer NOT NULL,
  "author_name" varchar,
  "status" "enum_comments_status" DEFAULT 'visible',
  "target_type" "enum_comments_target_type" NOT NULL,
  "target_id" numeric NOT NULL,
  "parent_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "announcements" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar,
  "slug" varchar,
  "summary" varchar,
  "body" jsonb,
  "cover_id" integer,
  "archived" boolean DEFAULT false,
  "demo" boolean DEFAULT false,
  "seo_title" varchar,
  "seo_description" varchar,
  "internal_notes" varchar,
  "submitted_by_id" integer,
  "review_state" "enum_announcements_review_state" DEFAULT 'editing',
  "published_at" timestamp(3) with time zone,
  "game_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "_status" "enum_announcements_status" DEFAULT 'draft'
  );

  CREATE TABLE "_announcements_v" (
  "id" serial PRIMARY KEY NOT NULL,
  "parent_id" integer,
  "version_title" varchar,
  "version_slug" varchar,
  "version_summary" varchar,
  "version_body" jsonb,
  "version_cover_id" integer,
  "version_archived" boolean DEFAULT false,
  "version_demo" boolean DEFAULT false,
  "version_seo_title" varchar,
  "version_seo_description" varchar,
  "version_internal_notes" varchar,
  "version_submitted_by_id" integer,
  "version_review_state" "enum__announcements_v_version_review_state" DEFAULT 'editing',
  "version_published_at" timestamp(3) with time zone,
  "version_game_id" integer,
  "version_updated_at" timestamp(3) with time zone,
  "version_created_at" timestamp(3) with time zone,
  "version__status" "enum__announcements_v_version_status" DEFAULT 'draft',
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "latest" boolean
  );

  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  -- Existing staff retain publishing rights, but no legacy account is made president.
  UPDATE "users_roles" SET "value" = CASE "value"
    WHEN 'admin' THEN 'vicePresident'
    WHEN 'publisher' THEN 'vicePresident'
    WHEN 'editor' THEN 'communityAdmin'
    WHEN 'leader' THEN 'communityAdmin'
    ELSE 'member' END;
  CREATE TYPE "public"."enum_users_roles" AS ENUM('president', 'vicePresident', 'communityAdmin', 'member');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  UPDATE "users" SET "name" = '成员' || "id"::text WHERE "name" IS NULL OR trim("name") = '';
  ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "account" varchar;
  UPDATE "users" SET "account" = '9' || lpad("id"::text, greatest(5, length("id"::text)), '0');
  ALTER TABLE "users" ALTER COLUMN "account" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "account_status" "enum_users_account_status" DEFAULT 'active';
  ALTER TABLE "users_rels" ADD COLUMN "games_id" integer;
  ALTER TABLE "games" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "games" ADD COLUMN "review_state" "enum_games_review_state" DEFAULT 'editing';
  ALTER TABLE "_games_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_games_v" ADD COLUMN "version_review_state" "enum__games_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "teams" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "teams" ADD COLUMN "review_state" "enum_teams_review_state" DEFAULT 'editing';
  ALTER TABLE "_teams_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_teams_v" ADD COLUMN "version_review_state" "enum__teams_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "seasons" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "seasons" ADD COLUMN "review_state" "enum_seasons_review_state" DEFAULT 'editing';
  ALTER TABLE "_seasons_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_seasons_v" ADD COLUMN "version_review_state" "enum__seasons_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "honors" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "honors" ADD COLUMN "review_state" "enum_honors_review_state" DEFAULT 'editing';
  ALTER TABLE "_honors_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_honors_v" ADD COLUMN "version_review_state" "enum__honors_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "events" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "events" ADD COLUMN "review_state" "enum_events_review_state" DEFAULT 'editing';
  ALTER TABLE "_events_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_events_v" ADD COLUMN "version_review_state" "enum__events_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "recruitment" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "recruitment" ADD COLUMN "review_state" "enum_recruitment_review_state" DEFAULT 'editing';
  ALTER TABLE "_recruitment_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_recruitment_v" ADD COLUMN "version_review_state" "enum__recruitment_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "news" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "news" ADD COLUMN "review_state" "enum_news_review_state" DEFAULT 'editing';
  ALTER TABLE "_news_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_news_v" ADD COLUMN "version_review_state" "enum__news_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "albums" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "albums" ADD COLUMN "review_state" "enum_albums_review_state" DEFAULT 'editing';
  ALTER TABLE "_albums_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_albums_v" ADD COLUMN "version_review_state" "enum__albums_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "pages" ADD COLUMN "submitted_by_id" integer;
  ALTER TABLE "pages" ADD COLUMN "review_state" "enum_pages_review_state" DEFAULT 'editing';
  ALTER TABLE "_pages_v" ADD COLUMN "version_submitted_by_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_review_state" "enum__pages_v_version_review_state" DEFAULT 'editing';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_applications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_bans_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "forum_posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_messages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "announcements_id" integer;
  ALTER TABLE "community_applications" ADD CONSTRAINT "community_applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_applications" ADD CONSTRAINT "community_applications_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_bans" ADD CONSTRAINT "community_bans_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_parent_id_announcements_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_announcements_v" ADD CONSTRAINT "_announcements_v_version_game_id_games_id_fk" FOREIGN KEY ("version_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "community_applications_applicant_idx" ON "community_applications" USING btree ("applicant_id");
  CREATE INDEX "community_applications_game_idx" ON "community_applications" USING btree ("game_id");
  CREATE INDEX "community_applications_updated_at_idx" ON "community_applications" USING btree ("updated_at");
  CREATE INDEX "community_applications_created_at_idx" ON "community_applications" USING btree ("created_at");
  CREATE INDEX "community_bans_game_idx" ON "community_bans" USING btree ("game_id");
  CREATE INDEX "community_bans_member_idx" ON "community_bans" USING btree ("member_id");
  CREATE INDEX "community_bans_updated_at_idx" ON "community_bans" USING btree ("updated_at");
  CREATE INDEX "community_bans_created_at_idx" ON "community_bans" USING btree ("created_at");
  CREATE INDEX "forum_posts_game_idx" ON "forum_posts" USING btree ("game_id");
  CREATE INDEX "forum_posts_author_idx" ON "forum_posts" USING btree ("author_id");
  CREATE INDEX "forum_posts_updated_at_idx" ON "forum_posts" USING btree ("updated_at");
  CREATE INDEX "forum_posts_created_at_idx" ON "forum_posts" USING btree ("created_at");
  CREATE INDEX "community_messages_game_idx" ON "community_messages" USING btree ("game_id");
  CREATE INDEX "community_messages_author_idx" ON "community_messages" USING btree ("author_id");
  CREATE INDEX "community_messages_updated_at_idx" ON "community_messages" USING btree ("updated_at");
  CREATE INDEX "community_messages_created_at_idx" ON "community_messages" USING btree ("created_at");
  CREATE INDEX "community_posts_game_idx" ON "community_posts" USING btree ("game_id");
  CREATE INDEX "community_posts_author_idx" ON "community_posts" USING btree ("author_id");
  CREATE INDEX "community_posts_updated_at_idx" ON "community_posts" USING btree ("updated_at");
  CREATE INDEX "community_posts_created_at_idx" ON "community_posts" USING btree ("created_at");
  CREATE INDEX "comments_game_idx" ON "comments" USING btree ("game_id");
  CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");
  CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE UNIQUE INDEX "announcements_slug_idx" ON "announcements" USING btree ("slug");
  CREATE INDEX "announcements_cover_idx" ON "announcements" USING btree ("cover_id");
  CREATE INDEX "announcements_submitted_by_idx" ON "announcements" USING btree ("submitted_by_id");
  CREATE INDEX "announcements_game_idx" ON "announcements" USING btree ("game_id");
  CREATE INDEX "announcements_updated_at_idx" ON "announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");
  CREATE INDEX "announcements__status_idx" ON "announcements" USING btree ("_status");
  CREATE INDEX "_announcements_v_parent_idx" ON "_announcements_v" USING btree ("parent_id");
  CREATE INDEX "_announcements_v_version_version_slug_idx" ON "_announcements_v" USING btree ("version_slug");
  CREATE INDEX "_announcements_v_version_version_cover_idx" ON "_announcements_v" USING btree ("version_cover_id");
  CREATE INDEX "_announcements_v_version_version_submitted_by_idx" ON "_announcements_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "_announcements_v_version_version_game_idx" ON "_announcements_v" USING btree ("version_game_id");
  CREATE INDEX "_announcements_v_version_version_updated_at_idx" ON "_announcements_v" USING btree ("version_updated_at");
  CREATE INDEX "_announcements_v_version_version_created_at_idx" ON "_announcements_v" USING btree ("version_created_at");
  CREATE INDEX "_announcements_v_version_version__status_idx" ON "_announcements_v" USING btree ("version__status");
  CREATE INDEX "_announcements_v_created_at_idx" ON "_announcements_v" USING btree ("created_at");
  CREATE INDEX "_announcements_v_updated_at_idx" ON "_announcements_v" USING btree ("updated_at");
  CREATE INDEX "_announcements_v_latest_idx" ON "_announcements_v" USING btree ("latest");
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_games_fk" FOREIGN KEY ("games_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games" ADD CONSTRAINT "games_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_games_v" ADD CONSTRAINT "_games_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "teams" ADD CONSTRAINT "teams_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_teams_v" ADD CONSTRAINT "_teams_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seasons" ADD CONSTRAINT "seasons_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_seasons_v" ADD CONSTRAINT "_seasons_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "honors" ADD CONSTRAINT "honors_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_honors_v" ADD CONSTRAINT "_honors_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recruitment" ADD CONSTRAINT "recruitment_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_recruitment_v" ADD CONSTRAINT "_recruitment_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "albums" ADD CONSTRAINT "albums_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_albums_v" ADD CONSTRAINT "_albums_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_submitted_by_id_users_id_fk" FOREIGN KEY ("version_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_applications_fk" FOREIGN KEY ("community_applications_id") REFERENCES "public"."community_applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_bans_fk" FOREIGN KEY ("community_bans_id") REFERENCES "public"."community_bans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forum_posts_fk" FOREIGN KEY ("forum_posts_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_messages_fk" FOREIGN KEY ("community_messages_id") REFERENCES "public"."community_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_posts_fk" FOREIGN KEY ("community_posts_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_account_idx" ON "users" USING btree ("account");
  CREATE INDEX "users_rels_games_id_idx" ON "users_rels" USING btree ("games_id");
  CREATE INDEX "games_submitted_by_idx" ON "games" USING btree ("submitted_by_id");
  CREATE INDEX "_games_v_version_version_submitted_by_idx" ON "_games_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "teams_submitted_by_idx" ON "teams" USING btree ("submitted_by_id");
  CREATE INDEX "_teams_v_version_version_submitted_by_idx" ON "_teams_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "seasons_submitted_by_idx" ON "seasons" USING btree ("submitted_by_id");
  CREATE INDEX "_seasons_v_version_version_submitted_by_idx" ON "_seasons_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "honors_submitted_by_idx" ON "honors" USING btree ("submitted_by_id");
  CREATE INDEX "_honors_v_version_version_submitted_by_idx" ON "_honors_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "events_submitted_by_idx" ON "events" USING btree ("submitted_by_id");
  CREATE INDEX "_events_v_version_version_submitted_by_idx" ON "_events_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "recruitment_submitted_by_idx" ON "recruitment" USING btree ("submitted_by_id");
  CREATE INDEX "_recruitment_v_version_version_submitted_by_idx" ON "_recruitment_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "news_submitted_by_idx" ON "news" USING btree ("submitted_by_id");
  CREATE INDEX "_news_v_version_version_submitted_by_idx" ON "_news_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "albums_submitted_by_idx" ON "albums" USING btree ("submitted_by_id");
  CREATE INDEX "_albums_v_version_version_submitted_by_idx" ON "_albums_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "pages_submitted_by_idx" ON "pages" USING btree ("submitted_by_id");
  CREATE INDEX "_pages_v_version_version_submitted_by_idx" ON "_pages_v" USING btree ("version_submitted_by_id");
  CREATE INDEX "payload_locked_documents_rels_community_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("community_applications_id");
  CREATE INDEX "payload_locked_documents_rels_community_bans_id_idx" ON "payload_locked_documents_rels" USING btree ("community_bans_id");
  CREATE INDEX "payload_locked_documents_rels_forum_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("forum_posts_id");
  CREATE INDEX "payload_locked_documents_rels_community_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("community_messages_id");
  CREATE INDEX "payload_locked_documents_rels_community_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("community_posts_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");`)
  // The six-digit code store is deliberately server-only and is not exposed as a Payload collection.
  await db.execute(sql`
    CREATE TABLE auth_codes (
      key text PRIMARY KEY,
      digest text NOT NULL,
      expires_at timestamptz NOT NULL,
      last_sent timestamptz NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      consumed_at timestamptz
    );
    CREATE INDEX auth_codes_expires_at_idx ON auth_codes (expires_at);
    CREATE TABLE auth_rate_limits (
      key text PRIMARY KEY,
      window_start timestamptz NOT NULL,
      hits integer NOT NULL DEFAULT 0
    );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS auth_codes; DROP TABLE IF EXISTS auth_rate_limits;`)
  await db.execute(sql`
   ALTER TABLE "community_applications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community_bans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forum_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "announcements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_announcements_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "community_applications" CASCADE;
  DROP TABLE "community_bans" CASCADE;
  DROP TABLE "forum_posts" CASCADE;
  DROP TABLE "community_messages" CASCADE;
  DROP TABLE "community_posts" CASCADE;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "announcements" CASCADE;
  DROP TABLE "_announcements_v" CASCADE;
  ALTER TABLE "users_rels" DROP CONSTRAINT "users_rels_games_fk";

  ALTER TABLE "games" DROP CONSTRAINT "games_submitted_by_id_users_id_fk";

  ALTER TABLE "_games_v" DROP CONSTRAINT "_games_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "teams" DROP CONSTRAINT "teams_submitted_by_id_users_id_fk";

  ALTER TABLE "_teams_v" DROP CONSTRAINT "_teams_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "seasons" DROP CONSTRAINT "seasons_submitted_by_id_users_id_fk";

  ALTER TABLE "_seasons_v" DROP CONSTRAINT "_seasons_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "honors" DROP CONSTRAINT "honors_submitted_by_id_users_id_fk";

  ALTER TABLE "_honors_v" DROP CONSTRAINT "_honors_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "events" DROP CONSTRAINT "events_submitted_by_id_users_id_fk";

  ALTER TABLE "_events_v" DROP CONSTRAINT "_events_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "recruitment" DROP CONSTRAINT "recruitment_submitted_by_id_users_id_fk";

  ALTER TABLE "_recruitment_v" DROP CONSTRAINT "_recruitment_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "news" DROP CONSTRAINT "news_submitted_by_id_users_id_fk";

  ALTER TABLE "_news_v" DROP CONSTRAINT "_news_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "albums" DROP CONSTRAINT "albums_submitted_by_id_users_id_fk";

  ALTER TABLE "_albums_v" DROP CONSTRAINT "_albums_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "pages" DROP CONSTRAINT "pages_submitted_by_id_users_id_fk";

  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_submitted_by_id_users_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_applications_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_bans_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_forum_posts_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_messages_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_posts_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_announcements_fk";

  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  UPDATE "users_roles" SET "value" = CASE "value"
    WHEN 'president' THEN 'admin'
    WHEN 'vicePresident' THEN 'publisher'
    WHEN 'communityAdmin' THEN 'editor'
    ELSE 'editor' END;
  CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'editor', 'publisher', 'leader');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  DROP INDEX "users_account_idx";
  DROP INDEX "users_rels_games_id_idx";
  DROP INDEX "games_submitted_by_idx";
  DROP INDEX "_games_v_version_version_submitted_by_idx";
  DROP INDEX "teams_submitted_by_idx";
  DROP INDEX "_teams_v_version_version_submitted_by_idx";
  DROP INDEX "seasons_submitted_by_idx";
  DROP INDEX "_seasons_v_version_version_submitted_by_idx";
  DROP INDEX "honors_submitted_by_idx";
  DROP INDEX "_honors_v_version_version_submitted_by_idx";
  DROP INDEX "events_submitted_by_idx";
  DROP INDEX "_events_v_version_version_submitted_by_idx";
  DROP INDEX "recruitment_submitted_by_idx";
  DROP INDEX "_recruitment_v_version_version_submitted_by_idx";
  DROP INDEX "news_submitted_by_idx";
  DROP INDEX "_news_v_version_version_submitted_by_idx";
  DROP INDEX "albums_submitted_by_idx";
  DROP INDEX "_albums_v_version_version_submitted_by_idx";
  DROP INDEX "pages_submitted_by_idx";
  DROP INDEX "_pages_v_version_version_submitted_by_idx";
  DROP INDEX "payload_locked_documents_rels_community_applications_id_idx";
  DROP INDEX "payload_locked_documents_rels_community_bans_id_idx";
  DROP INDEX "payload_locked_documents_rels_forum_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_community_messages_id_idx";
  DROP INDEX "payload_locked_documents_rels_community_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_announcements_id_idx";
  ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "users" DROP COLUMN "account";
  ALTER TABLE "users" DROP COLUMN "account_status";
  ALTER TABLE "users_rels" DROP COLUMN "games_id";
  ALTER TABLE "games" DROP COLUMN "submitted_by_id";
  ALTER TABLE "games" DROP COLUMN "review_state";
  ALTER TABLE "_games_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_games_v" DROP COLUMN "version_review_state";
  ALTER TABLE "teams" DROP COLUMN "submitted_by_id";
  ALTER TABLE "teams" DROP COLUMN "review_state";
  ALTER TABLE "_teams_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_teams_v" DROP COLUMN "version_review_state";
  ALTER TABLE "seasons" DROP COLUMN "submitted_by_id";
  ALTER TABLE "seasons" DROP COLUMN "review_state";
  ALTER TABLE "_seasons_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_seasons_v" DROP COLUMN "version_review_state";
  ALTER TABLE "honors" DROP COLUMN "submitted_by_id";
  ALTER TABLE "honors" DROP COLUMN "review_state";
  ALTER TABLE "_honors_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_honors_v" DROP COLUMN "version_review_state";
  ALTER TABLE "events" DROP COLUMN "submitted_by_id";
  ALTER TABLE "events" DROP COLUMN "review_state";
  ALTER TABLE "_events_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_events_v" DROP COLUMN "version_review_state";
  ALTER TABLE "recruitment" DROP COLUMN "submitted_by_id";
  ALTER TABLE "recruitment" DROP COLUMN "review_state";
  ALTER TABLE "_recruitment_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_recruitment_v" DROP COLUMN "version_review_state";
  ALTER TABLE "news" DROP COLUMN "submitted_by_id";
  ALTER TABLE "news" DROP COLUMN "review_state";
  ALTER TABLE "_news_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_news_v" DROP COLUMN "version_review_state";
  ALTER TABLE "albums" DROP COLUMN "submitted_by_id";
  ALTER TABLE "albums" DROP COLUMN "review_state";
  ALTER TABLE "_albums_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_albums_v" DROP COLUMN "version_review_state";
  ALTER TABLE "pages" DROP COLUMN "submitted_by_id";
  ALTER TABLE "pages" DROP COLUMN "review_state";
  ALTER TABLE "_pages_v" DROP COLUMN "version_submitted_by_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_review_state";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_applications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_bans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "forum_posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_messages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "announcements_id";
  DROP TYPE "public"."enum_users_account_status";
  DROP TYPE "public"."enum_community_applications_status";
  DROP TYPE "public"."enum_forum_posts_status";
  DROP TYPE "public"."enum_community_messages_status";
  DROP TYPE "public"."enum_community_posts_status";
  DROP TYPE "public"."enum_community_posts_category";
  DROP TYPE "public"."enum_comments_status";
  DROP TYPE "public"."enum_comments_target_type";
  DROP TYPE "public"."enum_games_review_state";
  DROP TYPE "public"."enum__games_v_version_review_state";
  DROP TYPE "public"."enum_teams_review_state";
  DROP TYPE "public"."enum__teams_v_version_review_state";
  DROP TYPE "public"."enum_seasons_review_state";
  DROP TYPE "public"."enum__seasons_v_version_review_state";
  DROP TYPE "public"."enum_honors_review_state";
  DROP TYPE "public"."enum__honors_v_version_review_state";
  DROP TYPE "public"."enum_events_review_state";
  DROP TYPE "public"."enum__events_v_version_review_state";
  DROP TYPE "public"."enum_recruitment_review_state";
  DROP TYPE "public"."enum__recruitment_v_version_review_state";
  DROP TYPE "public"."enum_news_review_state";
  DROP TYPE "public"."enum__news_v_version_review_state";
  DROP TYPE "public"."enum_announcements_review_state";
  DROP TYPE "public"."enum_announcements_status";
  DROP TYPE "public"."enum__announcements_v_version_review_state";
  DROP TYPE "public"."enum__announcements_v_version_status";
  DROP TYPE "public"."enum_albums_review_state";
  DROP TYPE "public"."enum__albums_v_version_review_state";
  DROP TYPE "public"."enum_pages_review_state";
  DROP TYPE "public"."enum__pages_v_version_review_state";`)
}
