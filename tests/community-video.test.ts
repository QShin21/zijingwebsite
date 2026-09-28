import { describe, it, expect } from "vitest";
import { communityVideo } from "../src/lib/community-video";
describe("社区视频安全解析", () => {
  it("B站只使用官方播放器与经过校验的ID", () => {
    expect(communityVideo("https://www.bilibili.com/video/BV1B7411m7LV/?p=2&autoplay=1")?.embed).toBe("https://player.bilibili.com/player.html?autoplay=0&poster=1&bvid=BV1B7411m7LV&p=2");
    expect(communityVideo("https://www.bilibili.com.evil.invalid/video/BV1B7411m7LV/")?.embed).toBeNull();
    expect(communityVideo("https://b23.tv/test")?.embed).toBeNull();
  });
  it("阻止脚本、明文和嵌入凭据", () => {
    for (const url of ["javascript:alert(1)", "http://example.com", "https://a:b@example.com", "data:text/html,test"])
      expect(communityVideo(url)).toBeNull();
  });
});
