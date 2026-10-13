import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { profileFixture, saveLoadedProfile } from "../tests/team-profiles-fixture";
import { decideCommunityApplication } from "../src/lib/community-operations";
import { defaultTeamForm, saveTeamRecruitment } from "../src/lib/team-core";
import { teamHonorService } from "../src/lib/team-honor-service";

const root = process.env.REBUILD_QA_ROOT || "";
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" ||
    database.hostname !== "127.0.0.1" || database.port !== "55613" ||
    database.pathname !== "/zijing_rebuild_synthetic" || process.env.REBUILD_QA_PROFILE !== "main" ||
    !root.endsWith("/.data/rebuild-qa-20261013") || process.env.SMTP_HOST || process.env.S3_BUCKET)
  throw new Error("Domain fixtures are limited to this task's synthetic preview database");
const destination = path.join(root, "domain-fixtures.json");
try {
  await fs.access(destination);
  console.log("Synthetic domain scene already exists; preserved without duplicate writes.");
  process.exit(0);
} catch { /* First creation only. */ }
const resolved = await config;
resolved.typescript.autoGenerate = false;
resolved.admin.importMap.autoGenerate = false;
const p = await getPayload({ config: resolved });
const f = await profileFixture(p);
const image = "data:image/png;base64," + (await sharp({
  create: { width: 80, height: 80, channels: 3, background: "#765588" },
}).png().toBuffer()).toString("base64");
await p.update({ collection: "games", id: f.game.id, overrideAccess: true, context: { system: true },
  data: { title: "合成 · 星际竞技社群", summary: "本轮隔离测试社群。仅用于界面与权限验收，所有账号、名片、活动和成绩均为虚构。" } });
const application = await p.create({ collection: "community-applications", user: f.viewer, overrideAccess: false,
  data: { game: f.game.id, applicant: f.viewer.id, proposedGame: "合成 · 星际竞技社群",
    reason: "合成社群管理申请，仅用于验证人工联系入口和当前任职，不向真实人员触达。",
    realName: "合成管理者", phone: "00000000000", wechatQr: image, contactConsent: true } });
await decideCommunityApplication(p, f.admin, application.id, "approved", "合成测试授权", application.updatedAt);
const reviewer = await p.findByID({ collection: "users", id: f.viewer.id, overrideAccess: true, depth: 0 });
if (JSON.stringify(reviewer.roles) !== JSON.stringify(["member"])) throw new Error("Community approval must preserve platform roles");
const first = await p.update({ collection: "teams", id: f.first.id, user: f.admin, overrideAccess: false,
  context: { teamCoreWrite: true }, data: { title: "合成 · 星际竞技代表队", summary: "合成队伍档案，展示组织、招新、队员简介与荣誉的实际服务链路。" } });
const recruitment = (await p.find({ collection: "team-recruitments", overrideAccess: true, depth: 0,
  where: { team: { equals: first.id } }, limit: 1 })).docs[0];
const batch = await saveTeamRecruitment(p, f.admin, { id: recruitment.id, revision: recruitment.updatedAt,
  teamID: first.id, title: "合成 · 秋季代表队选拔", status: "open",
  form: { ...defaultTeamForm, intro: "合成批次：填写个人方向、经历与时间，提交后由当前授权管理员人工审核。", end: "2099-10-13T00:00:00.000Z" } });
await saveLoadedProfile(p, f.member, first.id, null, { displayName: "合成队员 · Nova", position: "指挥 / 战术协作",
  biography: "这是一份由合成账号主动选择展示的队内简介。\n一起复盘，一起进步。", avatar: image, visible: true });
async function honor(title: string) {
  return teamHonorService.change(p, f.member, "submit", { input: {
    team: first.id, title, competition: "合成校际联赛（虚构）", placing: "团体优胜（虚构）",
    date: "2026-10-01", description: "全部成绩与凭证均为合成验收资料，禁止作为真实社团记录发布或导入生产。",
    images: [{ source: image, caption: "合成测试图，不是真实赛事凭证" }],
  } });
}
const submitted = await honor("合成 · 秋季团队荣誉");
const approved = await teamHonorService.change(p, reviewer, "approve", {
  id: submitted.id, revision: submitted.revision, submittedVersion: submitted.submittedVersion,
});
const pending = await honor("合成 · 待审战队记录");
await fs.writeFile(destination, JSON.stringify({
  syntheticOnly: true, externalNotifications: false, officialWeChatVerification: false,
  createdAt: new Date().toISOString(),
  qualificationSetup: "Existing synthetic fixture establishes valid ownership and membership relationships; workflow acceptance belongs to the HTTP/E2E suites.",
  users: {
    member: { id: f.member.id, email: f.member.email, password: f.password, roles: f.member.roles },
    communityReviewer: { id: reviewer.id, email: reviewer.email, password: f.password, roles: reviewer.roles },
    president: { id: f.admin.id, email: f.admin.email, password: f.password, roles: f.admin.roles },
  },
  ids: { game: f.game.id, team: first.id, emptyTeam: f.second.id, communityApplication: application.id,
    recruitment: batch.id, approvedHonor: approved.id, pendingHonor: pending.id },
  routes: {
    community: `/community/${f.game.slug}`, contact: `/community/${f.game.slug}/join`,
    communityReview: "/community/review", communityMembers: `/community/${f.game.slug}/members`,
    showcase: `/community/${f.game.slug}/showcase`, archive: `/community/${f.game.slug}/showcase/team-honors/${first.id}`,
    team: `/teams/${first.slug}`, emptyTeam: `/teams/${f.second.slug}`,
    recruitment: `/teams/recruitment/${batch.id}`, profiles: `/teams/profiles/${first.id}`,
    honorOwn: `/teams/honors?view=mine&team=${first.id}&game=${f.game.id}`,
    honorReview: `/teams/honors?view=review&team=${first.id}&game=${f.game.id}`,
    approvedHonor: `/teams/honors/${approved.id}`, pendingHonor: `/teams/honors/${pending.id}`,
  },
}, null, 2) + "\n", { mode: 0o600 });
await p.destroy();
console.log("Synthetic domain scene created; IDs and task-only accounts are in domain-fixtures.json.");
process.exit(0);
