export type TeamHonorNavigation = {
  view?: "public" | "mine" | "review";
  page?: number;
  team?: number;
  game?: number;
};

export function teamHonorScopeID(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function teamHonorQuery(navigation: TeamHonorNavigation = {}) {
  const query = new URLSearchParams();
  if (navigation.view === "mine" || navigation.view === "review")
    query.set("view", navigation.view);
  for (const key of ["team", "game", "page"] as const) {
    const value = navigation[key];
    if (value !== undefined && Number.isSafeInteger(value) && value > 0)
      if (key !== "page" || value > 1)
        query.set(
          key,
          String(key === "page" ? Math.min(value, 100000) : value),
        );
  }
  return query.toString();
}

export function teamHonorSubmissionHref(
  scope: Pick<TeamHonorNavigation, "team" | "game"> = {},
) {
  return `/teams/honors?${teamHonorQuery({ ...scope, view: "mine" })}#honor-editor`;
}

export function teamHonorReturnQuery(value: unknown) {
  const query = new URLSearchParams(typeof value === "string" ? value : "");
  const view = query.get("view");
  return teamHonorQuery({
    view: view === "mine" || view === "review" ? view : "public",
    team: teamHonorScopeID(query.get("team")) ?? undefined,
    game: teamHonorScopeID(query.get("game")) ?? undefined,
    page: teamHonorScopeID(query.get("page")) ?? undefined,
  });
}
