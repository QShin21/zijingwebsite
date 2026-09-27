import { communityContacts } from "@/lib/community-contacts";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const contacts = await communityContacts((await params).slug);
  return Response.json(contacts ?? [], { status: contacts ? 200 : 404,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
