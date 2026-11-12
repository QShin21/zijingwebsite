import type { Metadata } from "next";
import { cache } from "react";
import { getArticle } from "@/lib/v2";
import { pageNumber, read, type Search } from "@/components/v2/data";
import { ArticleView } from "@/components/v2/Feed";

type Props = { params: Promise<{ slug: string }>; searchParams: Search };
const load = cache((slug: string, page: number) =>
  read(getArticle, { kind: "album", idOrSlug: slug, page }, `/gallery/${slug}`, { redirects: true }),
);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await load(slug, pageNumber((await searchParams).page));
  return { title: article.title, description: article.summary ?? undefined, alternates: { canonical: `/gallery/${slug}` } };
}

export default async function Album({ params, searchParams }: Props) {
  const { slug } = await params;
  const detail = await load(slug, pageNumber((await searchParams).page));
  return <ArticleView detail={detail} photoPath={`/gallery/${slug}`} />;
}
