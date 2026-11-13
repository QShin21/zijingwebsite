import Link from "next/link";
import { getManage, getMe, getMyApplications, getMySignups, getMySeatReceipts, type PlatformRole } from "@/lib/v2";
import { seatLabel, seatStatusLabels } from "@/lib/activity-seating-model";
import { affiliationLabels } from "@/lib/affiliation";
import { LogoutButton } from "@/components/account-pages/AuthForms";
import { pageNumber, read, readOptional, single, type Search } from "@/components/v2/data";
import { ButtonLink, CommunityChip, EmptyState, KeyValues, LinkTabs, Pager, Section, Wrap } from "@/components/v2/ui";
import { ApplicationCard, MatchCard, MembershipCard, QueueGrid, ReceiptRow, TodoList } from "@/components/v2/cards";
import { ArchiveButton } from "@/components/v2/ArchiveButton";
import { emptyCopy } from "@/components/v2/copy";
import { initial } from "@/components/v2/format";
import { getT } from "@/lib/i18n/server";
import { affiliationLabelsEn, keyedLabel } from "@/lib/i18n/labels-account";
import type { Translate } from "@/lib/i18n/locale";
import layout from "@/components/v2/layout.module.css";
import styles from "./account.module.css";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("我的", "Me"), robots: { index: false, follow: false } };
}

const roleLabelsFor = (t: Translate): Record<PlatformRole, string> => ({
  president: t("社长", "President"),
  vicePresident: t("副社长", "Vice President"),
  backbone: t("骨干", "Staff"),
  communityAdmin: t("社群管理员", "Community admin"),
  honoraryBackbone: t("荣誉骨干", "Honorary staff"),
  member: t("成员", "Member"),
});
const departmentsFor = (t: Translate) => ({ execution: t("执行部", "Operations Dept."), publicity: t("宣传部", "Publicity Dept.") }) as const;
const seatStatusEn: Record<string, string> = { pending: "Pending review", confirmed: "Confirmed", rejected: "Rejected", cancelled: "Cancelled", revoked: "Revoked" };

export default async function Account({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const { t, locale } = await getT();
  const roleLabels = roleLabelsFor(t), departments = departmentsFor(t), empty = emptyCopy(t);
  const affiliation = (key: keyof typeof affiliationLabels) => keyedLabel(locale, key, affiliationLabelsEn, affiliationLabels[key]);
  const seatName = (seat: string) => (locale === "en" ? `Row ${seat.split("-")[0]} Seat ${seat.split("-")[1]}` : seatLabel(seat));
  // Historic notification links used ?view=history#applications-title for the full application list.
  const requested = single(search.view);
  const view = requested === "signups" ? "signups" : requested === "applications" || requested === "history" ? "applications" : undefined;
  const page = pageNumber(search.page);
  const me = await read(getMe, {}, "/account");
  const { viewer } = me;
  const campus = viewer.affiliation === "tsinghua";
  const recordView = !campus && view === "applications" ? undefined : view;
  const tabs = (
    <LinkTabs
      label={t("我的记录", "My records")}
      items={[
        { href: "/account", label: t("总览", "Overview"), current: !recordView },
        { href: "/account?view=signups", label: t("报名与选座", "Sign-ups & seats"), current: view === "signups", count: me.counts.signups },
        ...(campus ? [{ href: "/account?view=applications", label: t("我的申请", "My applications"), current: view === "applications", count: me.counts.applications }] : []),
      ]}
    />
  );
  const identity = (
    <header className={styles.identity}>
      <div className={styles.identityInner}>
        <span className={styles.avatar} aria-hidden="true">
          {initial(viewer.name)}
        </span>
        <div className={styles.who}>
          <p className={styles.kicker}>{t("MY ZIJING · 我的", "MY ZIJING")}</p>
          <h1>{viewer.name}</h1>
          <p className={styles.roles}>
            <span>{affiliation(viewer.affiliation)}</span>
            {campus && (viewer.roles.length ? viewer.roles : (["member"] as PlatformRole[])).map((role) => (
              <span key={role}>{roleLabels[role] ?? role}</span>
            ))}
            {viewer.department && <span>{departments[viewer.department]}</span>}
            {viewer.capabilities.communities.map((office) => (
              <CommunityChip key={office.community.id} community={office.community} link />
            ))}
          </p>
        </div>
        <ul className={styles.numbers}>
          <li>
            <strong>{me.todo.length}</strong>
            <span>{t("待办", "To-do")}</span>
          </li>
          <li>
            <strong>{me.counts.signups}</strong>
            <span>{t("报名", "Sign-ups")}</span>
          </li>
          <li>
            <strong>{me.counts.applications}</strong>
            <span>{t("申请", "Applications")}</span>
          </li>
        </ul>
      </div>
    </header>
  );

  if (recordView) {
    const signups = view === "signups" ? await read(getMySignups, { page, limit: 20 }, "/account?view=signups") : null;
    const seatPage = pageNumber(search.seatPage);
    const seats = view === "signups" ? await read(getMySeatReceipts, { page: seatPage, limit: 20 }, "/account?view=signups") : null;
    const applications = view === "applications" ? await read(getMyApplications, { page, limit: 20 }, "/account?view=applications") : null;
    return (
      <>
        {identity}
        <Wrap className={layout.pageBody}>
          {tabs}
          <section aria-labelledby={view === "signups" ? "signups-title" : "applications-title"}>
          <h2 id={view === "signups" ? "signups-title" : "applications-title"} className={styles.viewTitle}>
            {view === "signups" ? t("全部报名", "All sign-ups") : t("全部申请", "All applications")}
          </h2>
          <p className={styles.archiveHint}>
            {view === "signups"
              ? t("归档仅从“我的赛程”隐藏该活动，不会取消报名；已归档的活动可在此撤销归档。", "Archiving only hides the event from My schedule and doesn't cancel your sign-up. You can unarchive it here.")
              : t("归档仅从“申请进度”隐藏该申请，不会撤回申请或改变审核状态；已归档的申请可在此撤销归档。", "Archiving only hides the application from Application progress. It isn't withdrawn and its review status stays the same. You can unarchive it here.")}
          </p>
          {signups &&
            (signups.docs.length ? (
              <ul className={`${layout.list} ${layout.panel}`}>
                {signups.docs.map((receipt) => (
                  <ReceiptRow
                    key={receipt.key}
                    receipt={receipt}
                    archive={receipt.archiveTarget ? <ArchiveButton target={receipt.archiveTarget} archived={receipt.archived} title={receipt.eventTitle} variant="text" /> : undefined}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState title={empty.mySignups.title} icon="ticket" actions={<ButtonLink href="/events" tone="ghost" size="small">{t("查看可报名活动", "Find events to join")}</ButtonLink>}>
                {empty.mySignups.body}
              </EmptyState>
            ))}
          {signups && <Pager page={signups.page} totalPages={signups.totalPages} path="/account" query={{ view: "signups" }} />}
          {applications &&
            (applications.docs.length ? (
              <div className={layout.grid2}>
                {applications.docs.map((item) => (
                  <ApplicationCard key={item.key} item={item} archive={<ArchiveButton target={item.key} archived={item.archived} title={item.title} variant="text" />} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("还没有申请记录", "No applications yet")} icon="inbox" actions={<ButtonLink href="/join" tone="ghost" size="small">{t("了解加入方式", "Ways to join")}</ButtonLink>}>
                {t("社群管理员、骨干招新、建队与入队申请都会记录在这里。", "Community admin, staff, team creation and team applications are all listed here.")}
              </EmptyState>
            ))}
          {applications && <Pager page={applications.page} totalPages={applications.totalPages} path="/account" query={{ view: "applications" }} />}
          </section>
          {seats && <section aria-labelledby="seat-receipts-title">
            <h2 id="seat-receipts-title" className={styles.viewTitle}>{t("我的选座回执", "My seat receipts")}</h2>
            {seats.docs.length ? <ul className={`${layout.list} ${layout.panel}`}>
              {seats.docs.map(item => <li key={item.key}>
                {item.href ? <Link href={item.href}><strong>{item.title}</strong> · {item.request && (locale === "en" ? seatStatusEn[item.request.status] ?? seatStatusLabels[item.request.status] : seatStatusLabels[item.request.status])} · {item.request?.seats.length ? item.request.seats.map(seatName).join(t("、", ", ")) : t(`${item.request?.requestedCount ?? 0} 个座位`, `${item.request?.requestedCount ?? 0} seat(s)`)} · {t("查看回执与票据 ›", "View receipt and ticket ›")}</Link>
                  : <span>{item.title}</span>}
              </li>)}
            </ul> : <EmptyState title={t("暂无选座记录", "No seat requests yet")} icon="ticket" compact>{t("提交选座申请后可在这里查看状态与票据。", "After you request seats, their status and tickets appear here.")}</EmptyState>}
            {(seatPage > 1 || seats.hasNextPage) && <p>
              {seatPage > 1 && <Link href={`/account?view=signups&page=${page}&seatPage=${seatPage - 1}#seat-receipts-title`}>{t("上一页", "Previous")}</Link>}{" "}
              {t(`第 ${seatPage} 页`, `Page ${seatPage}`)}{" "}
              {seats.hasNextPage && <Link href={`/account?view=signups&page=${page}&seatPage=${seatPage + 1}#seat-receipts-title`}>{t("下一页", "Next")}</Link>}
            </p>}
          </section>}
        </Wrap>
      </>
    );
  }

  const manage = await readOptional(getManage, {});
  return (
    <>
      {identity}
      <Wrap className={layout.pageBody}>
        {tabs}
        <div className={styles.dashboard}>
          <div className={styles.primary}>
            <Section id="todo" title={t("待办", "To-do")} count={me.todo.length}>
              {me.todo.length ? (
                <TodoList items={me.todo} />
              ) : (
                <EmptyState title={empty.todo.title} icon="check" compact actions={<ButtonLink href="/events" tone="ghost" size="small">{t("浏览日程", "Browse schedule")}</ButtonLink>}>
                  {empty.todo.body}
                </EmptyState>
              )}
            </Section>
            <Section id="upcoming" title={t("我的赛程", "My schedule")} more={{ href: "/account?view=signups", label: t("全部报名", "All sign-ups") }}>
              {me.counts.archivedUpcoming > 0 && (
                <p className={styles.archiveHint}>{t(`已归档 ${me.counts.archivedUpcoming} 项赛程，可在“全部报名”中查看并撤销归档。`, `${me.counts.archivedUpcoming} archived event(s). View or unarchive them in All sign-ups.`)}</p>
              )}
              {me.upcoming.length ? (
                <div className={styles.list}>
                  {me.upcoming.map((event) => (
                    <MatchCard key={event.key} event={event} archive={<ArchiveButton target={event.key} archived={false} title={event.title} />} />
                  ))}
                </div>
              ) : me.counts.archivedUpcoming > 0 ? (
                <EmptyState title={t("近期赛程均已归档", "All upcoming events are archived")} icon="ticket" compact actions={<ButtonLink href="/account?view=signups" tone="ghost" size="small">{t("查看全部报名", "View all sign-ups")}</ButtonLink>}>
                  {t("报名仍然有效，撤销归档后会重新显示在这里。", "Your sign-ups still count. Unarchive them to show them here again.")}
                </EmptyState>
              ) : (
                <EmptyState title={empty.mySignups.title} icon="ticket" compact actions={<ButtonLink href="/events" tone="ghost" size="small">{t("查看可报名活动", "Find events to join")}</ButtonLink>}>
                  {empty.mySignups.body}
                </EmptyState>
              )}
            </Section>
            {campus && <Section id="applications" title={t("申请进度", "Application progress")} more={{ href: "/account?view=applications", label: t("全部申请", "All applications") }}>
              {me.counts.archivedApplications > 0 && (
                <p className={styles.archiveHint}>{t(`已归档 ${me.counts.archivedApplications} 项申请，可在“全部申请”中查看并撤销归档。`, `${me.counts.archivedApplications} archived application(s). View or unarchive them in All applications.`)}</p>
              )}
              {me.applications.length ? (
                <div className={layout.grid2}>
                  {me.applications.map((item) => (
                    <ApplicationCard key={item.key} item={item} archive={<ArchiveButton target={item.key} archived={false} title={item.title} variant="text" />} />
                  ))}
                </div>
              ) : me.counts.archivedApplications > 0 ? (
                <EmptyState title={t("申请均已归档", "All applications are archived")} icon="inbox" compact actions={<ButtonLink href="/account?view=applications" tone="ghost" size="small">{t("查看全部申请", "View all applications")}</ButtonLink>}>
                  {t("归档不会撤回申请，撤销归档后会重新显示在这里。", "Archiving doesn't withdraw an application. Unarchive it to show it here again.")}
                </EmptyState>
              ) : (
                <EmptyState title={t("还没有申请记录", "No applications yet")} icon="inbox" compact actions={<ButtonLink href="/join" tone="ghost" size="small">{t("了解加入方式", "Ways to join")}</ButtonLink>}>
                  {t("社群管理员、骨干招新、建队与入队申请都会记录在这里。", "Community admin, staff, team creation and team applications are all listed here.")}
                </EmptyState>
              )}
            </Section>}
            {campus && <Section id="teams" title={t("我的队伍", "My teams")}>
              {me.memberships.length ? (
                <div className={layout.grid2}>
                  {me.memberships.map((membership) => (
                    <MembershipCard key={membership.id} membership={membership} />
                  ))}
                </div>
              ) : (
                <EmptyState title={t("暂无代表队成员记录", "No team memberships yet")} icon="trophy" compact actions={<ButtonLink href="/teams/recruitment" tone="ghost" size="small">{t("了解代表队选拔", "About team tryouts")}</ButtonLink>}>
                  {t("入队申请由社群管理员人工选拔，录取不授予平台或社群管理权限。", "Community admins review team applications by hand. Joining a team grants no platform or community admin rights.")}
                </EmptyState>
              )}
            </Section>}
            {manage && manage.queues.length > 0 && (
              <Section id="manage" title={t("管理台", "Admin console")} description={t("按当前授权显示，进入后继续按对象与所属社群判断可处理范围。", "Shown by your current permissions; each item is still checked by object and community.")}>
                <QueueGrid queues={manage.queues} />
              </Section>
            )}
          </div>
          <aside id="settings" className={`${layout.panel} ${styles.settings}`} aria-labelledby="settings-title">
            <h2 id="settings-title">{t("账号", "Account")}</h2>
            <KeyValues
              items={[
                { label: t("昵称", "Nickname"), value: viewer.name },
                { label: t("已验证邮箱", "Verified email"), value: viewer.email },
                { label: t("邮箱身份", "Email identity"), value: affiliation(viewer.affiliation) },
                ...(campus ? [{
                  label: t("平台身份", "Platform role"),
                  value: `${(viewer.roles.length ? viewer.roles : (["member"] as PlatformRole[])).map((role) => roleLabels[role] ?? role).join(t("、", ", "))}${viewer.department ? t(`（${departments[viewer.department]}）`, ` (${departments[viewer.department]})`) : ""}`,
                },
                {
                  label: t("社群任职", "Community roles"),
                  value: viewer.capabilities.communities.length ? viewer.capabilities.communities.map((office) => office.community.title).join(t("、", ", ")) : t("暂无在任社群", "None"),
                }] : []),
              ]}
            />
            {campus && <p className={styles.hint}>{t("平台角色、社群任职与队伍成员关系分别记录。骨干录用后自动授予骨干身份。", "Platform roles, community roles and team memberships are recorded separately. Accepted staff applicants get the staff role automatically.")}</p>}
            <nav className={styles.settingLinks} aria-label={t("账号设置", "Account settings")}>
              <Link href="/account/reset">{t("修改登录密码", "Change password")}</Link>
              <Link href="/privacy">{t("隐私说明", "Privacy")}</Link>
              {campus && <Link href="/community/apply">{t("社群管理员申请", "Apply as community admin")}</Link>}
            </nav>
            <LogoutButton />
          </aside>
        </div>
      </Wrap>
    </>
  );
}
