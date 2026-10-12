import Link from "next/link";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { canReviewShowcase } from "@/lib/rules";
import { hideLegacyTeamHonorAction } from "@/app/(frontend)/teams/honors/actions";
import { SubmitButton } from "./SubmitButton";
import { teamHonorService, type HonorArchive } from "@/lib/team-honor-service";
import { teamHonorQuery } from "./TeamHonorNavigation";

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
      className="showcase-feed"
      data-team-honor-archives
      aria-label={pinned ? "置顶代表队荣誉档案" : "代表队荣誉档案"}
    >
      {archives.map((archive) => (
        <article
          className="panel showcase-card"
          key={archive.key}
          data-team-honor-archive={archive.team.id}
        >
          <small>
            {pinned ? "置顶 · " : ""}
            {archive.team.gameTitle} · {archive.records.length} 条已批准荣誉
          </small>
          <h3>
            <Link href={archive.href}>{archive.team.title} · 荣誉档案</Link>
          </h3>
          <p>
            {archive.records[0].competition} · {archive.records[0].placing} ·{" "}
            {archive.records[0].date?.slice(0, 10) || "历史记录"}
          </p>
          <Link className="button light" href={archive.href}>
            查看完整档案
          </Link>
        </article>
      ))}
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
  return (
    <div className="showcase-feed">
      {archive.records.map((record) => (
        <article
          className="panel showcase-card"
          key={record.key}
          data-public-honor={record.key}
        >
          <p>
            {record.legacy ? "历史已核验档案记录" : "已批准"} ·{" "}
            {record.authorName}
          </p>
          <h2>{record.title}</h2>
          <p>
            赛事：{record.competition} · 奖项：{record.placing} · 赛事日期：
            {record.date?.slice(0, 10) || "历史档案未记录日期"}
          </p>
          {record.description && (
            <p className="preserve">{record.description}</p>
          )}
          <div className="showcase-images">
            {record.images.map((image, index) => (
              <figure key={index}>
                <img
                  src={image.source}
                  alt={image.caption}
                  width={800}
                  height={600}
                  loading="lazy"
                />
                <figcaption>{image.caption}</figcaption>
              </figure>
            ))}
          </div>
          {record.videoHref && (
            <video
              controls
              preload="metadata"
              src={record.videoHref}
              aria-label="已批准的荣誉视频证据"
              style={{ maxWidth: "100%" }}
            />
          )}
          {record.sourceHref && (
            <Link className="button light" href={record.sourceHref}>
              查看原历史荣誉
            </Link>
          )}
          {record.legacy && canReviewShowcase(user, archive.team.game) && (
            <form action={hideLegacyTeamHonorAction} className="member-form">
              <input
                type="hidden"
                name="returnQuery"
                value={teamHonorQuery({
                  team: archive.team.id,
                  game: archive.team.game,
                })}
              />
              <input type="hidden" name="id" value={record.key.split(":")[1]} />
              <input
                type="hidden"
                name="revision"
                value={record.legacyRevision || ""}
              />
              <label>
                隐藏历史荣誉说明
                <textarea name="note" maxLength={500} required />
              </label>
              <SubmitButton name="action" value="hideLegacy">
                隐藏历史荣誉
              </SubmitButton>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
