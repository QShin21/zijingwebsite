import { cache } from "react";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { cms } from "@/lib/content";
import { canParticipate, canUseCampus } from "@/lib/rules";
import { getSession } from "@/lib/v2";
import type { Viewer } from "@/lib/v2";

/**
 * Server-side bridge from V2 pages to the shared view functions in src/lib/v2.
 * Pages never fetch their own HTTP API; identity always comes from the request.
 */
export const request = cache(async (): Promise<{ payload: Payload; user: User | null }> => {
  const payload = await cms();
  const { user } = await payload.auth({ headers: await headers() });
  return { payload, user: canParticipate(user) ? (user as User) : null };
});

export const session = cache(async (): Promise<Viewer | null> => {
  const { payload, user } = await request();
  if (!user) return null;
  try {
    return (await getSession(payload, user)).viewer;
  } catch {
    return null;
  }
});

type Reader<I, T> = (payload: Payload, viewer: User | null, input: I) => Promise<T>;

export class ViewError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function statusOf(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : 503;
}

/** Published CMS redirects keep old shared links working (public, anonymous read). */
async function legacyRedirect(from: string) {
  const { payload, user } = await request();
  if (!canUseCampus(user)) return;
  const result = await payload
    .find({ collection: "redirects", overrideAccess: false, user: null, depth: 0, limit: 1, where: { from: { equals: from } } })
    .catch(() => null);
  const target = result?.docs[0]?.to;
  if (typeof target === "string" && target) permanentRedirect(target);
}

/**
 * Calls a V2 reader. 404 → (CMS redirect or) notFound(); 401 → login with a
 * return path; other failures become a ViewError for the page/error boundary.
 */
export async function read<I, T>(reader: Reader<I, T>, input: I, path?: string, options: { redirects?: boolean } = {}): Promise<T> {
  const { payload, user } = await request();
  let failure: unknown;
  try {
    return await reader(payload, user, input);
  } catch (error) {
    failure = error;
  }
  const status = statusOf(failure);
  if (status === 404) {
    if (options.redirects && path) await legacyRedirect(path);
    notFound();
  }
  if (status === 401) {
    const target = new URLSearchParams({ message: "请登录后访问此栏目" });
    if (path) target.set("returnTo", path);
    redirect(`/login?${target}`);
  }
  throw new ViewError(
    status,
    status === 403 ? "当前账号无权查看此内容" : status === 400 ? "筛选条件无效，请调整后重试" : "内容暂时无法加载，请稍后重试",
  );
}

/** Like read(), but resolves failures to null so an optional section can degrade. */
export async function readOptional<I, T>(reader: Reader<I, T>, input: I): Promise<T | null> {
  const { payload, user } = await request();
  try {
    return await reader(payload, user, input);
  } catch {
    return null;
  }
}

export function pageNumber(value: string | string[] | undefined) {
  const number = Math.floor(Number(Array.isArray(value) ? value[0] : value));
  return Number.isFinite(number) ? Math.max(1, Math.min(10000, number)) : 1;
}
export function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
}
export type Search = Promise<Record<string, string | string[] | undefined>>;
