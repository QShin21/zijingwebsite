import { notFound, redirect } from "next/navigation";
import { list } from "@/lib/content";

/** Keep the original public ID lookup before entering the current detail page. */
export default async function ActivityDirection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value < 1) notFound();
  const doc = (await list("events", { id: { equals: value } }, 1, 1)).docs[0];
  if (!doc) notFound();
  redirect(`/events/${encodeURIComponent(doc.slug)}`);
}
