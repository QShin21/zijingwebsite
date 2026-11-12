import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Buffer } from "node:buffer";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { workflowFeedback } from "../src/components/activity-pages/action-feedback";
import { publicationImageLimit } from "../src/lib/publication-images";

type Result = { ok: boolean; message: string; successHref?: string };
type Action = (form: FormData) => Promise<Result>;
const source = readFileSync("src/app/(frontend)/community/actions.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function harness(allowed = true) {
  const user = { id: 901, accountStatus: "active" };
  const post = { id: 81, game: 31, updatedAt: "synthetic-revision-v2" };
  const payload = {
    auth: vi.fn().mockResolvedValue({ user }),
    findByID: vi.fn(async (options: { collection: string }) =>
      options.collection === "games"
        ? { id: 31, slug: "synthetic-community" }
        : post,
    ),
    update: vi.fn().mockResolvedValue(post),
  };
  const decide = vi.fn().mockResolvedValue(undefined),
    card = vi.fn().mockResolvedValue(undefined),
    join = vi.fn().mockResolvedValue(undefined);
  const saveVideo = vi
      .fn()
      .mockResolvedValue("/api/synthetic-controlled-video"),
    discardVideo = vi.fn().mockResolvedValue(undefined);
  const revalidatePath = vi.fn();
  const redirect = vi.fn(() => {
    throw new Error("synthetic-next-redirect");
  });
  class APIError extends Error {
    isPublic = true;
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  const dependencies: Record<string, unknown> = {
    "next/headers": { headers: async () => new Headers() },
    "next/cache": { revalidatePath },
    "next/navigation": { redirect },
    "@/lib/content": { cms: async () => payload },
    "@/lib/rules": {
      canPublish: () => allowed,
      canReviewShowcase: () => allowed,
    },
    "@/lib/community-operations": {
      decideCommunityApplication: decide,
      updateCommunityCard: card,
      changeCommunityJoin: join,
    },
    "@/lib/showcase-videos": { saveVideo, discardVideo },
    "@/lib/workflow-transactions": {
      workflowTransaction: async (
        _p: unknown,
        _user: unknown,
        _context: unknown,
        work: (req: { user: typeof user }) => Promise<void>,
      ) => work({ user }),
    },
    "@/components/activity-pages/action-feedback": { workflowFeedback },
    "@/lib/application-error": {
      applicationError: (error: Error) => error.message,
    },
    "@/lib/community-status": {},
    "@/lib/publication-images": { publicationImageLimit },
    // Newly shared V2 services are separate boundaries. These legacy adapter
    // cases do not execute them; V2 service/HTTP suites exercise their behavior.
    "@/lib/v2/schedule": {
      beijingScheduleTime: vi.fn(),
      communitySchedule: vi.fn(),
      updateCommunityPostSchedule: vi.fn(),
    },
    "@/lib/v2/writes": {
      submitShowcase: vi.fn(),
      reviewShowcase: vi.fn(),
    },
    payload: { APIError },
  };
  const actions: Record<string, Action> = {};
  runInNewContext(compiled, {
    exports: actions,
    require: (name: string) => {
      if (!(name in dependencies))
        throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    Buffer,
    File,
    URLSearchParams,
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    id: "81",
    game: "31",
    revision: post.updatedAt,
    decision: "approved",
    reviewNote: "合成审核说明",
    returnPage: "2",
  }))
    form.set(key, value);
  return {
    actions,
    form,
    user,
    payload,
    decide,
    card,
    join,
    saveVideo,
    discardVideo,
    revalidatePath,
    redirect,
  };
}

describe("community structured presentation adapters, synthetic service boundaries", () => {
  it("keeps authority and the submitted CAS revision, and navigates only after a confirmed decision", async () => {
    const denied = harness(false);
    expect(
      (await denied.actions.decideCommunityResultAction(denied.form)).ok,
    ).toBe(false);
    expect(denied.decide).not.toHaveBeenCalled();
    expect(denied.revalidatePath).not.toHaveBeenCalled();
    const h = harness();
    const result = await h.actions.decideCommunityResultAction(h.form);
    expect(h.decide).toHaveBeenCalledWith(
      h.payload,
      h.user,
      81,
      "approved",
      "合成审核说明",
      "synthetic-revision-v2",
    );
    expect(result).toMatchObject({
      ok: true,
      successHref: "/community/review?done=1&page=2",
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/community/review");
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it("returns a stale decision as feedback without redirecting or invalidating its form", async () => {
    const h = harness();
    h.decide.mockRejectedValue({
      status: 409,
      isPublic: true,
      message: "申请已更新，请刷新核对",
    });
    const result = await h.actions.decideCommunityResultAction(h.form);
    expect(result).toMatchObject({ ok: false });
    expect(result.successHref).toBeUndefined();
    expect(h.form.get("reviewNote")).toBe("合成审核说明");
    expect(h.form.get("revision")).toBe("synthetic-revision-v2");
    expect(h.revalidatePath).not.toHaveBeenCalled();
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it("asks for saved-record verification after an unexpected error without exposing details or replaying", async () => {
    const h = harness();
    h.decide.mockRejectedValue(new Error("synthetic private SQL detail"));
    const result = await h.actions.decideCommunityResultAction(h.form);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("核对");
    expect(result.message).not.toContain("SQL");
    expect(h.decide).toHaveBeenCalledOnce();
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
  it("retains a rejected contact file and its explicit consent choice", async () => {
    const h = harness();
    const file = new File(["synthetic-only"], "synthetic.png", {
      type: "image/png",
    });
    h.form.set("wechatQr", file);
    h.form.set("contactConsent", "on");
    h.card.mockRejectedValue({
      status: 409,
      isPublic: true,
      message: "名片已更新",
    });
    const result = await h.actions.updateCommunityCardResultAction(h.form);
    expect(result.ok).toBe(false);
    expect(result.successHref).toBeUndefined();
    expect(h.form.get("wechatQr")).toBe(file);
    expect(h.form.get("contactConsent")).toBe("on");
    expect(h.card).toHaveBeenCalledWith(
      h.payload,
      h.user,
      81,
      "synthetic-revision-v2",
      expect.objectContaining({ contactConsent: true }),
    );
    expect(h.revalidatePath).not.toHaveBeenCalled();
    expect(h.redirect).not.toHaveBeenCalled();
  });
  it("rejects stale video edits before saving media and cleans only a newly uploaded failed transaction", async () => {
    const h = harness();
    h.form.set(
      "video",
      new File(["synthetic-only"], "synthetic.mp4", { type: "video/mp4" }),
    );
    h.form.set("revision", "synthetic-stale");
    expect((await h.actions.replaceShowcaseVideoResultAction(h.form)).ok).toBe(
      false,
    );
    expect(h.saveVideo).not.toHaveBeenCalled();
    expect(h.discardVideo).not.toHaveBeenCalled();
    h.form.set("revision", "synthetic-revision-v2");
    h.payload.update.mockRejectedValue(new Error("synthetic database failure"));
    expect((await h.actions.replaceShowcaseVideoResultAction(h.form)).ok).toBe(
      false,
    );
    expect(h.discardVideo).toHaveBeenCalledWith(
      "/api/synthetic-controlled-video",
    );
    expect(h.form.get("video")).toBeInstanceOf(File);
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });
});
