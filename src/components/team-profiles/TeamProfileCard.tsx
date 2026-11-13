import {
  safeTeamProfileAvatar,
  type TeamProfileDraft,
} from "@/lib/team-profiles-model";
import { useT } from "@/components/i18n/LocaleProvider";
import styles from "./TeamProfiles.module.css";

export function TeamProfileCard({
  profile,
}: {
  profile: Omit<TeamProfileDraft, "visible">;
}) {
  const t = useT();
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
          {profile.displayName.slice(0, 1) || t("队", "P")}
        </span>
      )}
      <div className={styles.cardText}>
        <h3>{profile.displayName || t("公开昵称", "Public nickname")}</h3>
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
