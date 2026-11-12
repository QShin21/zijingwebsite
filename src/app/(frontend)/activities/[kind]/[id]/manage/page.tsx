import { notFound } from "next/navigation";
import { SignupManager } from "@/components/ActivitySignup";

export const metadata = { title: "报名问卷设置" };

/** SignupManager renders its own V2 stage header (ActivityPages .hero) and h1. */
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!["events", "community-posts"].includes(kind) || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  return <SignupManager kind={kind} id={Number(id)} />;
}
