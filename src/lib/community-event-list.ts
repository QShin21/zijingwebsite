import type { Payload } from "payload";
import { promotedContent } from "./content-promotions";

type PublicGame = { id: number; title: string; slug: string };
type CommunityEventEntry = {
  href: string;
  title: string;
  gameTitle: string;
  promoted?: boolean;
  createdAt?: string;
  summary?: string;
};

export async function communityEventPage(
  p: Payload,
  game: PublicGame | undefined,
  page: number,
  limit: number,
) {
  if (game) {
    const result = await p.find({
      collection: "community-posts",
      overrideAccess: false,
      user: null,
      draft: false,
      depth: 0,
      page,
      limit,
      sort: ["-createdAt", "-id"],
      where: { and: [
        { game: { equals: game.id } },
        { category: { equals: "event" } },
        { status: { equals: "visible" } },
      ] },
      select: { title: true, createdAt: true },
    });
    const docs: CommunityEventEntry[] = result.docs.map((post) => ({
      href: `/community/${game.slug}/updates/${post.id}`,
      title: post.title,
      gameTitle: game.title,
      createdAt: post.createdAt,
    }));
    return { docs, totalDocs: result.totalDocs, totalPages: result.totalPages };
  }

  const approved = await promotedContent(p, "event", Infinity);
  const offset = (page - 1) * limit;
  const docs: CommunityEventEntry[] = approved.slice(offset, offset + limit).map((item) => ({
    href: item.href,
    title: item.snapshot.title,
    gameTitle: item.gameTitle,
    summary: item.snapshot.body,
    promoted: true,
  }));
  return { docs, totalDocs: approved.length, totalPages: Math.ceil(approved.length / limit) };
}
