import Link from "next/link";
import type { ReactNode } from "react";
import type { EventDetail } from "@/lib/v2";
import { ActivitySignup } from "@/components/ActivitySignup";
import { ActivitySeating } from "@/components/activity-pages/ActivitySeating";
import { safeURL } from "@/lib/rules";
import { ArticleTile, DateBlock, eventTone, signupTone } from "./cards";
import { CommunityChip, DemoPill, Img, KeyValues, PageHero, StatusPill, Wrap, buttonClass } from "./ui";
import { RichText } from "./RichText";
import { PublicationPresentation } from "./PublicationPresentation";
import { Icon } from "./Icon";
import { formatDateTime, formatRange } from "./format";
import layout from "./layout.module.css";
import styles from "./detail.module.css";
import { getT } from "@/lib/i18n/server";
import { eventStateLabel, publicLabel, signupStateLabel } from "@/lib/i18n/labels-public";

/** Shared V2 event page for club events and community events (A4). */
export async function EventDetailView({
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
  const { t, locale } = await getT();
  const { event, registration, related, viewer } = detail;
  const id = event.ref.type === "event" ? event.ref.id : Number(event.key.split(":")[1]);
  const community = event.community;
  const back =
    kind === "events"
      ? { href: "/events", label: t("日程", "Schedule") }
      : {
          href: `/community/${community?.slug ?? ""}/updates`,
          label: t(`${community?.title ?? "社群"} · 活动与通知`, `${community?.title ?? "Community"} · Events & notices`),
        };
  const signupLabel = signupStateLabel(event.signup.state, event.signup.label, locale);
  const signup = signupTone(event);
  const showExternal = event.signup.mode === "external" || event.signup.mode === "channel";
  const images = event.cover && !detail.images.some((image) => image.src === event.cover?.src)
    ? [event.cover, ...detail.images]
    : detail.images;
  return (
    <>
      <PageHero
        tone="stage"
        hue={community?.hue}
        back={back}
        eyebrow={
          community
            ? t(`${community.title} · 社群活动`, `${community.title} · Community event`)
            : event.category
              ? t(`社团活动 · ${event.category}`, `Club event · ${publicLabel(event.category, locale)}`)
              : t("社团活动", "Club event")
        }
        title={event.title}
        description={event.summary}
        meta={
          <>
            <StatusPill tone={eventTone(event)}>{eventStateLabel(event.state, event.stateLabel, locale)}</StatusPill>
            {signup && event.signup.mode !== "none" && (
              <StatusPill tone={signup}>{event.signup.viewerSubmitted ? t("已报名", "Signed up") : signupLabel}</StatusPill>
            )}
            {event.promoted && <StatusPill tone="live">{t("精选", "Featured")}</StatusPill>}
            {event.archived && <StatusPill>{t("历史归档", "Archived")}</StatusPill>}
            {event.demo && <DemoPill />}
          </>
        }
        actions={
          <a href="#participate" className={buttonClass("accent")}>
            {event.signup.state === "open" && !event.signup.viewerSubmitted ? t("去报名", "Sign up") : t("报名与参与", "Sign-up & joining")}
            <Icon name="arrow" size={18} />
          </a>
        }
      >
        <div className={styles.when}>
          <DateBlock iso={event.startAt} size="md" tone="accent" />
          <div>
            <p className={styles.whenTime}>
              <Icon name="clock" size={16} />
              {event.startAt || event.endAt ? formatRange(event.startAt, event.endAt, locale) : t("时间待定", "Time TBA")}
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
          <article className={styles.main} aria-label={t("活动说明", "About this event")}>
            <h2 className={styles.mainTitle}>{t("活动说明", "About this event")}</h2>
            {detail.presentation ? <PublicationPresentation presentation={detail.presentation} images={detail.images} text={detail.bodyText} /> : detail.body || detail.bodyText ? (
              <RichText body={detail.body} text={detail.bodyText} />
            ) : (
              <p className={styles.muted}>{t("主办方暂未补充更多说明。", "The organizers have not added more details yet.")}</p>
            )}
            {!detail.presentation && images.length > 0 && (
              <div className={styles.gallery}>
                {images.map((image, index) => (
                  <figure key={`${image.src}-${index}`}>
                    <a
                      href={image.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={
                        image.alt
                          ? t(`在新窗口查看原图：${image.alt}`, `View original in a new window: ${image.alt}`)
                          : t(`在新窗口查看第 ${index + 1} 张图片原图`, `View image ${index + 1} in a new window`)
                      }
                    >
                      <Img image={image} sizes="(min-width: 600px) 380px, 100vw" />
                    </a>
                  </figure>
                ))}
              </div>
            )}
            {(related.news.length > 0 || related.albums.length > 0) && (
              <section className={styles.related} aria-labelledby="related-title">
                <h2 id="related-title">{t("活动回顾与影像", "Recaps & galleries")}</h2>
                <div className={layout.grid2}>
                  {[...related.news, ...related.albums].map((article) => (
                    <ArticleTile key={article.key} article={article} />
                  ))}
                </div>
              </section>
            )}
            {extra}
          </article>
          <aside id="participate" className={styles.aside} aria-label={t("报名与参与", "Sign-up & joining")}>
            <section className={styles.panel}>
              <h2>{t("参与这场活动", "Join this event")}</h2>
              <KeyValues
                items={[
                  { label: t("开始", "Starts"), value: event.startAt ? formatDateTime(event.startAt, locale) : t("待定", "TBA") },
                  { label: t("结束", "Ends"), value: event.endAt ? formatDateTime(event.endAt, locale) : null },
                  { label: t("地点", "Location"), value: event.location || t("待公布", "TBA") },
                  { label: t("报名开始", "Sign-up opens"), value: event.signup.opensAt ? formatDateTime(event.signup.opensAt, locale) : null },
                  { label: t("报名截止", "Sign-up closes"), value: event.signup.deadline ? formatDateTime(event.signup.deadline, locale) : null },
                ]}
              />
              {registration?.requirements && (
                <div className={styles.requirements}>
                  <h3>{t("参与条件", "Requirements")}</h3>
                  <p className="preserve">{registration.requirements}</p>
                </div>
              )}
            </section>
            <ActivitySignup kind={kind} id={id} compact />
            {showExternal && registration && (
              <section className={styles.panel}>
                <h2>{signupLabel}</h2>
                {event.signup.state === "open" && (
                  <>
                    {safeURL(registration.url) && (
                      <a className={buttonClass("primary")} href={registration.url!} rel="noopener noreferrer">
                        {t("前往外部报名", "Sign up externally")}
                        <Icon name="external" size={18} />
                      </a>
                    )}
                    {registration.channelText && <p className="preserve">{registration.channelText}</p>}
                    {registration.qrCode && (
                      <figure className={styles.qr}>
                        <Img image={registration.qrCode} alt={t("报名渠道二维码", "Sign-up QR code")} />
                      </figure>
                    )}
                    <p className={styles.muted}>{t("报名和取消规则以受理平台说明为准。", "Sign-up and cancellation rules follow the host platform.")}</p>
                  </>
                )}
                {registration.checkedAt && <p className={styles.muted}>{t(`渠道核验：${formatDateTime(registration.checkedAt)}`, `Channel verified: ${formatDateTime(registration.checkedAt, locale)}`)}</p>}
              </section>
            )}
            {registration?.contact && <p className={styles.contact}>
                {t("参与咨询：", "Questions: ")}
                {registration.contact}
              </p>}
            {viewer && (viewer.canViewSignups || viewer.canManageSignup || viewer.canRequestPromotion) && (
              <section className={styles.panel} aria-label={t("活动管理", "Manage event")}>
                <h2>{t("活动管理", "Manage event")}</h2>
                <div className={styles.manage}>
                  {viewer.canManageSignup && (
                    <Link href={`/activities/${kind}/${id}/manage`} className={buttonClass("ghost", "small")}>
                      {t("管理报名问卷", "Manage sign-up form")}
                    </Link>
                  )}
                  {viewer.canViewSignups && (
                    <Link href={`/activities/${kind}/${id}/signups`} className={buttonClass("ghost", "small")}>
                      {t("查看报名与统计", "Sign-ups & stats")}
                    </Link>
                  )}
                  {viewer.canRequestPromotion && kind === "community-posts" && (
                    <Link href={`/community/promotions?source=community-posts&id=${id}`} className={buttonClass("ghost", "small")}>
                      {t("申请社团级展示", "Request club-wide feature")}
                    </Link>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
        {/* Seat selection spans the full width (wide map). It renders only when the server
            reports seating enabled, an own request or review rights for this viewer. */}
        <ActivitySeating kind={kind} id={id} returnTo={event.href} />
      </Wrap>
    </>
  );
}
