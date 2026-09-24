import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms, list } from "@/lib/content";
import { applyAction } from "../actions";
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const games = await list("games", {}, 1, 100);
  const apps = await p.find({
    collection: "community-applications",
    overrideAccess: false,
    user,
    where: { applicant: { equals: user.id } },
    sort: "-createdAt",
    limit: 10,
    depth: 0,
  });
  return (
    <>
      <PageHeading
        title="申请成为社群管理员"
        eyebrow="BUILD A COMMUNITY"
        description="可选择已有游戏社群，或填写一个尚未建立的游戏项目；通过后自动建立该游戏社群及论坛。"
      />
      <section className="member-shell">
        <p role="status">{(await searchParams).message}</p>
        <form className="member-form" action={applyAction}>
          <label>
            已有游戏（申请新游戏则不选）
            <select name="game">
              <option value="">申请建立新游戏社群</option>
              {games.docs.map((game) => (
                <option value={game.id} key={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            新游戏名称（选择已有游戏后可留空）
            <input name="proposedGame" maxLength={80} />
          </label>
          <label>
            申请说明（至少 10 字）
            <textarea
              name="reason"
              minLength={10}
              maxLength={3000}
              required
              rows={5}
            />
          </label>
          <SubmitButton className="button light">提交审核</SubmitButton>
        </form>
        <h2>我的申请</h2>
        {apps.docs.length ? (
          <ul className="community-list">
            {apps.docs.map((app) => (
              <li key={app.id}>
                <strong>{app.proposedGame}</strong>
                <span>
                  {app.status === "pending"
                    ? "待审核"
                    : app.status === "approved"
                      ? "已通过"
                      : "未通过"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>暂无申请。</p>
        )}
        <Link href="/community">返回游戏社群</Link>
      </section>
    </>
  );
}
