import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import {
  canAppoint,
  canManageStaffRecruitment,
  canParticipate,
  canPublish,
  canReviewCommunityApplication,
  canReviewPromotion,
  canReviewShowcase,
  canSubmitClubContent,
  communityCapability,
  communityIDs,
  managesGame,
} from "../rules";
import { publicWhere, rel, selectFields, type Input } from "./shared";
import type { CommunityCapabilities, PlatformRole, Viewer } from "./types";

const roles = new Set<PlatformRole>(["president", "vicePresident", "backbone", "communityAdmin", "honoraryBackbone", "member"]);

/** Authentication identifies the account, never its current authority. Read only that account. */
export async function refreshViewer(p: Payload, viewer: User | null): Promise<User | null> {
  const id = rel(viewer?.id);
  if (!id) return null;
  try {
    const current = await p.findByID({
      collection: "users", id, overrideAccess: true, depth: 0,
      select: { name: true, email: true, roles: true, department: true, accountStatus: true, communityOffices: true, createdAt: true, updatedAt: true },
    });
    if (!canParticipate(current)) return null;
    // Do not merge stale token fields, including revoked offices and removed platform roles.
    return { ...current, collection: "users" };
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && [403, 404].includes(Number(error.status))) return null;
    throw new APIError("暂时无法读取账号，请稍后重试", 503);
  }
}

export async function requireViewer(p: Payload, viewer: User | null): Promise<User> {
  const current = await refreshViewer(p, viewer);
  if (!current) throw new APIError("请先登录可用账号", 401);
  return current;
}

/** Project an already refreshed account. Never serializes the underlying user document. */
export async function viewerProjection(p: Payload, user: User): Promise<Viewer> {
  const ids = [...new Set(communityIDs(user).map(Number).filter(id => rel(id) !== null))];
  const communities: CommunityCapabilities[] = [];
  if (ids.length) {
    const result = await p.find({
      collection: "games", user: null, overrideAccess: false, draft: false, depth: 0,
      pagination: false, limit: 0, sort: "sort", where: publicWhere({ id: { in: ids } }),
      select: selectFields(["title", "slug", "_status", "demo"]),
    });
    for (const game of result.docs) {
      if (!ids.includes(game.id) || game._status !== "published" || (process.env.APP_ENV === "production" && game.demo)) continue;
      communities.push({
        community: { id: game.id, slug: game.slug, title: game.title, hue: (game.id * 137) % 360 },
        publish: managesGame(user, game.id),
        reviewShowcase: canReviewShowcase(user, game.id),
        manageTeams: communityCapability(user, game.id, "handleJoins"),
        viewSignups: communityCapability(user, game.id, "viewSignups"),
        exportSignups: communityCapability(user, game.id, "exportSignups"),
        // Contact consent is the person's own choice, never implied by a platform role.
        contactCard: communityIDs(user, "contactConsent").includes(String(game.id)),
      });
    }
  }
  return {
    id: user.id, name: user.name, email: user.email,
    roles: (user.roles ?? []).filter((role): role is PlatformRole => roles.has(role)),
    department: user.department === "execution" || user.department === "publicity" ? user.department : null,
    capabilities: {
      publishClub: canPublish(user), submitClubContent: canSubmitClubContent(user),
      reviewCommunityApplications: canReviewCommunityApplication(user), manageStaffRecruitment: canManageStaffRecruitment(user),
      reviewPromotions: canReviewPromotion(user), appoint: canAppoint(user), reviewEstablishments: canPublish(user), communities,
    },
  };
}

export async function getSession(p: Payload, viewer: User | null, input: Input = {}): Promise<{ viewer: Viewer | null }> {
  void input;
  const current = await refreshViewer(p, viewer);
  return { viewer: current ? await viewerProjection(p, current) : null };
}
