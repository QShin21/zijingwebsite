import "dotenv/config";
import pg from "pg";
// Read-only gate for rollback to the 1.0 baseline. Compatible newer builds retain these capabilities.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const result = await db.query<{ backbone: number; new_states: number; joins: number; reduced_grants: number; revoked_grants: number; legacy_owner_private_access: number; revoked_cards: number; member_offices: number }>(`
    SELECT
      (SELECT count(*)::int FROM users_roles WHERE value='backbone') backbone,
      (SELECT count(*)::int FROM community_applications WHERE status IN('returned','withdrawn')) new_states,
      (SELECT count(*)::int FROM community_joins) joins,
      (SELECT count(*)::int FROM users_community_offices WHERE status='revoked') revoked_grants,
      (SELECT count(*)::int FROM events e JOIN users_roles r ON r.parent_id=e.submitted_by_id WHERE r.value='communityAdmin'
       AND (NOT EXISTS(SELECT 1 FROM users_community_offices o WHERE o._parent_id=r.parent_id AND o.status='active' AND coalesce(o.view_signups,false) AND (e.game_id IS NULL OR o.game_id=e.game_id))
         OR NOT EXISTS(SELECT 1 FROM users_community_offices o WHERE o._parent_id=r.parent_id AND o.status='active' AND coalesce(o.view_signups,false) AND coalesce(o.export_signups,false) AND (e.game_id IS NULL OR o.game_id=e.game_id)))) legacy_owner_private_access,
      (SELECT count(*)::int FROM users_community_offices o JOIN users_roles r ON r.parent_id=o._parent_id
       WHERE o.status='active' AND r.value='member') member_offices,
      (SELECT count(*)::int FROM users_community_offices o JOIN users_roles r ON r.parent_id=o._parent_id
       WHERE o.status='active' AND r.value='communityAdmin' AND
       (NOT coalesce(o.publish_content,false) OR NOT coalesce(o.review_showcase,false) OR NOT coalesce(o.view_signups,false) OR NOT coalesce(o.export_signups,false))) reduced_grants,
      (SELECT count(*)::int FROM users_community_offices o JOIN users_roles r ON r.parent_id=o._parent_id
       WHERE o.status='active' AND r.value IN('communityAdmin','vicePresident','president')
       AND EXISTS(SELECT 1 FROM community_applications a WHERE a.applicant_id=o._parent_id AND a.game_id=o.game_id AND a.status='approved' AND a.wechat_qr IS NOT NULL
       AND (NOT coalesce(o.contact_consent,false) OR NOT coalesce(a.contact_consent,false)))) revoked_cards`);
  const compatible = Object.values(result.rows[0]).every(count => count === 0);
  console.log(JSON.stringify({ compatibleWithBaseline: compatible, counts: result.rows[0], preservesExpandedSchema: true, recommendation: compatible ? "Keep schema and backups; verify the actual previous build before switching" : "Use a reviewed rollback build retaining club operations, consent and private signup capabilities; do not revert to 1.0 or execute down" }));
  if (!compatible) process.exitCode = 1;
} finally { await db.end(); }
