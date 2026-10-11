import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { communityVideo } from '../src/lib/community-video';
import { validateVideo, videoPath, videoRange } from '../src/lib/showcase-videos';
describe('showcase video formats and transport', () => {
  it('converts official Bilibili iframe code to a safe canonical URL without copying HTML attributes', () => {
    const result = communityVideo('<iframe src="//player.bilibili.com/player.html?bvid=BV1B7411m7LV&amp;page=2&amp;autoplay=1" onload="alert(1)" allowfullscreen="true"></iframe>');
    expect(result?.url).toBe('https://www.bilibili.com/video/BV1B7411m7LV/?p=2');
    expect(result?.embed).toContain('autoplay=0'); expect(result?.embed).toContain('p=2');
    expect(result?.embed).not.toContain('onload');
    expect(communityVideo('<iframe src="https://evil.example/player.html"></iframe>')).toBeNull();
    expect(communityVideo('javascript:alert(1)')).toBeNull();
    expect(communityVideo('https://player.bilibili.com/player.html?aid=x')).toBeNull();
  });
  it('recognizes MP4 resources and distinguishes external HTML pages', () => {
    expect(communityVideo('https://video.example/clip.mp4?sign=abc')?.direct).toBe(true);
    expect(communityVideo('https://www.bilibili.com/video/BV1B7411m7LV/')?.direct).toBe(false);
    const module = { exports: {} as { source: (value: string) => string } };
    runInNewContext(readFileSync('miniprogram/src/lib/video.js', 'utf8'), { module, require: () => ({ origin: 'https://home.thuzijing.top' }) });
    expect(module.exports.source('/api/showcase-videos/12345678-1234-1234-1234-123456789012.mp4')).toContain('https://home.thuzijing.top/');
    expect(module.exports.source('https://www.bilibili.com/video/BV1B7411m7LV/')).toBe('');
    expect(module.exports.source('https://user:password@video.example/clip.mp4')).toBe('');
  });
  it('handles seeks, suffix ranges and invalid ranges without overreading', () => {
    expect(videoRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19, partial: true });
    expect(videoRange('bytes=-10', 100)).toEqual({ start: 90, end: 99, partial: true });
    expect(videoRange('bytes=90-', 100)).toEqual({ start: 90, end: 99, partial: true });
    for (const range of ['bytes=100-', 'bytes=20-10', 'bytes=0-1,3-4', 'bytes=-0']) expect(videoRange(range, 100)).toBeNull();
    expect(() => videoPath('../secret.mp4')).toThrow();
    expect(() => validateVideo(Buffer.from('<script>alert(1)</script>'))).toThrow();
  });
});
