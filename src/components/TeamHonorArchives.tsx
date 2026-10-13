import Link from "next/link";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { canReviewShowcase } from "@/lib/rules";
import { hideLegacyTeamHonorAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { teamHonorService, type HonorArchive } from "@/lib/team-honor-service";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "@/app/(frontend)/_club/ClubPages.module.css";

export function TeamHonorArchiveCards({ archives, pinned = false }: { archives: HonorArchive[]; pinned?: boolean }) {
  if (!archives.length) return null;
  return (
    <div className={styles.honorList} data-team-honor-archives aria-label={pinned ? "置顶代表队荣誉档案" : "代表队荣誉档案"}>
      {archives.map((archive) => (
        <article className={styles.honorIndex} key={archive.key} data-team-honor-archive={archive.team.id}>
          <div className={styles.honorCount}><strong>{archive.records.length}</strong>条已批准荣誉</div>
          <div>
            <p className={styles.kicker}>{pinned ? "社群置顶 · " : ""}{archive.team.gameTitle}</p>
            <h3><Link href={archive.href}>{archive.team.title} · 荣誉档案</Link></h3>
            <p>{archive.records[0].competition || archive.records[0].title} · {archive.records[0].placing || "已核验记录"} · {archive.records[0].date?.slice(0, 10) || "历史记录"}</p>
          </div>
          <Link className={styles.cardLink} href={archive.href}>查看完整档案 <span aria-hidden="true">→</span></Link>
        </article>
      ))}
    </div>
  );
}

export async function TeamHonorPins({ payload, game }: { payload: Payload; game: number }) {
  return <TeamHonorArchiveCards archives={await teamHonorService.archives(payload, { game })} pinned />;
}

export function TeamHonorArchiveContents({ archive, user = null }: { archive: HonorArchive; user?: User | null }) {
  const years = new Map<string, HonorArchive["records"]>();
  for (const record of archive.records) {
    const year = record.date?.match(/^\d{4}/)?.[0] || "历史记录";
    years.set(year, [...(years.get(year) || []), record]);
  }
  return (
    <div aria-label="按赛事年份排列的荣誉档案">
      {Array.from(years, ([year, records]) => (
        <section className={styles.yearGroup} key={year} aria-label={`${year}荣誉`}>
          <h2 className={styles.yearLabel}>{year}</h2>
          <div className={styles.yearRecords}>
            {records.map((record) => (
              <article className={styles.archiveRecord} key={record.key} data-public-honor={record.key}>
                <p className={styles.recordMeta}>{record.legacy ? "历史已核验档案记录" : "已批准"}{record.authorName ? ` · ${record.authorName}` : ""}</p>
                <h3>{record.title}</h3>
                <dl className={styles.recordMeta}>
                  <div><dt>赛事</dt><dd>{record.competition || "历史档案未记录"}</dd></div>
                  <div><dt>奖项或名次</dt><dd>{record.placing || "历史档案未记录"}</dd></div>
                  <div><dt>赛事日期</dt><dd>{record.date ? <time dateTime={record.date.slice(0, 10)}>{record.date.slice(0, 10)}</time> : "历史档案未记录日期"}</dd></div>
                </dl>
                {record.description && <p className="preserve">{record.description}</p>}
                {record.images.length > 0 && <div className="showcase-images">
                  {record.images.map((image, index) => <figure key={index}>
                    <img src={image.source} alt={image.caption || `已批准成果材料 ${index + 1}`} width={800} height={600} loading="lazy" />
                    {image.caption && <figcaption>{image.caption}</figcaption>}
                  </figure>)}
                </div>}
                {record.videoHref && <video controls playsInline preload="metadata" src={record.videoHref} aria-label="已批准的荣誉视频证据" style={{ maxWidth: "100%" }} />}
                {record.sourceHref && <Link className="button light" href={record.sourceHref}>查看原历史荣誉</Link>}
                {record.legacy && canReviewShowcase(user, archive.team.game) && (
                  <form action={hideLegacyTeamHonorAction} className="member-form">
                    <input type="hidden" name="returnQuery" value={teamHonorQuery({ team: archive.team.id, game: archive.team.game })} />
                    <input type="hidden" name="id" value={record.key.split(":")[1]} />
                    <input type="hidden" name="revision" value={record.legacyRevision || ""} />
                    <label>隐藏历史荣誉说明<textarea name="note" maxLength={500} required /></label>
                    <div className="reaction-bar"><SubmitButton name="action" value="hideLegacy">隐藏历史荣誉</SubmitButton></div>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
