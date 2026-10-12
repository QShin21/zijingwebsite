import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeamProfileCard } from "../src/components/team-profiles/TeamProfileCard";

describe("队员公开卡片防御性渲染（合成资料）", () => {
  it("文本转义并拒绝损坏/任意头像外链", () => {
    const html = renderToStaticMarkup(
      createElement(TeamProfileCard, {
        profile: {
          displayName: "<script>alert(1)</script>",
          position: "中路",
          biography: "<img onerror=alert(1)>",
          avatar: "https://untrusted.example/private?contact=secret",
        },
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("untrusted.example");
  });
  it("没有头像或位置/简介时仍有可读昵称和默认头像", () => {
    const html = renderToStaticMarkup(
      createElement(TeamProfileCard, {
        profile: {
          displayName: "合成队员",
          position: "",
          biography: "",
          avatar: null,
        },
      }),
    );
    expect(html).toContain("<h3>合成队员</h3>");
    expect(html).not.toContain("<img");
  });
});
