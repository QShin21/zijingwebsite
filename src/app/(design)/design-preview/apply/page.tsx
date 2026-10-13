import { redirect } from "next/navigation";

/** Preserve saved preview links and their draft/receipt query parameters. */
export default async function ApplyDirection({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    submitted?: string;
    edit?: string;
  }>;
}) {
  const current = await searchParams;
  const query = new URLSearchParams();
  for (const name of ["message", "submitted", "edit"] as const) {
    if (typeof current[name] === "string") query.set(name, current[name]);
  }
  redirect(`/community/apply${query.size ? `?${query}` : ""}`);
}
