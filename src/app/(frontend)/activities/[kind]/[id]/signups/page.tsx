import { notFound } from "next/navigation";
import { SignupManager } from "@/components/ActivitySignup";
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!["events", "community-posts"].includes(kind) || (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) notFound();
  return <div className="page-content"><SignupManager kind={kind} id={Number(id)} readOnly /></div>;
}
