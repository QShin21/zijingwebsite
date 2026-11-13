import Link from "next/link";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { canReviewShowcase } from "@/lib/rules";
import { translator, type Locale } from "@/lib/i18n/locale";
import { hideLegacyTeamHonorResultAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { teamHonorService, type HonorArchive } from "@/lib/team-honor-service";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "./team-pages/TeamPages.module.css";

export function TeamHonorArchiveCards({
  archives,
  pinned = false,
  locale = "zh",
}: {
  archives: HonorArchive[];
  pinned?: boolean;
  locale?: Locale;
}) {
  if (!archives.length) return null;
  const t = translator(locale);
  return (
    <div
      className={styles.archiveIndex}
      data-team-honor-archives
      aria-label={pinned ? t("置顶代表队荣誉档案", "Pinned team honor archives") : t("代表队荣誉档案", "Team honor archives")}
    >
      {archives.map((archive) => {
        const latest = archive.records[0];
        return (
          <article
            className={styles.archiveEntry}
            key={archive.key}
            data-team-honor-archive={archive.team.id}
          >
            <div className={styles.archiveDate}>
              {pinned ? t("社群置顶档案", "Pinned in community") : t("最近赛事", "Latest competition")}
              {latest.date ? (
                <time dateTime={latest.date.slice(0, 10)}>
                  {latest.date.slice(0, 10)}
                </time>
              ) : (
                <p>{t("历史记录", "Historical record")}</p>
              )}
              <p>{t(`${archive.records.length} 条已批准荣誉`, `${archive.records.length} approved honor${archive.records.length === 1 ? "" : "s"}`)}</p>
            </div>
            <div>
              <p className={styles.muted}>{archive.team.gameTitle}</p>
              <h3>
                <Link href={archive.href}>{archive.team.title} · {t("荣誉档案", "Honor archive")}</Link>
              </h3>
              <p>{latest.competition || latest.title}</p>
              {latest.placing && (
                <p className={styles.archiveAchievement}>{latest.placing}</p>
              )}
            </div>
            <Link href={archive.href}>{t("查看完整档案", "View full archive")}</Link>
          </article>
        );
      })}
    </div>
  );
}

export async function TeamHonorPins({
  payload,
  game,
  locale = "zh",
}: {
  payload: Payload;
  game: number;
  locale?: Locale;
}) {
  return (
    <TeamHonorArchiveCards
      archives={await teamHonorService.archives(payload, { game })}
      pinned
      locale={locale}
    />
  );
}

export function TeamHonorArchiveContents({
  archive,
  user = null,
  locale = "zh",
}: {
  archive: HonorArchive;
  user?: User | null;
  locale?: Locale;
}) {
  const t = translator(locale);
  const years = new Map<string, HonorArchive["records"]>();
  for (const record of archive.records) {
    const year = record.date?.match(/^\d{4}/)?.[0] || t("历史记录", "Undated");
    years.set(year, [...(years.get(year) || []), record]);
  }
  return (
    <div aria-label={t("按赛事年份排列的荣誉档案", "Honor archive by competition year")}>
      {Array.from(years, ([year, records]) => (
        <section
          className={styles.yearGroup}
          key={year}
          aria-label={t(`${year}荣誉`, `${year} honors`)}
        >
          <h2>{year}</h2>
          <div className={styles.yearRecords}>
            {records.map((record) => (
              <article
                className={styles.archiveRecord}
                key={record.key}
                data-public-honor={record.key}
              >
                <div className={styles.archiveAward}>
                  <strong>{record.placing || t("历史已核验成果", "Verified past achievement")}</strong>
                  {record.date && (
                    <time dateTime={record.date.slice(0, 10)}>
                      {record.date.slice(0, 10)}
                    </time>
                  )}
                </div>
                <p className={styles.muted}>
                  {record.competition || t("历史档案未记录赛事", "Competition not recorded")}
                </p>
                <h3>{record.title}</h3>
                <p className={styles.recordDate}>
                  {record.legacy ? t("历史已核验档案记录", "Verified historical record") : t("已批准", "Approved")}
                  {record.authorName ? t(`；投稿人：${record.authorName}`, `; submitted by ${record.authorName}`) : ""}
                  {!record.date ? t("；历史档案未记录日期", "; date not recorded") : ""}
                </p>
                {record.description && (
                  <p className="preserve">{record.description}</p>
                )}
                {record.images.length > 0 && (
                  <div className={styles.media} aria-label={t("已批准的成果材料", "Approved materials")}>
                    {record.images.map((image, index) => (
                      <figure key={index}>
                        <img
                          src={image.source}
                          alt={image.caption || t(`已批准成果材料 ${index + 1}`, `Approved material ${index + 1}`)}
                          width={800}
                          height={600}
                          loading="lazy"
                        />
                        {image.caption && (
                          <figcaption>{image.caption}</figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
                {record.videoHref && (
                  <video
                    className={styles.video}
                    controls
                    playsInline
                    preload="metadata"
                    src={record.videoHref}
                    aria-label={t("已批准的荣誉视频证据", "Approved honor video evidence")}
                  />
                )}
                {record.sourceHref && (
                  <div className={styles.actions}>
                    <Link href={record.sourceHref}>{t("查看原历史荣誉", "View original honor")}</Link>
                  </div>
                )}
                {record.legacy &&
                  canReviewShowcase(user, archive.team.game) && (
                    <details className={styles.disclosure}>
                      <summary>{t("管理这项历史荣誉", "Manage this historical honor")}</summary>
                      <ActionForm
                        action={hideLegacyTeamHonorResultAction}
                        className="member-form"
                      >
                        <input
                          type="hidden"
                          name="returnQuery"
                          value={teamHonorQuery({
                            team: archive.team.id,
                            game: archive.team.game,
                          })}
                        />
                        <input
                          type="hidden"
                          name="id"
                          value={record.key.split(":")[1]}
                        />
                        <input
                          type="hidden"
                          name="revision"
                          value={record.legacyRevision || ""}
                        />
                        <p>{t("隐藏后，这项记录会从当前公开档案移除。", "Once hidden, this record is removed from the public archive.")}</p>
                        <label>
                          {t("隐藏历史荣誉说明", "Reason for hiding")}
                          <textarea name="note" maxLength={500} required />
                        </label>
                        <div className={styles.actions}>
                          <SubmitButton name="action" value="hideLegacy">
                            {t("隐藏历史荣誉", "Hide historical honor")}
                          </SubmitButton>
                        </div>
                      </ActionForm>
                    </details>
                  )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
