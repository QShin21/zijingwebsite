import { safeReturnPath } from "@/components/account-pages/auth-return";

/** Retain only the filters and editor state used by the team workspaces. */
export function teamLoginHref(path: string, query: Record<string, unknown> = {}) {
  const idRoute = /^\/teams\/(manage|recruitment|profiles)\/([1-9]\d*)$/.exec(path);
  const validID = idRoute && Number.isSafeInteger(Number(idRoute[2]));
  const allowed =
    path === "/teams/apply" ? ["edit", "page"]
      : path === "/teams/recruitment" ? ["page", "ownPage", "membersPage"]
        : path === "/teams/manage" ? ["game", "page", "reviewPage"]
          : validID && idRoute[1] === "manage" ? ["edit", "create", "page", "status", "membersPage", "batchesPage"]
            : [];
  const validPath = ["/teams/apply", "/teams/recruitment", "/teams/manage"].includes(path) || validID;
  const search = new URLSearchParams();
  for (const key of ["page", "ownPage", "membersPage", "batchesPage", "reviewPage"] as const) {
    const value = query[key];
    if (allowed.includes(key) && typeof value === "string" && /^\d+$/.test(value)) {
      const page = Number(value);
      if (Number.isSafeInteger(page) && page > 1) search.set(key, String(Math.min(page, 10000)));
    }
  }
  for (const key of ["game", "edit"] as const) {
    const value = query[key];
    if (allowed.includes(key) && typeof value === "string" && /^\d+$/.test(value)) {
      const id = Number(value);
      if (Number.isSafeInteger(id) && id > 0 && id <= 2147483647) search.set(key, String(id));
    }
  }
  if (allowed.includes("status") && typeof query.status === "string" && ["pending", "returned", "approved", "rejected", "withdrawn"].includes(query.status)) {
    search.set("status", query.status);
  }
  if (allowed.includes("create") && typeof query.create === "string" && query.create) search.set("create", "1");
  const suffix = search.toString();
  const destination = safeReturnPath((validPath ? path : "/teams") + (suffix ? `?${suffix}` : ""), "/teams");
  return `/login?returnTo=${encodeURIComponent(destination)}`;
}
