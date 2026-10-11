import { ActivitySignup } from "@/components/ActivitySignup";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (
    !["events", "community-posts"].includes(kind) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  )
    notFound();
  return (
    <div className="member-shell">
      <h1>填写问卷</h1>
      <ActivitySignup kind={kind} id={Number(id)} />
    </div>
  );
}
