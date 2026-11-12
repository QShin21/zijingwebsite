import { describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import { mediaRef } from '../src/lib/v2/shared';
import { serverURL } from '../src/lib/environment';
function payload(record: unknown) {
  return { findByID: vi.fn(async () => record) } as unknown as Payload;
}
describe('legacy public media through the V2 same-origin file endpoint', () => {
  it.each([
    '/api/media/file/old.png',
    new URL('/api/media/file/old.png', serverURL).href,
    'https://historical.example.invalid/api/media/file/old.png',
    'https://storage.example.invalid/bucket/old.png',
  ])('retains existing files without exposing or depending on stored host %s', async url => {
    const p = payload({ filename: 'old.png', url, width: 12, height: 8, alt: 'Legacy photo' });
    expect(await mediaRef(p, 4)).toEqual({ src: '/api/media/file/old.png', width: 12, height: 8, alt: 'Legacy photo' });
    expect(p.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 4, user: null, overrideAccess: false }));
  });
  it('encodes a real public filename as one path component', async () => {
    expect((await mediaRef(payload({ filename: '合成 图片.png' }), 4))?.src).toBe('/api/media/file/' + encodeURIComponent('合成 图片.png'));
  });
  it.each(['.showcase-videos/private.png', '../private.png', 'dir/private.png', 'dir\\private.png', 'private.svg', 'bad\0.png'])('rejects private or unsupported filename %s', async filename => {
    expect(await mediaRef(payload({ filename, url: '/api/media/file/old.png' }), 4)).toBeNull();
  });
  it('normalizes own-origin URL-only historical metadata', async () => {
    expect((await mediaRef(payload({ url: new URL('/api/media/file/old.png', serverURL).href }), 4))?.src).toBe('/api/media/file/old.png');
  });
  it.each(['https://other.example.invalid/old.png', '//other.example.invalid/old.png', 'data:image/png;base64,AA==', '/api/private/file/old.png'])('does not reflect arbitrary legacy URL %s', async url => {
    expect(await mediaRef(payload({ url }), 4)).toBeNull();
  });
});
