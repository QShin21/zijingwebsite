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

export const metadata = { title: "社群管理员申请审核", robots: { index: false, follow: false } };

export default async function Review({ searchParams }: { searchParams: Promise<{ message?: string; done?: string; page?: string }> }) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canPublish(user)) notFound();
  const query = await searchParams;
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
      eyebrow="COMMUNITY · 社群工作台"
      title="社群管理员申请审核"
      description="先核对申请人和组织计划，再决定批准、退回补充或拒绝。批准后建立对应社群任职，微信建群与拉群由管理员人工完成。"
      back={{ href: "/account", label: "我的事务" }}
      aside={
        <TaskNote title="审核要点" links={[{ href: "/account", label: "返回我的事务" }]}>
          <p>批准需要资料齐全，并由申请人本人同意展示微信名片；缺少任一项时请退回补充并写明原因。</p>
          <p>批准只建立对应社群任职，申请人的原平台角色保留。</p>
        </TaskNote>
      }
    >
      <ul className={work.stats} aria-label="审核概况">
        <li data-hot={apps.totalDocs > 0 || undefined}>
          <strong>{apps.totalDocs}</strong>
          <span>待审核申请</span>
        </li>
      </ul>
      <p className={work.status} role="status">
        {query.message || (query.done ? "审核结果已保存。" : "")}
      </p>
      <Section id="pending-applications" title="待审核申请" description={`共 ${apps.totalDocs} 份，按提交时间排列`}>
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
                      <p className={work.meta}>{app.game ? "申请管理已有社群" : "申请建立新游戏社群"}</p>
                    </div>
                    <StatusPill tone="info">待审核</StatusPill>
                  </header>
                  <div className={work.split}>
                    <div className={work.submission}>
                      <h4>申请人</h4>
                      <KeyValues
                        items={[
                          { label: "姓名", value: app.realName || "待补充" },
                          { label: "手机号", value: app.phone || "待补充" },
                          { label: "昵称", value: person?.name || "账号已不可用" },
                          { label: "邮箱", value: person?.email || "账号已不可用" },
                          {
                            label: "提交时间",
                            value: <time dateTime={app.createdAt}>{new Date(app.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time>,
                          },
                          { label: "账号状态", value: person?.accountStatus === "suspended" ? "已停用" : person ? "正常" : "已不可用" },
                        ]}
                      />
                      <h4>申请说明</h4>
                      <p className="preserve">{app.reason}</p>
                      {app.wechatQr && (
                        <details className={work.disclosure}>
                          <summary>核对微信名片</summary>
                          <figure>
                            <Image unoptimized src={`/community/applications/${app.id}/qr`} width={280} height={280} alt="申请人的微信名片二维码" />
                            <figcaption>
                              <a href={`/community/applications/${app.id}/qr`} target="_blank" rel="noreferrer">
                                查看完整二维码
                              </a>
                            </figcaption>
                          </figure>
                        </details>
                      )}
                    </div>
                    <section className={work.decision} aria-label={`${app.proposedGame}的审核操作`}>
                      <h4>审核决定</h4>
                      <p>名片展示：{contactAuthorized ? "申请人已同意展示微信名片作为进群联系方式" : "申请人尚未同意展示管理联系方式"}</p>
                      {!complete && <p className="form-feedback">此申请资料不全，请退回后联系申请人重新提交。</p>}
                      {!contactAuthorized && (
                        <p className="form-feedback">
                          {applicationContactConsentRequiredMessage}
                          。此记录尚未获得申请人同意，不能批准；请退回申请，由本人勾选“{applicationContactConsentLabel}”后重新提交。
                        </p>
                      )}
                      <ActionForm action={decideCommunityResultAction} className="member-form review-actions">
                        <input type="hidden" name="id" value={app.id} />
                        <input type="hidden" name="revision" value={app.updatedAt} />
                        <input type="hidden" name="returnPage" value={page} />
                        <label>
                          审核意见（退回或拒绝必填）
                          <textarea name="reviewNote" maxLength={1000} rows={4} />
                        </label>
                        <div className={work.actions}>
                          <SubmitButton className="button" name="decision" value="approved" disabled={!complete || !contactAuthorized}>
                            批准
                          </SubmitButton>
                          <SubmitButton className="button light" name="decision" value="returned">
                            退回补充
                          </SubmitButton>
                          <SubmitButton className="button light" name="decision" value="rejected">
                            拒绝
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
          <EmptyState title="目前没有待审核申请" icon="check" compact>
            新申请提交后会出现在这里。已处理结果保存在申请人的记录中。
          </EmptyState>
        )}
        <Pager page={page} totalPages={apps.totalPages} path="/community/review" />
      </Section>
    </TaskFrame>
  );
}
