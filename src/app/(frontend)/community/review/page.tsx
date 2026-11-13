import Image from "next/image";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms } from "@/lib/content";
import { canPublish } from "@/lib/rules";
import { applicationContactConsentLabel, applicationContactConsentRequiredMessage } from "@/lib/community-status";
import { decideCommunityResultAction } from "../actions";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { EmptyState, KeyValues, Pager, Section, StatusPill } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/i18n/locale";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("社群管理员申请审核", "Community admin applications"), robots: { index: false, follow: false } };
}

export default async function Review({ searchParams }: { searchParams: Promise<{ message?: string; done?: string; page?: string }> }) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canPublish(user)) notFound();
  const query = await searchParams;
  const { t, locale } = await getT();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)));
  const apps = await p.find({
    collection: "community-applications",
    overrideAccess: false,
    user,
    where: { status: { equals: "pending" } },
    sort: "createdAt",
    limit: 20,
    page,
    depth: 0,
  });
  const ids = apps.docs.map((app) => (typeof app.applicant === "object" ? app.applicant.id : app.applicant));
  const applicants = ids.length
    ? await p.find({
        collection: "users",
        overrideAccess: false,
        user,
        where: { id: { in: ids } },
        limit: 20,
        depth: 0,
        select: { name: true, email: true, accountStatus: true },
      })
    : { docs: [] };
  const byId = new Map(applicants.docs.map((person) => [person.id, person]));
  return (
    <TaskFrame
      wide
      eyebrow={t("COMMUNITY · 社群工作台", "COMMUNITY · Workspace")}
      title={t("社群管理员申请审核", "Community admin applications")}
      description={t("先核对申请人和组织计划，再决定批准、退回补充或拒绝。批准后建立对应社群任职，微信建群与拉群由管理员人工完成。", "Check the applicant and plan, then approve, return for changes or reject. Approval creates the community position; WeChat groups are handled manually by admins.")}
      back={{ href: "/account", label: t("我的事务", "My tasks") }}
      aside={
        <TaskNote title={t("审核要点", "Review checklist")} links={[{ href: "/account", label: t("返回我的事务", "Back to my tasks") }]}>
          <p>{t("批准需要资料齐全，并由申请人本人同意展示微信名片；缺少任一项时请退回补充并写明原因。", "Approval needs complete details and the applicant's consent to show their WeChat card. If anything is missing, return it with a reason.")}</p>
          <p>{t("批准只建立对应社群任职，申请人的原平台角色保留。", "Approval only creates the community position; the applicant's platform role is unchanged.")}</p>
        </TaskNote>
      }
    >
      <ul className={work.stats} aria-label={t("审核概况", "Review overview")}>
        <li data-hot={apps.totalDocs > 0 || undefined}>
          <strong>{apps.totalDocs}</strong>
          <span>{t("待审核申请", "Pending applications")}</span>
        </li>
      </ul>
      <p className={work.status} role="status">
        {query.message ? localizeAccountMessage(query.message, locale) : query.done ? t("审核结果已保存。", "Review result saved.") : ""}
      </p>
      <Section id="pending-applications" title={t("待审核申请", "Pending applications")} description={t(`共 ${apps.totalDocs} 份，按提交时间排列`, `${apps.totalDocs} in total, by submission time`)}>
        {apps.docs.length ? (
          <div className={work.records}>
            {apps.docs.map((app) => {
              const person = byId.get(typeof app.applicant === "object" ? app.applicant.id : app.applicant);
              const complete = Boolean(app.realName && app.phone && app.wechatQr && person);
              const contactAuthorized = app.contactConsent === true;
              return (
                <article className={work.record} key={app.id} data-state="pending">
                  <header className={work.recordHead}>
                    <div>
                      <h3>{app.proposedGame}</h3>
                      <p className={work.meta}>{app.game ? t("申请管理已有社群", "Manage an existing community") : t("申请建立新游戏社群", "Create a new game community")}</p>
                    </div>
                    <StatusPill tone="info">{t("待审核", "Pending review")}</StatusPill>
                  </header>
                  <div className={work.split}>
                    <div className={work.submission}>
                      <h4>{t("申请人", "Applicant")}</h4>
                      <KeyValues
                        items={[
                          { label: t("姓名", "Name"), value: app.realName || t("待补充", "Missing") },
                          { label: t("手机号", "Mobile"), value: app.phone || t("待补充", "Missing") },
                          { label: t("昵称", "Nickname"), value: person?.name || t("账号已不可用", "Account unavailable") },
                          { label: t("邮箱", "Email"), value: person?.email || t("账号已不可用", "Account unavailable") },
                          {
                            label: t("提交时间", "Submitted"),
                            value: <time dateTime={app.createdAt}>{locale === "en" ? formatDateTime(app.createdAt, "en") : new Date(app.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time>,
                          },
                          { label: t("账号状态", "Account status"), value: person?.accountStatus === "suspended" ? t("已停用", "Suspended") : person ? t("正常", "Active") : t("已不可用", "Unavailable") },
                        ]}
                      />
                      <h4>{t("申请说明", "Reason")}</h4>
                      <p className="preserve">{app.reason}</p>
                      {app.wechatQr && (
                        <details className={work.disclosure}>
                          <summary>{t("核对微信名片", "Check WeChat card")}</summary>
                          <figure>
                            <Image unoptimized src={`/community/applications/${app.id}/qr`} width={280} height={280} alt={t("申请人的微信名片二维码", "Applicant's WeChat card QR code")} />
                            <figcaption>
                              <a href={`/community/applications/${app.id}/qr`} target="_blank" rel="noreferrer">
                                {t("查看完整二维码", "View full QR code")}
                              </a>
                            </figcaption>
                          </figure>
                        </details>
                      )}
                    </div>
                    <section className={work.decision} aria-label={t(`${app.proposedGame}的审核操作`, `Review actions for ${app.proposedGame}`)}>
                      <h4>{t("审核决定", "Decision")}</h4>
                      <p>{contactAuthorized ? t("名片展示：申请人已同意展示微信名片作为进群联系方式", "Card display: the applicant agreed to show their WeChat card as the joining contact") : t("名片展示：申请人尚未同意展示管理联系方式", "Card display: the applicant has not agreed to show a contact")}</p>
                      {!complete && <p className="form-feedback">{t("此申请资料不全，请退回后联系申请人重新提交。", "This application is incomplete. Return it and ask the applicant to resubmit.")}</p>}
                      {!contactAuthorized && (
                        <p className="form-feedback">
                          {t(
                            `${applicationContactConsentRequiredMessage}。此记录尚未获得申请人同意，不能批准；请退回申请，由本人勾选“${applicationContactConsentLabel}”后重新提交。`,
                            "The joining process requires showing a contact for the admins. This applicant has not consented, so it cannot be approved; return it so they can tick the consent box and resubmit.",
                          )}
                        </p>
                      )}
                      <ActionForm action={decideCommunityResultAction} className="member-form review-actions">
                        <input type="hidden" name="id" value={app.id} />
                        <input type="hidden" name="revision" value={app.updatedAt} />
                        <input type="hidden" name="returnPage" value={page} />
                        <label>
                          {t("审核意见（退回或拒绝必填）", "Review note (required to return or reject)")}
                          <textarea name="reviewNote" maxLength={1000} rows={4} />
                        </label>
                        <div className={work.actions}>
                          <SubmitButton className="button" name="decision" value="approved" disabled={!complete || !contactAuthorized}>
                            {t("批准", "Approve")}
                          </SubmitButton>
                          <SubmitButton className="button light" name="decision" value="returned">
                            {t("退回补充", "Return for changes")}
                          </SubmitButton>
                          <SubmitButton className="button light" name="decision" value="rejected">
                            {t("拒绝", "Reject")}
                          </SubmitButton>
                        </div>
                      </ActionForm>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t("目前没有待审核申请", "No applications pending review")} icon="check" compact>
            {t("新申请提交后会出现在这里。已处理结果保存在申请人的记录中。", "New applications appear here. Handled results are kept in the applicant's records.")}
          </EmptyState>
        )}
        <Pager page={page} totalPages={apps.totalPages} path="/community/review" />
      </Section>
    </TaskFrame>
  );
}
