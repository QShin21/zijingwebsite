import Link from "next/link";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { canReviewShowcase } from "@/lib/rules";
import { hideLegacyTeamHonorResultAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { teamHonorService, type HonorArchive } from "@/lib/team-honor-service";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "./team-pages/TeamPages.module.css";

export function TeamHonorArchiveCards({
  archives,
  pinned = false,
}: {
  archives: HonorArchive[];
  pinned?: boolean;
}) {
  if (!archives.length) return null;
  return (
    <div
      className={styles.archiveIndex}
      data-team-honor-archives
      aria-label={pinned ? "置顶代表队荣誉档案" : "代表队荣誉档案"}
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
              {pinned ? "社群置顶档案" : "最近赛事"}
              {latest.date ? (
                <time dateTime={latest.date.slice(0, 10)}>
                  {latest.date.slice(0, 10)}
                </time>
              ) : (
                <p>历史记录</p>
              )}
              <p>{archive.records.length} 条已批准荣誉</p>
            </div>
            <div>
              <p className={styles.muted}>{archive.team.gameTitle}</p>
              <h3>
                <Link href={archive.href}>{archive.team.title} · 荣誉档案</Link>
              </h3>
              <p>{latest.competition || latest.title}</p>
              {latest.placing && (
                <p className={styles.archiveAchievement}>{latest.placing}</p>
              )}
            </div>
            <Link href={archive.href}>查看完整档案</Link>
          </article>
        );
      })}
    </div>
  );
}

export async function TeamHonorPins({
  payload,
  game,
}: {
  payload: Payload;
  game: number;
}) {
  return (
    <TeamHonorArchiveCards
      archives={await teamHonorService.archives(payload, { game })}
      pinned
    />
  );
}

export function TeamHonorArchiveContents({
  archive,
  user = null,
}: {
  archive: HonorArchive;
  user?: User | null;
}) {
  const years = new Map<string, HonorArchive["records"]>();
  for (const record of archive.records) {
    const year = record.date?.match(/^\d{4}/)?.[0] || "历史记录";
    years.set(year, [...(years.get(year) || []), record]);
  }
  return (
    <div aria-label="按赛事年份排列的荣誉档案">
      {Array.from(years, ([year, records]) => (
        <section
          className={styles.yearGroup}
          key={year}
          aria-label={`${year}荣誉`}
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
                  <strong>{record.placing || "历史已核验成果"}</strong>
                  {record.date && (
                    <time dateTime={record.date.slice(0, 10)}>
                      {record.date.slice(0, 10)}
                    </time>
                  )}
                </div>
                <p className={styles.muted}>
                  {record.competition || "历史档案未记录赛事"}
                </p>
                <h3>{record.title}</h3>
                <p className={styles.recordDate}>
                  {record.legacy ? "历史已核验档案记录" : "已批准"}
                  {record.authorName ? `；投稿人：${record.authorName}` : ""}
                  {!record.date ? "；历史档案未记录日期" : ""}
                </p>
                {record.description && (
                  <p className="preserve">{record.description}</p>
                )}
                {record.images.length > 0 && (
                  <div className={styles.media} aria-label="已批准的成果材料">
                    {record.images.map((image, index) => (
                      <figure key={index}>
                        <img
                          src={image.source}
                          alt={image.caption || `已批准成果材料 ${index + 1}`}
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
                    aria-label="已批准的荣誉视频证据"
                  />
                )}
                {record.sourceHref && (
                  <div className={styles.actions}>
                    <Link href={record.sourceHref}>查看原历史荣誉</Link>
                  </div>
                )}
                {record.legacy &&
                  canReviewShowcase(user, archive.team.game) && (
                    <details className={styles.disclosure}>
                      <summary>管理这项历史荣誉</summary>
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
                        <p>隐藏后，这项记录会从当前公开档案移除。</p>
                        <label>
                          隐藏历史荣誉说明
                          <textarea name="note" maxLength={500} required />
                        </label>
                        <div className={styles.actions}>
                          <SubmitButton name="action" value="hideLegacy">
                            隐藏历史荣誉
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
