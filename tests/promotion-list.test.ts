import { expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { promotedContent } from "../src/lib/content-promotions";
import { promotionVersion } from "../src/lib/promotion-model";

it("continues past unavailable approved sources to fill the visible promotion list", async () => {
  const post = { id: 2, title: "合成活动", body: "合成正文", game: 10, status: "visible", category: "event", authorName: "合成作者" };
  const snapshot = { title: post.title, body: post.body, authorName: post.authorName, game: 10, kind: "event" };
  const find = vi.fn()
    .mockResolvedValueOnce({ docs: [{ id: 1, sourceCollection: "community-posts", sourceID: 1, approvedVersion: "old", approvedSnapshot: snapshot }], hasNextPage: true })
    .mockResolvedValueOnce({ docs: [{ id: 2, sourceCollection: "community-posts", sourceID: 2, approvedVersion: promotionVersion({ ...post, videoVersion: null }), approvedSnapshot: snapshot }], hasNextPage: false });
  const findByID = vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
    if (collection === "community-posts" && id === 1) return null;
    if (collection === "community-posts") return post;
    return { id: 10, title: "合成社群", slug: "synthetic", _status: "published" };
  });
  const result = await promotedContent({ find, findByID } as unknown as Payload, "event", 1);
  expect(result.map((item) => item.href)).toEqual(["/community/synthetic/updates/2"]);
  expect(find).toHaveBeenCalledTimes(2);
  expect(find.mock.calls[0][0]).toMatchObject({ overrideAccess: false, user: null, page: 1 });
  expect(find.mock.calls[1][0]).toMatchObject({ overrideAccess: false, user: null, page: 2 });
});
