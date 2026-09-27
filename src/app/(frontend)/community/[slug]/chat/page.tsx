import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, managesGame } from "@/lib/rules";
import { CommunityChat } from "@/components/CommunityChat";
export default async function Chat({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const game = await bySlug("games", slug); if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  return <CommunityChat slug={slug} game={game.id} signedIn={canParticipate(user)} manager={managesGame(user, game.id)} />;
}
