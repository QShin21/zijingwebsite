import type { PostgresAdapter } from "@payloadcms/db-postgres";
import type { Access } from "payload";
import { canUseCampus } from "./rules";

export const publicMediaRead: Access = ({ isReadingStaticFile, data, req }) => {
  if (!isReadingStaticFile) return true;
  const filename = data?.filename;
  if (typeof filename !== "string" || filename.startsWith(".") || /[\\/\0]/.test(filename) ||
      !/\.(png|jpe?g|webp)$/i.test(filename)) return false;
  if (canUseCampus(req.user)) return true;
  const visible = req.user?.affiliation === "peer" && req.user.accountStatus !== "suspended"
    ? ["peer", "public"]
    : ["public"];
  const db = req.payload.db as unknown as PostgresAdapter;
  // Legacy CMS cover images and signup QR codes use the media library. A file
  // shared with a currently visible record keeps that record's access.
  return db.pool.query<{ allowed: boolean }>(`
    WITH file AS (
      SELECT id FROM media WHERE filename = $1 OR sizes_card_filename = $1
    )
    SELECT (
      EXISTS (SELECT 1 FROM site WHERE hero_image_id IN (SELECT id FROM file))
      OR EXISTS (
        SELECT 1 FROM events e JOIN file f ON f.id IN (e.cover_id, e.qr_code_id)
        WHERE e._status = 'published' AND e.audience::text = ANY($2::text[]) AND (NOT $3 OR NOT coalesce(e.demo, false))
      )
      OR EXISTS (
        SELECT 1 FROM announcements a JOIN file f ON f.id = a.cover_id
        WHERE a._status = 'published' AND a.audience::text = ANY($2::text[]) AND (NOT $3 OR NOT coalesce(a.demo, false))
      )
      OR NOT EXISTS (
        SELECT 1 FROM file f WHERE
          EXISTS (SELECT 1 FROM events WHERE f.id IN (cover_id, qr_code_id))
          OR EXISTS (SELECT 1 FROM _events_v WHERE f.id IN (version_cover_id, version_qr_code_id))
          OR EXISTS (SELECT 1 FROM announcements WHERE cover_id = f.id)
          OR EXISTS (SELECT 1 FROM _announcements_v WHERE version_cover_id = f.id)
          OR EXISTS (SELECT 1 FROM teams WHERE cover_id = f.id)
          OR EXISTS (SELECT 1 FROM _teams_v WHERE version_cover_id = f.id)
          OR EXISTS (SELECT 1 FROM honors WHERE cover_id = f.id)
          OR EXISTS (SELECT 1 FROM _honors_v WHERE version_cover_id = f.id)
          OR EXISTS (SELECT 1 FROM seasons WHERE cover_id = f.id)
          OR EXISTS (SELECT 1 FROM _seasons_v WHERE version_cover_id = f.id)
          OR EXISTS (SELECT 1 FROM recruitment WHERE f.id IN (cover_id, qr_code_id))
          OR EXISTS (SELECT 1 FROM _recruitment_v WHERE f.id IN (version_cover_id, version_qr_code_id))
          OR EXISTS (SELECT 1 FROM news WHERE cover_id = f.id)
          OR EXISTS (SELECT 1 FROM _news_v WHERE version_cover_id = f.id)
          OR EXISTS (SELECT 1 FROM albums WHERE cover_id = f.id)
          OR EXISTS (SELECT 1 FROM _albums_v WHERE version_cover_id = f.id)
          OR EXISTS (SELECT 1 FROM albums_photos WHERE image_id = f.id)
          OR EXISTS (SELECT 1 FROM _albums_v_version_photos WHERE image_id = f.id)
      )
    ) AS allowed
  `, [filename, visible, process.env.APP_ENV === "production"]).then(result => result.rows[0]?.allowed === true);
};
