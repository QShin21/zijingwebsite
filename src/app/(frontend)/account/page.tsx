import Link from "next/link";
import { getManage, getMe, getMyApplications, getMySignups, getMySeatReceipts, type PlatformRole } from "@/lib/v2";
import { seatLabel, seatStatusLabels } from "@/lib/activity-seating-model";
import { affiliationLabels } from "@/lib/affiliation";
import { LogoutButton } from "@/components/account-pages/AuthForms";
import { pageNumber, read, readOptional, single, type Search } from "@/components/v2/data";
import { ButtonLink, CommunityChip, EmptyState, KeyValues, LinkTabs, Pager, Section, Wrap } from "@/components/v2/ui";
import { ApplicationCard, MatchCard, MembershipCard, QueueGrid, ReceiptRow, TodoList } from "@/components/v2/cards";
import { empty } from "@/components/v2/copy";
import { initial } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "./account.module.css";

export const metadata = { title: "我的", robots: { index: false, follow: false } };

const roleLabels: Record<PlatformRole, string> = {
  president: "社长",
  vicePresident: "副社长",
  backbone: "骨干",
  communityAdmin: "社群管理员",
  honoraryBackbone: "荣誉骨干",
  member: "成员",
};
const departments = { execution: "执行部", publicity: "宣传部" } as const;

export default async function Account({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
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
      label="我的记录"
      items={[
        { href: "/account", label: "总览", current: !recordView },
        { href: "/account?view=signups", label: "报名与选座", current: view === "signups", count: me.counts.signups },
        ...(campus ? [{ href: "/account?view=applications", label: "我的申请", current: view === "applications", count: me.counts.applications }] : []),
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
          <p className={styles.kicker}>MY ZIJING · 我的</p>
          <h1>{viewer.name}</h1>
          <p className={styles.roles}>
            <span>{affiliationLabels[viewer.affiliation]}</span>
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
            <span>待办</span>
          </li>
          <li>
            <strong>{me.counts.signups}</strong>
            <span>报名</span>
          </li>
          <li>
            <strong>{me.counts.applications}</strong>
            <span>申请</span>
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
            {view === "signups" ? "全部报名" : "全部申请"}
          </h2>
          {signups &&
            (signups.docs.length ? (
              <ul className={`${layout.list} ${layout.panel}`}>
                {signups.docs.map((receipt) => (
                  <ReceiptRow key={receipt.key} receipt={receipt} />
                ))}
              </ul>
            ) : (
              <EmptyState title={empty.mySignups.title} icon="ticket" actions={<ButtonLink href="/events" tone="ghost" size="small">查看可报名活动</ButtonLink>}>
                {empty.mySignups.body}
              </EmptyState>
            ))}
          {signups && <Pager page={signups.page} totalPages={signups.totalPages} path="/account" query={{ view: "signups" }} />}
          {applications &&
            (applications.docs.length ? (
              <div className={layout.grid2}>
                {applications.docs.map((item) => (
                  <ApplicationCard key={item.key} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState title="还没有申请记录" icon="inbox" actions={<ButtonLink href="/join" tone="ghost" size="small">了解加入方式</ButtonLink>}>
                社群管理员、骨干招新、建队与入队申请都会记录在这里。
              </EmptyState>
            ))}
          {applications && <Pager page={applications.page} totalPages={applications.totalPages} path="/account" query={{ view: "applications" }} />}
          </section>
          {seats && <section aria-labelledby="seat-receipts-title">
            <h2 id="seat-receipts-title" className={styles.viewTitle}>我的选座回执</h2>
            {seats.docs.length ? <ul className={`${layout.list} ${layout.panel}`}>
              {seats.docs.map(item => <li key={item.key}>
                {item.href ? <Link href={item.href}><strong>{item.title}</strong> · {item.request && seatStatusLabels[item.request.status]} · {item.request?.seats.length ? item.request.seats.map(seatLabel).join("、") : `${item.request?.requestedCount ?? 0} 个座位`} · 查看回执与票据 ›</Link>
                  : <span>{item.title}</span>}
              </li>)}
            </ul> : <EmptyState title="暂无选座记录" icon="ticket" compact>提交选座申请后可在这里查看状态与票据。</EmptyState>}
            {(seatPage > 1 || seats.hasNextPage) && <p>
              {seatPage > 1 && <Link href={`/account?view=signups&page=${page}&seatPage=${seatPage - 1}#seat-receipts-title`}>上一页</Link>}{" "}
              第 {seatPage} 页{" "}
              {seats.hasNextPage && <Link href={`/account?view=signups&page=${page}&seatPage=${seatPage + 1}#seat-receipts-title`}>下一页</Link>}
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
            <Section id="todo" title="待办" count={me.todo.length}>
              {me.todo.length ? (
                <TodoList items={me.todo} />
              ) : (
                <EmptyState title={empty.todo.title} icon="check" compact actions={<ButtonLink href="/events" tone="ghost" size="small">浏览日程</ButtonLink>}>
                  {empty.todo.body}
                </EmptyState>
              )}
            </Section>
            <Section id="upcoming" title="我的赛程" more={{ href: "/account?view=signups", label: "全部报名" }}>
              {me.upcoming.length ? (
                <div className={styles.list}>
                  {me.upcoming.map((event) => (
                    <MatchCard key={event.key} event={event} />
                  ))}
                </div>
              ) : (
                <EmptyState title={empty.mySignups.title} icon="ticket" compact actions={<ButtonLink href="/events" tone="ghost" size="small">查看可报名活动</ButtonLink>}>
                  {empty.mySignups.body}
                </EmptyState>
              )}
            </Section>
            {campus && <Section id="applications" title="申请进度" more={{ href: "/account?view=applications", label: "全部申请" }}>
              {me.applications.length ? (
                <div className={layout.grid2}>
                  {me.applications.map((item) => (
                    <ApplicationCard key={item.key} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState title="还没有申请记录" icon="inbox" compact actions={<ButtonLink href="/join" tone="ghost" size="small">了解加入方式</ButtonLink>}>
                  社群管理员、骨干招新、建队与入队申请都会记录在这里。
                </EmptyState>
              )}
            </Section>}
            {campus && <Section id="teams" title="我的队伍">
              {me.memberships.length ? (
                <div className={layout.grid2}>
                  {me.memberships.map((membership) => (
                    <MembershipCard key={membership.id} membership={membership} />
                  ))}
                </div>
              ) : (
                <EmptyState title="暂无代表队成员记录" icon="trophy" compact actions={<ButtonLink href="/teams/recruitment" tone="ghost" size="small">了解代表队选拔</ButtonLink>}>
                  入队申请由社群管理员人工选拔，录取不授予平台或社群管理权限。
                </EmptyState>
              )}
            </Section>}
            {manage && manage.queues.length > 0 && (
              <Section id="manage" title="管理台" description="按当前授权显示，进入后继续按对象与所属社群判断可处理范围。">
                <QueueGrid queues={manage.queues} />
              </Section>
            )}
          </div>
          <aside id="settings" className={`${layout.panel} ${styles.settings}`} aria-labelledby="settings-title">
            <h2 id="settings-title">账号</h2>
            <KeyValues
              items={[
                { label: "昵称", value: viewer.name },
                { label: "已验证邮箱", value: viewer.email },
                { label: "邮箱身份", value: affiliationLabels[viewer.affiliation] },
                ...(campus ? [{
                  label: "平台身份",
                  value: `${(viewer.roles.length ? viewer.roles : (["member"] as PlatformRole[])).map((role) => roleLabels[role] ?? role).join("、")}${viewer.department ? `（${departments[viewer.department]}）` : ""}`,
                },
                {
                  label: "社群任职",
                  value: viewer.capabilities.communities.length ? viewer.capabilities.communities.map((office) => office.community.title).join("、") : "暂无在任社群",
                }] : []),
              ]}
            />
            {campus && <p className={styles.hint}>平台角色、社群任职与队伍成员关系分别记录。骨干录用后自动授予骨干身份。</p>}
            <nav className={styles.settingLinks} aria-label="账号设置">
              <Link href="/account/reset">修改登录密码</Link>
              <Link href="/privacy">隐私说明</Link>
              {campus && <Link href="/community/apply">社群管理员申请</Link>}
            </nav>
            <LogoutButton />
          </aside>
        </div>
      </Wrap>
    </>
  );
}
