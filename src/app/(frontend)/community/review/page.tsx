import Image from "next/image";
import Link from "next/link";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import {
  CommunityEmpty,
  CommunityPageHeader,
} from "@/components/community-pages/CommunityPages";
import styles from "@/components/community-pages/CommunityPages.module.css";
import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/Content";
import { cms } from "@/lib/content";
import { canPublish } from "@/lib/rules";
import {
  applicationContactConsentLabel,
  applicationContactConsentRequiredMessage,
} from "@/lib/community-status";
import { decideCommunityResultAction } from "../actions";
import { ClubFrame } from "../../_club/ClubPage";
export default async function Review({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; done?: string; page?: string }>;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canPublish(user)) notFound();
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(query.page) || 1)),
  );
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
  const ids = apps.docs.map((app) =>
    typeof app.applicant === "object" ? app.applicant.id : app.applicant,
  );
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
    <ClubFrame className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="审核导航">
        <Link href="/account">我的事务</Link>
        <span aria-hidden="true">/</span>
        <span>社群工作台</span>
      </nav>
      <CommunityPageHeader
        title="社群管理员申请审核"
        description="先核对申请人和组织计划，再决定批准、退回补充或拒绝。批准后建立对应社群任职，微信建群与拉群由管理员人工完成。"
      />
      <div className={styles.sectionHead}>
        <h2>待审核申请</h2>
        <p>共 {apps.totalDocs} 份，按提交时间排列</p>
      </div>
      <p role="status">
        {query.message || (query.done ? "审核结果已保存。" : "")}
      </p>
      {apps.docs.length ? (
        <div className={styles.records}>
          {apps.docs.map((app) => {
            const person = byId.get(
              typeof app.applicant === "object"
                ? app.applicant.id
                : app.applicant,
            );
            const complete = Boolean(
              app.realName && app.phone && app.wechatQr && person,
            );
            const contactAuthorized = app.contactConsent === true;
            return (
              <article className={styles.record} key={app.id}>
                <header className={styles.recordHeader}>
                  <div>
                    <h2>{app.proposedGame}</h2>
                    <p>
                      {app.game ? "申请管理已有社群" : "申请建立新游戏社群"}
                    </p>
                  </div>
                  <span className={styles.status}>待审核</span>
                </header>
                <div className={styles.recordGrid}>
                  <div>
                    <dl className={styles.facts}>
                      <div>
                        <dt>姓名</dt>
                        <dd>{app.realName || "待补充"}</dd>
                      </div>
                      <div>
                        <dt>手机号</dt>
                        <dd>{app.phone || "待补充"}</dd>
                      </div>
                      <div>
                        <dt>昵称</dt>
                        <dd>{person?.name || "账号已不可用"}</dd>
                      </div>
                      <div>
                        <dt>邮箱</dt>
                        <dd>{person?.email || "账号已不可用"}</dd>
                      </div>
                      <div>
                        <dt>提交时间</dt>
                        <dd>
                          <time dateTime={app.createdAt}>
                            {new Date(app.createdAt).toLocaleString("zh-CN", {
                              timeZone: "Asia/Shanghai",
                            })}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt>账号状态</dt>
                        <dd>
                          {person?.accountStatus === "suspended"
                            ? "已停用"
                            : person
                              ? "正常"
                              : "已不可用"}
                        </dd>
                      </div>
                    </dl>
                    <section className={styles.section}>
                      <h3>申请说明</h3>
                      <p className="preserve">{app.reason}</p>
                    </section>
                    {app.wechatQr && (
                      <details className={styles.disclosure}>
                        <summary>核对微信名片</summary>
                        <figure className={styles.applicationQr}>
                          <Image
                            unoptimized
                            src={`/community/applications/${app.id}/qr`}
                            width={280}
                            height={280}
                            alt="申请人的微信名片二维码"
                          />
                          <figcaption>
                            <a
                              href={`/community/applications/${app.id}/qr`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              查看完整二维码
                            </a>
                          </figcaption>
                        </figure>
                      </details>
                    )}
                  </div>
                  <section
                    className={styles.decision}
                    aria-label={`${app.proposedGame}的审核操作`}
                  >
                    <h3>审核决定</h3>
                    <p>
                      名片展示：
                      {contactAuthorized
                        ? "申请人已同意展示微信名片作为进群联系方式"
                        : "申请人尚未同意展示管理联系方式"}
                    </p>
                    {!complete && (
                      <p className="form-feedback">
                        此申请资料不全，请退回后联系申请人重新提交。
                      </p>
                    )}
                    {!contactAuthorized && (
                      <p className="form-feedback">
                        {applicationContactConsentRequiredMessage}
                        。此记录尚未获得申请人同意，不能批准；请退回申请，由本人勾选“
                        {applicationContactConsentLabel}”后重新提交。
                      </p>
                    )}
                    <ActionForm
                      action={decideCommunityResultAction}
                      className="member-form review-actions"
                    >
                      <input type="hidden" name="id" value={app.id} />
                      <input
                        type="hidden"
                        name="revision"
                        value={app.updatedAt}
                      />
                      <input type="hidden" name="returnPage" value={page} />
                      <label>
                        审核意见（退回或拒绝必填）
                        <textarea name="reviewNote" maxLength={1000} rows={4} />
                      </label>
                      <div className="reaction-bar">
                        <SubmitButton
                          className="button"
                          name="decision"
                          value="approved"
                          disabled={!complete || !contactAuthorized}
                        >
                          批准
                        </SubmitButton>
                        <SubmitButton
                          className="button light"
                          name="decision"
                          value="returned"
                        >
                          退回补充
                        </SubmitButton>
                        <SubmitButton
                          className="button light"
                          name="decision"
                          value="rejected"
                        >
                          拒绝
                        </SubmitButton>
                      </div>
                    </ActionForm>
                    <p>批准只建立对应社群任职，申请人的原平台角色保留。</p>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <CommunityEmpty title="目前没有待审核申请">
          <p>新申请提交后会出现在这里。已处理结果保存在申请人的记录中。</p>
          <Link href="/account">返回我的事务</Link>
        </CommunityEmpty>
      )}
      <Pagination
        page={page}
        total={apps.totalPages}
        path="/community/review"
      />
    </ClubFrame>
  );
}
