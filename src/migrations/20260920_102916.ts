import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'editor', 'publisher', 'leader');
  CREATE TYPE "public"."enum_games_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__games_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_teams_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__teams_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_seasons_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__seasons_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_honors_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__honors_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_events_type" AS ENUM('比赛', '观赛', '交流', '训练', '其他');
  CREATE TYPE "public"."enum_events_lifecycle" AS ENUM('scheduled', 'cancelled', 'postponed', 'ended');
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_type" AS ENUM('比赛', '观赛', '交流', '训练', '其他');
  CREATE TYPE "public"."enum__events_v_version_lifecycle" AS ENUM('scheduled', 'cancelled', 'postponed', 'ended');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_recruitment_kind" AS ENUM('members', 'teams', 'staff');
  CREATE TYPE "public"."enum_recruitment_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__recruitment_v_version_kind" AS ENUM('members', 'teams', 'staff');
  CREATE TYPE "public"."enum__recruitment_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_news_type" AS ENUM('公告', '新闻', '回顾', '人物故事');
  CREATE TYPE "public"."enum_news_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_version_type" AS ENUM('公告', '新闻', '回顾', '人物故事');
  CREATE TYPE "public"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_albums_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__albums_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_key" AS ENUM('about', 'contact', 'privacy', 'join', 'join-members', 'join-teams', 'join-staff');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_key" AS ENUM('about', 'contact', 'privacy', 'join', 'join-members', 'join-teams', 'join-staff');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_navigation_path" AS ENUM('/about', '/events', '/teams', '/honors', '/join', '/news', '/gallery', '/contact');
  CREATE TYPE "public"."enum_site_modules_kind" AS ENUM('join', 'events', 'teams', 'honors', 'news', 'albums', 'about');
  CREATE TABLE "users_roles" (
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "value" "enum_users_roles",
    "id" serial PRIMARY KEY NOT NULL
  );

  CREATE TABLE "users_sessions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "created_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "email" varchar NOT NULL,
    "reset_password_token" varchar,
    "reset_password_expiration" timestamp(3) with time zone,
    "salt" varchar,
    "hash" varchar,
    "reset_password_requested_at" timestamp(3) with time zone,
    "login_attempts" numeric DEFAULT 0,
    "lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "users_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "teams_id" integer
  );

  CREATE TABLE "media" (
    "id" serial PRIMARY KEY NOT NULL,
    "alt" varchar NOT NULL,
    "credit" varchar NOT NULL,
    "demo" boolean,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric,
    "focal_x" numeric,
    "focal_y" numeric,
    "sizes_card_url" varchar,
    "sizes_card_width" numeric,
    "sizes_card_height" numeric,
    "sizes_card_mime_type" varchar,
    "sizes_card_filesize" numeric,
    "sizes_card_filename" varchar
  );

  CREATE TABLE "games" (
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
    "sort" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_games_status" DEFAULT 'draft'
  );

  CREATE TABLE "_games_v" (
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
    "version_sort" numeric,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__games_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "teams" (
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
    "game_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_teams_status" DEFAULT 'draft'
  );

  CREATE TABLE "_teams_v" (
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
    "version_game_id" integer,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__teams_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "seasons_members" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "display_name" varchar,
    "position" varchar,
    "consent" boolean DEFAULT false
  );

  CREATE TABLE "seasons" (
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
    "team_id" integer,
    "season" varchar,
    "start_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_seasons_status" DEFAULT 'draft'
  );

  CREATE TABLE "_seasons_v_version_members" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar,
    "position" varchar,
    "consent" boolean DEFAULT false,
    "_uuid" varchar
  );

  CREATE TABLE "_seasons_v" (
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
    "version_team_id" integer,
    "version_season" varchar,
    "version_start_at" timestamp(3) with time zone,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__seasons_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "honors" (
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
    "team_id" integer,
    "season_id" integer,
    "game_id" integer,
    "competition" varchar,
    "division" varchar,
    "placing" varchar,
    "date" timestamp(3) with time zone,
    "source_u_r_l" varchar,
    "verified" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_honors_status" DEFAULT 'draft'
  );

  CREATE TABLE "_honors_v" (
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
    "version_team_id" integer,
    "version_season_id" integer,
    "version_game_id" integer,
    "version_competition" varchar,
    "version_division" varchar,
    "version_placing" varchar,
    "version_date" timestamp(3) with time zone,
    "version_source_u_r_l" varchar,
    "version_verified" boolean DEFAULT false,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__honors_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "events" (
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
    "type" "enum_events_type",
    "game_id" integer,
    "team_id" integer,
    "start_at" timestamp(3) with time zone,
    "end_at" timestamp(3) with time zone,
    "location" varchar,
    "lifecycle" "enum_events_lifecycle" DEFAULT 'scheduled',
    "registration_start" timestamp(3) with time zone,
    "registration_end" timestamp(3) with time zone,
    "registration_closed" boolean,
    "registration_u_r_l" varchar,
    "channel_text" varchar,
    "qr_code_id" integer,
    "channel_checked_at" timestamp(3) with time zone,
    "contact" varchar,
    "requirements" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_events_status" DEFAULT 'draft'
  );

  CREATE TABLE "_events_v" (
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
    "version_type" "enum__events_v_version_type",
    "version_game_id" integer,
    "version_team_id" integer,
    "version_start_at" timestamp(3) with time zone,
    "version_end_at" timestamp(3) with time zone,
    "version_location" varchar,
    "version_lifecycle" "enum__events_v_version_lifecycle" DEFAULT 'scheduled',
    "version_registration_start" timestamp(3) with time zone,
    "version_registration_end" timestamp(3) with time zone,
    "version_registration_closed" boolean,
    "version_registration_u_r_l" varchar,
    "version_channel_text" varchar,
    "version_qr_code_id" integer,
    "version_channel_checked_at" timestamp(3) with time zone,
    "version_contact" varchar,
    "version_requirements" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__events_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "recruitment_positions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "name" varchar,
    "duties" varchar,
    "requirements" varchar,
    "commitment" varchar,
    "arrangement" varchar
  );

  CREATE TABLE "recruitment" (
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
    "kind" "enum_recruitment_kind",
    "game_id" integer,
    "registration_start" timestamp(3) with time zone,
    "registration_end" timestamp(3) with time zone,
    "registration_closed" boolean,
    "registration_u_r_l" varchar,
    "channel_text" varchar,
    "qr_code_id" integer,
    "channel_checked_at" timestamp(3) with time zone,
    "contact" varchar,
    "requirements" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_recruitment_status" DEFAULT 'draft'
  );

  CREATE TABLE "_recruitment_v_version_positions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "duties" varchar,
    "requirements" varchar,
    "commitment" varchar,
    "arrangement" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_recruitment_v" (
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
    "version_kind" "enum__recruitment_v_version_kind",
    "version_game_id" integer,
    "version_registration_start" timestamp(3) with time zone,
    "version_registration_end" timestamp(3) with time zone,
    "version_registration_closed" boolean,
    "version_registration_u_r_l" varchar,
    "version_channel_text" varchar,
    "version_qr_code_id" integer,
    "version_channel_checked_at" timestamp(3) with time zone,
    "version_contact" varchar,
    "version_requirements" varchar,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__recruitment_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "news" (
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
    "type" "enum_news_type",
    "published_at" timestamp(3) with time zone,
    "event_id" integer,
    "team_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_news_status" DEFAULT 'draft'
  );

  CREATE TABLE "_news_v" (
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
    "version_type" "enum__news_v_version_type",
    "version_published_at" timestamp(3) with time zone,
    "version_event_id" integer,
    "version_team_id" integer,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__news_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "albums_photos" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "image_id" integer,
    "caption" varchar
  );

  CREATE TABLE "albums" (
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
    "date" timestamp(3) with time zone,
    "event_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_albums_status" DEFAULT 'draft'
  );

  CREATE TABLE "_albums_v_version_photos" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "image_id" integer,
    "caption" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_albums_v" (
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
    "version_date" timestamp(3) with time zone,
    "version_event_id" integer,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__albums_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "pages_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "heading" varchar,
    "text" varchar
  );

  CREATE TABLE "pages" (
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
    "key" "enum_pages_key",
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_pages_status" DEFAULT 'draft'
  );

  CREATE TABLE "_pages_v_version_sections" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "heading" varchar,
    "text" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "_pages_v" (
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
    "version_key" "enum__pages_v_version_key",
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__pages_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );

  CREATE TABLE "redirects" (
    "id" serial PRIMARY KEY NOT NULL,
    "from" varchar NOT NULL,
    "to" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "audit" (
    "id" serial PRIMARY KEY NOT NULL,
    "actor" varchar,
    "action" varchar,
    "object" varchar,
    "status" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_kv" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer,
    "media_id" integer,
    "games_id" integer,
    "teams_id" integer,
    "seasons_id" integer,
    "honors_id" integer,
    "events_id" integer,
    "recruitment_id" integer,
    "news_id" integer,
    "albums_id" integer,
    "pages_id" integer,
    "redirects_id" integer,
    "audit_id" integer
  );

  CREATE TABLE "payload_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  CREATE TABLE "payload_migrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "site_contacts" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar NOT NULL,
    "text" varchar NOT NULL,
    "url" varchar
  );

  CREATE TABLE "site_navigation" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar NOT NULL,
    "path" "enum_site_navigation_path" NOT NULL
  );

  CREATE TABLE "site_modules" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "kind" "enum_site_modules_kind" NOT NULL,
    "enabled" boolean DEFAULT true,
    "title" varchar
  );

  CREATE TABLE "site" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar DEFAULT '清华大学学生紫荆电竞社' NOT NULL,
    "hero_title" varchar,
    "hero_subtitle" varchar,
    "hero_image_id" integer,
    "hero_button_label" varchar,
    "hero_button_u_r_l" varchar,
    "description" varchar,
    "footer" varchar,
    "updated_at" timestamp(3) with time zone,
    "created_at" timestamp(3) with time zone
  );

  CREATE TABLE "site_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "events_id" integer,
    "honors_id" integer
  );

  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games" ADD CONSTRAINT "games_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_games_v" ADD CONSTRAINT "_games_v_parent_id_games_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_games_v" ADD CONSTRAINT "_games_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "teams" ADD CONSTRAINT "teams_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "teams" ADD CONSTRAINT "teams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_teams_v" ADD CONSTRAINT "_teams_v_parent_id_teams_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_teams_v" ADD CONSTRAINT "_teams_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_teams_v" ADD CONSTRAINT "_teams_v_version_game_id_games_id_fk" FOREIGN KEY ("version_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seasons_members" ADD CONSTRAINT "seasons_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seasons" ADD CONSTRAINT "seasons_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "seasons" ADD CONSTRAINT "seasons_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_seasons_v_version_members" ADD CONSTRAINT "_seasons_v_version_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_seasons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_seasons_v" ADD CONSTRAINT "_seasons_v_parent_id_seasons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_seasons_v" ADD CONSTRAINT "_seasons_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_seasons_v" ADD CONSTRAINT "_seasons_v_version_team_id_teams_id_fk" FOREIGN KEY ("version_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "honors" ADD CONSTRAINT "honors_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "honors" ADD CONSTRAINT "honors_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "honors" ADD CONSTRAINT "honors_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "honors" ADD CONSTRAINT "honors_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_honors_v" ADD CONSTRAINT "_honors_v_parent_id_honors_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."honors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_honors_v" ADD CONSTRAINT "_honors_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_honors_v" ADD CONSTRAINT "_honors_v_version_team_id_teams_id_fk" FOREIGN KEY ("version_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_honors_v" ADD CONSTRAINT "_honors_v_version_season_id_seasons_id_fk" FOREIGN KEY ("version_season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_honors_v" ADD CONSTRAINT "_honors_v_version_game_id_games_id_fk" FOREIGN KEY ("version_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_qr_code_id_media_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_game_id_games_id_fk" FOREIGN KEY ("version_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_team_id_teams_id_fk" FOREIGN KEY ("version_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_qr_code_id_media_id_fk" FOREIGN KEY ("version_qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recruitment_positions" ADD CONSTRAINT "recruitment_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."recruitment"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recruitment" ADD CONSTRAINT "recruitment_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recruitment" ADD CONSTRAINT "recruitment_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recruitment" ADD CONSTRAINT "recruitment_qr_code_id_media_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_recruitment_v_version_positions" ADD CONSTRAINT "_recruitment_v_version_positions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_recruitment_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_recruitment_v" ADD CONSTRAINT "_recruitment_v_parent_id_recruitment_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."recruitment"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_recruitment_v" ADD CONSTRAINT "_recruitment_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_recruitment_v" ADD CONSTRAINT "_recruitment_v_version_game_id_games_id_fk" FOREIGN KEY ("version_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_recruitment_v" ADD CONSTRAINT "_recruitment_v_version_qr_code_id_media_id_fk" FOREIGN KEY ("version_qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_event_id_events_id_fk" FOREIGN KEY ("version_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_team_id_teams_id_fk" FOREIGN KEY ("version_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "albums_photos" ADD CONSTRAINT "albums_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "albums_photos" ADD CONSTRAINT "albums_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "albums" ADD CONSTRAINT "albums_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_albums_v_version_photos" ADD CONSTRAINT "_albums_v_version_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_albums_v_version_photos" ADD CONSTRAINT "_albums_v_version_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_albums_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_albums_v" ADD CONSTRAINT "_albums_v_parent_id_albums_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."albums"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_albums_v" ADD CONSTRAINT "_albums_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_albums_v" ADD CONSTRAINT "_albums_v_version_event_id_events_id_fk" FOREIGN KEY ("version_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_sections" ADD CONSTRAINT "pages_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_version_sections" ADD CONSTRAINT "_pages_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_games_fk" FOREIGN KEY ("games_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_teams_fk" FOREIGN KEY ("teams_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seasons_fk" FOREIGN KEY ("seasons_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_honors_fk" FOREIGN KEY ("honors_id") REFERENCES "public"."honors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recruitment_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."recruitment"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_albums_fk" FOREIGN KEY ("albums_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_contacts" ADD CONSTRAINT "site_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_navigation" ADD CONSTRAINT "site_navigation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_modules" ADD CONSTRAINT "site_modules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site" ADD CONSTRAINT "site_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_rels" ADD CONSTRAINT "site_rels_honors_fk" FOREIGN KEY ("honors_id") REFERENCES "public"."honors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_teams_id_idx" ON "users_rels" USING btree ("teams_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE UNIQUE INDEX "games_slug_idx" ON "games" USING btree ("slug");
  CREATE INDEX "games_cover_idx" ON "games" USING btree ("cover_id");
  CREATE INDEX "games_updated_at_idx" ON "games" USING btree ("updated_at");
  CREATE INDEX "games_created_at_idx" ON "games" USING btree ("created_at");
  CREATE INDEX "games__status_idx" ON "games" USING btree ("_status");
  CREATE INDEX "_games_v_parent_idx" ON "_games_v" USING btree ("parent_id");
  CREATE INDEX "_games_v_version_version_slug_idx" ON "_games_v" USING btree ("version_slug");
  CREATE INDEX "_games_v_version_version_cover_idx" ON "_games_v" USING btree ("version_cover_id");
  CREATE INDEX "_games_v_version_version_updated_at_idx" ON "_games_v" USING btree ("version_updated_at");
  CREATE INDEX "_games_v_version_version_created_at_idx" ON "_games_v" USING btree ("version_created_at");
  CREATE INDEX "_games_v_version_version__status_idx" ON "_games_v" USING btree ("version__status");
  CREATE INDEX "_games_v_created_at_idx" ON "_games_v" USING btree ("created_at");
  CREATE INDEX "_games_v_updated_at_idx" ON "_games_v" USING btree ("updated_at");
  CREATE INDEX "_games_v_latest_idx" ON "_games_v" USING btree ("latest");
  CREATE UNIQUE INDEX "teams_slug_idx" ON "teams" USING btree ("slug");
  CREATE INDEX "teams_cover_idx" ON "teams" USING btree ("cover_id");
  CREATE INDEX "teams_game_idx" ON "teams" USING btree ("game_id");
  CREATE INDEX "teams_updated_at_idx" ON "teams" USING btree ("updated_at");
  CREATE INDEX "teams_created_at_idx" ON "teams" USING btree ("created_at");
  CREATE INDEX "teams__status_idx" ON "teams" USING btree ("_status");
  CREATE INDEX "_teams_v_parent_idx" ON "_teams_v" USING btree ("parent_id");
  CREATE INDEX "_teams_v_version_version_slug_idx" ON "_teams_v" USING btree ("version_slug");
  CREATE INDEX "_teams_v_version_version_cover_idx" ON "_teams_v" USING btree ("version_cover_id");
  CREATE INDEX "_teams_v_version_version_game_idx" ON "_teams_v" USING btree ("version_game_id");
  CREATE INDEX "_teams_v_version_version_updated_at_idx" ON "_teams_v" USING btree ("version_updated_at");
  CREATE INDEX "_teams_v_version_version_created_at_idx" ON "_teams_v" USING btree ("version_created_at");
  CREATE INDEX "_teams_v_version_version__status_idx" ON "_teams_v" USING btree ("version__status");
  CREATE INDEX "_teams_v_created_at_idx" ON "_teams_v" USING btree ("created_at");
  CREATE INDEX "_teams_v_updated_at_idx" ON "_teams_v" USING btree ("updated_at");
  CREATE INDEX "_teams_v_latest_idx" ON "_teams_v" USING btree ("latest");
  CREATE INDEX "seasons_members_order_idx" ON "seasons_members" USING btree ("_order");
  CREATE INDEX "seasons_members_parent_id_idx" ON "seasons_members" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "seasons_slug_idx" ON "seasons" USING btree ("slug");
  CREATE INDEX "seasons_cover_idx" ON "seasons" USING btree ("cover_id");
  CREATE INDEX "seasons_team_idx" ON "seasons" USING btree ("team_id");
  CREATE INDEX "seasons_updated_at_idx" ON "seasons" USING btree ("updated_at");
  CREATE INDEX "seasons_created_at_idx" ON "seasons" USING btree ("created_at");
  CREATE INDEX "seasons__status_idx" ON "seasons" USING btree ("_status");
  CREATE INDEX "_seasons_v_version_members_order_idx" ON "_seasons_v_version_members" USING btree ("_order");
  CREATE INDEX "_seasons_v_version_members_parent_id_idx" ON "_seasons_v_version_members" USING btree ("_parent_id");
  CREATE INDEX "_seasons_v_parent_idx" ON "_seasons_v" USING btree ("parent_id");
  CREATE INDEX "_seasons_v_version_version_slug_idx" ON "_seasons_v" USING btree ("version_slug");
  CREATE INDEX "_seasons_v_version_version_cover_idx" ON "_seasons_v" USING btree ("version_cover_id");
  CREATE INDEX "_seasons_v_version_version_team_idx" ON "_seasons_v" USING btree ("version_team_id");
  CREATE INDEX "_seasons_v_version_version_updated_at_idx" ON "_seasons_v" USING btree ("version_updated_at");
  CREATE INDEX "_seasons_v_version_version_created_at_idx" ON "_seasons_v" USING btree ("version_created_at");
  CREATE INDEX "_seasons_v_version_version__status_idx" ON "_seasons_v" USING btree ("version__status");
  CREATE INDEX "_seasons_v_created_at_idx" ON "_seasons_v" USING btree ("created_at");
  CREATE INDEX "_seasons_v_updated_at_idx" ON "_seasons_v" USING btree ("updated_at");
  CREATE INDEX "_seasons_v_latest_idx" ON "_seasons_v" USING btree ("latest");
  CREATE UNIQUE INDEX "honors_slug_idx" ON "honors" USING btree ("slug");
  CREATE INDEX "honors_cover_idx" ON "honors" USING btree ("cover_id");
  CREATE INDEX "honors_team_idx" ON "honors" USING btree ("team_id");
  CREATE INDEX "honors_season_idx" ON "honors" USING btree ("season_id");
  CREATE INDEX "honors_game_idx" ON "honors" USING btree ("game_id");
  CREATE INDEX "honors_updated_at_idx" ON "honors" USING btree ("updated_at");
  CREATE INDEX "honors_created_at_idx" ON "honors" USING btree ("created_at");
  CREATE INDEX "honors__status_idx" ON "honors" USING btree ("_status");
  CREATE INDEX "_honors_v_parent_idx" ON "_honors_v" USING btree ("parent_id");
  CREATE INDEX "_honors_v_version_version_slug_idx" ON "_honors_v" USING btree ("version_slug");
  CREATE INDEX "_honors_v_version_version_cover_idx" ON "_honors_v" USING btree ("version_cover_id");
  CREATE INDEX "_honors_v_version_version_team_idx" ON "_honors_v" USING btree ("version_team_id");
  CREATE INDEX "_honors_v_version_version_season_idx" ON "_honors_v" USING btree ("version_season_id");
  CREATE INDEX "_honors_v_version_version_game_idx" ON "_honors_v" USING btree ("version_game_id");
  CREATE INDEX "_honors_v_version_version_updated_at_idx" ON "_honors_v" USING btree ("version_updated_at");
  CREATE INDEX "_honors_v_version_version_created_at_idx" ON "_honors_v" USING btree ("version_created_at");
  CREATE INDEX "_honors_v_version_version__status_idx" ON "_honors_v" USING btree ("version__status");
  CREATE INDEX "_honors_v_created_at_idx" ON "_honors_v" USING btree ("created_at");
  CREATE INDEX "_honors_v_updated_at_idx" ON "_honors_v" USING btree ("updated_at");
  CREATE INDEX "_honors_v_latest_idx" ON "_honors_v" USING btree ("latest");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_cover_idx" ON "events" USING btree ("cover_id");
  CREATE INDEX "events_game_idx" ON "events" USING btree ("game_id");
  CREATE INDEX "events_team_idx" ON "events" USING btree ("team_id");
  CREATE INDEX "events_qr_code_idx" ON "events" USING btree ("qr_code_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "events__status_idx" ON "events" USING btree ("_status");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_cover_idx" ON "_events_v" USING btree ("version_cover_id");
  CREATE INDEX "_events_v_version_version_game_idx" ON "_events_v" USING btree ("version_game_id");
  CREATE INDEX "_events_v_version_version_team_idx" ON "_events_v" USING btree ("version_team_id");
  CREATE INDEX "_events_v_version_version_qr_code_idx" ON "_events_v" USING btree ("version_qr_code_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE INDEX "recruitment_positions_order_idx" ON "recruitment_positions" USING btree ("_order");
  CREATE INDEX "recruitment_positions_parent_id_idx" ON "recruitment_positions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "recruitment_slug_idx" ON "recruitment" USING btree ("slug");
  CREATE INDEX "recruitment_cover_idx" ON "recruitment" USING btree ("cover_id");
  CREATE INDEX "recruitment_game_idx" ON "recruitment" USING btree ("game_id");
  CREATE INDEX "recruitment_qr_code_idx" ON "recruitment" USING btree ("qr_code_id");
  CREATE INDEX "recruitment_updated_at_idx" ON "recruitment" USING btree ("updated_at");
  CREATE INDEX "recruitment_created_at_idx" ON "recruitment" USING btree ("created_at");
  CREATE INDEX "recruitment__status_idx" ON "recruitment" USING btree ("_status");
  CREATE INDEX "_recruitment_v_version_positions_order_idx" ON "_recruitment_v_version_positions" USING btree ("_order");
  CREATE INDEX "_recruitment_v_version_positions_parent_id_idx" ON "_recruitment_v_version_positions" USING btree ("_parent_id");
  CREATE INDEX "_recruitment_v_parent_idx" ON "_recruitment_v" USING btree ("parent_id");
  CREATE INDEX "_recruitment_v_version_version_slug_idx" ON "_recruitment_v" USING btree ("version_slug");
  CREATE INDEX "_recruitment_v_version_version_cover_idx" ON "_recruitment_v" USING btree ("version_cover_id");
  CREATE INDEX "_recruitment_v_version_version_game_idx" ON "_recruitment_v" USING btree ("version_game_id");
  CREATE INDEX "_recruitment_v_version_version_qr_code_idx" ON "_recruitment_v" USING btree ("version_qr_code_id");
  CREATE INDEX "_recruitment_v_version_version_updated_at_idx" ON "_recruitment_v" USING btree ("version_updated_at");
  CREATE INDEX "_recruitment_v_version_version_created_at_idx" ON "_recruitment_v" USING btree ("version_created_at");
  CREATE INDEX "_recruitment_v_version_version__status_idx" ON "_recruitment_v" USING btree ("version__status");
  CREATE INDEX "_recruitment_v_created_at_idx" ON "_recruitment_v" USING btree ("created_at");
  CREATE INDEX "_recruitment_v_updated_at_idx" ON "_recruitment_v" USING btree ("updated_at");
  CREATE INDEX "_recruitment_v_latest_idx" ON "_recruitment_v" USING btree ("latest");
  CREATE UNIQUE INDEX "news_slug_idx" ON "news" USING btree ("slug");
  CREATE INDEX "news_cover_idx" ON "news" USING btree ("cover_id");
  CREATE INDEX "news_event_idx" ON "news" USING btree ("event_id");
  CREATE INDEX "news_team_idx" ON "news" USING btree ("team_id");
  CREATE INDEX "news_updated_at_idx" ON "news" USING btree ("updated_at");
  CREATE INDEX "news_created_at_idx" ON "news" USING btree ("created_at");
  CREATE INDEX "news__status_idx" ON "news" USING btree ("_status");
  CREATE INDEX "_news_v_parent_idx" ON "_news_v" USING btree ("parent_id");
  CREATE INDEX "_news_v_version_version_slug_idx" ON "_news_v" USING btree ("version_slug");
  CREATE INDEX "_news_v_version_version_cover_idx" ON "_news_v" USING btree ("version_cover_id");
  CREATE INDEX "_news_v_version_version_event_idx" ON "_news_v" USING btree ("version_event_id");
  CREATE INDEX "_news_v_version_version_team_idx" ON "_news_v" USING btree ("version_team_id");
  CREATE INDEX "_news_v_version_version_updated_at_idx" ON "_news_v" USING btree ("version_updated_at");
  CREATE INDEX "_news_v_version_version_created_at_idx" ON "_news_v" USING btree ("version_created_at");
  CREATE INDEX "_news_v_version_version__status_idx" ON "_news_v" USING btree ("version__status");
  CREATE INDEX "_news_v_created_at_idx" ON "_news_v" USING btree ("created_at");
  CREATE INDEX "_news_v_updated_at_idx" ON "_news_v" USING btree ("updated_at");
  CREATE INDEX "_news_v_latest_idx" ON "_news_v" USING btree ("latest");
  CREATE INDEX "albums_photos_order_idx" ON "albums_photos" USING btree ("_order");
  CREATE INDEX "albums_photos_parent_id_idx" ON "albums_photos" USING btree ("_parent_id");
  CREATE INDEX "albums_photos_image_idx" ON "albums_photos" USING btree ("image_id");
  CREATE UNIQUE INDEX "albums_slug_idx" ON "albums" USING btree ("slug");
  CREATE INDEX "albums_cover_idx" ON "albums" USING btree ("cover_id");
  CREATE INDEX "albums_event_idx" ON "albums" USING btree ("event_id");
  CREATE INDEX "albums_updated_at_idx" ON "albums" USING btree ("updated_at");
  CREATE INDEX "albums_created_at_idx" ON "albums" USING btree ("created_at");
  CREATE INDEX "albums__status_idx" ON "albums" USING btree ("_status");
  CREATE INDEX "_albums_v_version_photos_order_idx" ON "_albums_v_version_photos" USING btree ("_order");
  CREATE INDEX "_albums_v_version_photos_parent_id_idx" ON "_albums_v_version_photos" USING btree ("_parent_id");
  CREATE INDEX "_albums_v_version_photos_image_idx" ON "_albums_v_version_photos" USING btree ("image_id");
  CREATE INDEX "_albums_v_parent_idx" ON "_albums_v" USING btree ("parent_id");
  CREATE INDEX "_albums_v_version_version_slug_idx" ON "_albums_v" USING btree ("version_slug");
  CREATE INDEX "_albums_v_version_version_cover_idx" ON "_albums_v" USING btree ("version_cover_id");
  CREATE INDEX "_albums_v_version_version_event_idx" ON "_albums_v" USING btree ("version_event_id");
  CREATE INDEX "_albums_v_version_version_updated_at_idx" ON "_albums_v" USING btree ("version_updated_at");
  CREATE INDEX "_albums_v_version_version_created_at_idx" ON "_albums_v" USING btree ("version_created_at");
  CREATE INDEX "_albums_v_version_version__status_idx" ON "_albums_v" USING btree ("version__status");
  CREATE INDEX "_albums_v_created_at_idx" ON "_albums_v" USING btree ("created_at");
  CREATE INDEX "_albums_v_updated_at_idx" ON "_albums_v" USING btree ("updated_at");
  CREATE INDEX "_albums_v_latest_idx" ON "_albums_v" USING btree ("latest");
  CREATE INDEX "pages_sections_order_idx" ON "pages_sections" USING btree ("_order");
  CREATE INDEX "pages_sections_parent_id_idx" ON "pages_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_cover_idx" ON "pages" USING btree ("cover_id");
  CREATE UNIQUE INDEX "pages_key_idx" ON "pages" USING btree ("key");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_version_sections_order_idx" ON "_pages_v_version_sections" USING btree ("_order");
  CREATE INDEX "_pages_v_version_sections_parent_id_idx" ON "_pages_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_cover_idx" ON "_pages_v" USING btree ("version_cover_id");
  CREATE INDEX "_pages_v_version_version_key_idx" ON "_pages_v" USING btree ("version_key");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "audit_updated_at_idx" ON "audit" USING btree ("updated_at");
  CREATE INDEX "audit_created_at_idx" ON "audit" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_games_id_idx" ON "payload_locked_documents_rels" USING btree ("games_id");
  CREATE INDEX "payload_locked_documents_rels_teams_id_idx" ON "payload_locked_documents_rels" USING btree ("teams_id");
  CREATE INDEX "payload_locked_documents_rels_seasons_id_idx" ON "payload_locked_documents_rels" USING btree ("seasons_id");
  CREATE INDEX "payload_locked_documents_rels_honors_id_idx" ON "payload_locked_documents_rels" USING btree ("honors_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_recruitment_id_idx" ON "payload_locked_documents_rels" USING btree ("recruitment_id");
  CREATE INDEX "payload_locked_documents_rels_news_id_idx" ON "payload_locked_documents_rels" USING btree ("news_id");
  CREATE INDEX "payload_locked_documents_rels_albums_id_idx" ON "payload_locked_documents_rels" USING btree ("albums_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_contacts_order_idx" ON "site_contacts" USING btree ("_order");
  CREATE INDEX "site_contacts_parent_id_idx" ON "site_contacts" USING btree ("_parent_id");
  CREATE INDEX "site_navigation_order_idx" ON "site_navigation" USING btree ("_order");
  CREATE INDEX "site_navigation_parent_id_idx" ON "site_navigation" USING btree ("_parent_id");
  CREATE INDEX "site_modules_order_idx" ON "site_modules" USING btree ("_order");
  CREATE INDEX "site_modules_parent_id_idx" ON "site_modules" USING btree ("_parent_id");
  CREATE INDEX "site_hero_image_idx" ON "site" USING btree ("hero_image_id");
  CREATE INDEX "site_rels_order_idx" ON "site_rels" USING btree ("order");
  CREATE INDEX "site_rels_parent_idx" ON "site_rels" USING btree ("parent_id");
  CREATE INDEX "site_rels_path_idx" ON "site_rels" USING btree ("path");
  CREATE INDEX "site_rels_events_id_idx" ON "site_rels" USING btree ("events_id");
  CREATE INDEX "site_rels_honors_id_idx" ON "site_rels" USING btree ("honors_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "games" CASCADE;
  DROP TABLE "_games_v" CASCADE;
  DROP TABLE "teams" CASCADE;
  DROP TABLE "_teams_v" CASCADE;
  DROP TABLE "seasons_members" CASCADE;
  DROP TABLE "seasons" CASCADE;
  DROP TABLE "_seasons_v_version_members" CASCADE;
  DROP TABLE "_seasons_v" CASCADE;
  DROP TABLE "honors" CASCADE;
  DROP TABLE "_honors_v" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "recruitment_positions" CASCADE;
  DROP TABLE "recruitment" CASCADE;
  DROP TABLE "_recruitment_v_version_positions" CASCADE;
  DROP TABLE "_recruitment_v" CASCADE;
  DROP TABLE "news" CASCADE;
  DROP TABLE "_news_v" CASCADE;
  DROP TABLE "albums_photos" CASCADE;
  DROP TABLE "albums" CASCADE;
  DROP TABLE "_albums_v_version_photos" CASCADE;
  DROP TABLE "_albums_v" CASCADE;
  DROP TABLE "pages_sections" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_version_sections" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "audit" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_contacts" CASCADE;
  DROP TABLE "site_navigation" CASCADE;
  DROP TABLE "site_modules" CASCADE;
  DROP TABLE "site" CASCADE;
  DROP TABLE "site_rels" CASCADE;
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_games_status";
  DROP TYPE "public"."enum__games_v_version_status";
  DROP TYPE "public"."enum_teams_status";
  DROP TYPE "public"."enum__teams_v_version_status";
  DROP TYPE "public"."enum_seasons_status";
  DROP TYPE "public"."enum__seasons_v_version_status";
  DROP TYPE "public"."enum_honors_status";
  DROP TYPE "public"."enum__honors_v_version_status";
  DROP TYPE "public"."enum_events_type";
  DROP TYPE "public"."enum_events_lifecycle";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_type";
  DROP TYPE "public"."enum__events_v_version_lifecycle";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum_recruitment_kind";
  DROP TYPE "public"."enum_recruitment_status";
  DROP TYPE "public"."enum__recruitment_v_version_kind";
  DROP TYPE "public"."enum__recruitment_v_version_status";
  DROP TYPE "public"."enum_news_type";
  DROP TYPE "public"."enum_news_status";
  DROP TYPE "public"."enum__news_v_version_type";
  DROP TYPE "public"."enum__news_v_version_status";
  DROP TYPE "public"."enum_albums_status";
  DROP TYPE "public"."enum__albums_v_version_status";
  DROP TYPE "public"."enum_pages_key";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_key";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_site_navigation_path";
  DROP TYPE "public"."enum_site_modules_kind";`);
}
