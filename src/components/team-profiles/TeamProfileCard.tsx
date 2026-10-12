import {
  safeTeamProfileAvatar,
  type TeamProfileDraft,
} from "@/lib/team-profiles-model";
import styles from "./TeamProfiles.module.css";

export function TeamProfileCard({
  profile,
}: {
  profile: Omit<TeamProfileDraft, "visible">;
}) {
  return (
    <article className={styles.card}>
      {safeTeamProfileAvatar(profile.avatar) ? (
        // Normalized, self-contained uploads; never a remote image URL.
        <img
          className={styles.avatar}
          src={profile.avatar}
          alt=""
          width={64}
          height={64}
        />
      ) : (
        <span className={styles.placeholder} aria-hidden="true">
          {profile.displayName.slice(0, 1) || "队"}
        </span>
      )}
      <div className={styles.cardText}>
        <h3>{profile.displayName || "公开昵称"}</h3>
        {profile.position && (
          <p className={styles.position}>{profile.position}</p>
        )}
        {profile.biography && (
          <p className={styles.biography}>{profile.biography}</p>
        )}
      </div>
    </article>
  );
}
