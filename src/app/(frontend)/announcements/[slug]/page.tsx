import type { Metadata } from "next";
import { cache } from "react";
import { getArticle } from "@/lib/v2";
import { read } from "@/components/v2/data";
import { ArticleView } from "@/components/v2/Feed";

type Props = { params: Promise<{ slug: string }> };
const load = cache((slug: string) =>
  read(getArticle, { kind: "announcement", idOrSlug: slug }, `/announcements/${slug}`, { redirects: true }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await load(slug);
  return {
    title: article.title,
    description: article.summary ?? undefined,
    alternates: { canonical: `/announcements/${slug}` },
    openGraph: { title: article.title, description: article.summary ?? undefined, url: `/announcements/${slug}` },
  };
}

export default async function Announcement({ params }: Props) {
  return <ArticleView detail={await load((await params).slug)} />;
}
