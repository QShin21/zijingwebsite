import Link from "next/link";
import type { ReactNode } from "react";
import type { EventDetail } from "@/lib/v2";
import { ActivitySignup } from "@/components/ActivitySignup";
import { safeURL } from "@/lib/rules";
import { ArticleTile, DateBlock, eventTone, signupTone } from "./cards";
import { CommunityChip, DemoPill, Img, KeyValues, PageHero, StatusPill, Wrap, buttonClass } from "./ui";
import { RichText } from "./RichText";
import { Icon } from "./Icon";
import { formatDateTime, formatRange } from "./format";
import layout from "./layout.module.css";
import styles from "./detail.module.css";

/** Shared V2 event page for club events and community events (A4). */
export function EventDetailView({
  detail,
  kind,
  extra,
  notice,
}: {
  detail: EventDetail;
  kind: "events" | "community-posts";
  extra?: ReactNode;
  notice?: ReactNode;
}) {
  const { event, registration, related, viewer } = detail;
  const id = event.ref.type === "event" ? event.ref.id : Number(event.key.split(":")[1]);
  const community = event.community;
  const back =
    kind === "events"
      ? { href: "/events", label: "日程" }
      : { href: `/community/${community?.slug ?? ""}/updates`, label: `${community?.title ?? "社群"} · 活动与通知` };
  const signup = signupTone(event);
  const showExternal = event.signup.mode === "external" || event.signup.mode === "channel";
  return (
    <>
      <PageHero
        tone="stage"
        hue={community?.hue}
        back={back}
        eyebrow={community ? `${community.title} · 社群活动` : event.category ? `社团活动 · ${event.category}` : "社团活动"}
        title={event.title}
        description={event.summary}
        meta={
          <>
            <StatusPill tone={eventTone(event)}>{event.stateLabel}</StatusPill>
            {signup && event.signup.mode !== "none" && (
              <StatusPill tone={signup}>{event.signup.viewerSubmitted ? "已报名" : event.signup.label}</StatusPill>
            )}
            {event.promoted && <StatusPill tone="live">精选</StatusPill>}
            {event.archived && <StatusPill>历史归档</StatusPill>}
            {event.demo && <DemoPill />}
          </>
        }
        actions={
          <a href="#participate" className={buttonClass("accent")}>
            {event.signup.state === "open" && !event.signup.viewerSubmitted ? "去报名" : "报名与参与"}
            <Icon name="arrow" size={18} />
          </a>
        }
      >
        <div className={styles.when}>
          <DateBlock iso={event.startAt} size="md" tone="accent" />
          <div>
            <p className={styles.whenTime}>
              <Icon name="clock" size={16} />
              {event.startAt ? formatRange(event.startAt, event.endAt) : "时间待定"}
            </p>
            {event.location && (
              <p className={styles.whenPlace}>
                <Icon name="pin" size={16} />
                {event.location}
              </p>
            )}
            <p className={styles.whenTags}>
              {community && <CommunityChip community={community} link />}
              {event.team && (
                <Link href={`/teams/${event.team.slug}`} className={styles.teamLink}>
                  <Icon name="trophy" size={15} />
                  {event.team.title}
                </Link>
              )}
            </p>
          </div>
        </div>
      </PageHero>
      <Wrap className={layout.pageBody}>
        {notice}
        <div className={styles.grid}>
          <article className={styles.main} aria-label="活动说明">
            {event.cover && (
              <figure className={styles.cover}>
                <Img image={event.cover} eager sizes="(min-width: 1024px) 760px, 100vw" />
              </figure>
            )}
            <h2 className={styles.mainTitle}>活动说明</h2>
            {detail.body || detail.bodyText ? (
              <RichText body={detail.body} text={detail.bodyText} />
            ) : (
              <p className={styles.muted}>主办方暂未补充更多说明。</p>
            )}
            {detail.images.length > 0 && (
              <div className={styles.gallery}>
                {detail.images.map((image, index) => (
                  <figure key={`${image.src}-${index}`}>
                    <Img image={image} sizes="(min-width: 1024px) 380px, 50vw" />
                  </figure>
                ))}
              </div>
            )}
            {(related.news.length > 0 || related.albums.length > 0) && (
              <section className={styles.related} aria-labelledby="related-title">
                <h2 id="related-title">活动回顾与影像</h2>
                <div className={layout.grid2}>
                  {[...related.news, ...related.albums].map((article) => (
                    <ArticleTile key={article.key} article={article} />
                  ))}
                </div>
              </section>
            )}
            {extra}
          </article>
          <aside id="participate" className={styles.aside} aria-label="报名与参与">
            <section className={styles.panel}>
              <h2>参与这场活动</h2>
              <KeyValues
                items={[
                  { label: "开始", value: event.startAt ? formatDateTime(event.startAt) : "待定" },
                  { label: "结束", value: event.endAt ? formatDateTime(event.endAt) : null },
                  { label: "地点", value: event.location || "待公布" },
                  { label: "报名开始", value: event.signup.opensAt ? formatDateTime(event.signup.opensAt) : null },
                  { label: "报名截止", value: event.signup.deadline ? formatDateTime(event.signup.deadline) : null },
                ]}
              />
              {registration?.requirements && (
                <div className={styles.requirements}>
                  <h3>参与条件</h3>
                  <p className="preserve">{registration.requirements}</p>
                </div>
              )}
            </section>
            <ActivitySignup kind={kind} id={id} compact />
            {showExternal && registration && (
              <section className={styles.panel}>
                <h2>{event.signup.label}</h2>
                {event.signup.state === "open" && (
                  <>
                    {safeURL(registration.url) && (
                      <a className={buttonClass("primary")} href={registration.url!} rel="noopener noreferrer">
                        前往外部报名
                        <Icon name="external" size={18} />
                      </a>
                    )}
                    {registration.channelText && <p className="preserve">{registration.channelText}</p>}
                    {registration.qrCode && (
                      <figure className={styles.qr}>
                        <Img image={registration.qrCode} alt="报名渠道二维码" />
                      </figure>
                    )}
                    <p className={styles.muted}>报名和取消规则以受理平台说明为准。</p>
                  </>
                )}
                {registration.checkedAt && <p className={styles.muted}>渠道核验：{formatDateTime(registration.checkedAt)}</p>}
              </section>
            )}
            {registration?.contact && <p className={styles.contact}>参与咨询：{registration.contact}</p>}
            {viewer && (viewer.canViewSignups || viewer.canManageSignup || viewer.canRequestPromotion) && (
              <section className={styles.panel} aria-label="活动管理">
                <h2>活动管理</h2>
                <div className={styles.manage}>
                  {viewer.canManageSignup && (
                    <Link href={`/activities/${kind}/${id}/manage`} className={buttonClass("ghost", "small")}>
                      管理报名问卷
                    </Link>
                  )}
                  {viewer.canViewSignups && (
                    <Link href={`/activities/${kind}/${id}/signups`} className={buttonClass("ghost", "small")}>
                      查看报名与统计
                    </Link>
                  )}
                  {viewer.canRequestPromotion && kind === "community-posts" && (
                    <Link href={`/community/promotions?source=community-posts&id=${id}`} className={buttonClass("ghost", "small")}>
                      申请社团级展示
                    </Link>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </Wrap>
    </>
  );
}
