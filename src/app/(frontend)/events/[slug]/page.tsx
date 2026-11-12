import type { Metadata } from "next";
import { cache } from "react";
import { getEventDetail } from "@/lib/v2";
import { read } from "@/components/v2/data";
import { EventDetailView } from "@/components/v2/EventDetail";

type Props = { params: Promise<{ slug: string }> };
const load = cache((slug: string) =>
  read(getEventDetail, { source: "club", idOrSlug: slug }, `/events/${slug}`, { redirects: true }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await load(slug);
  return {
    title: event.title,
    description: event.summary ?? undefined,
    alternates: { canonical: `/events/${slug}` },
    openGraph: { title: event.title, description: event.summary ?? undefined, url: `/events/${slug}` },
  };
}

export default async function Page({ params }: Props) {
  const detail = await load((await params).slug);
  return <EventDetailView detail={detail} kind="events" />;
}
