import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { cms } from '@/lib/content';
import { videoFilename, videoPath, videoRange } from '@/lib/showcase-videos';
import { isReservedHonorVideo } from '@/lib/team-honor-videos';
export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'private, no-store' };
async function serve(request: Request, context: { params: Promise<{ filename: string }> }, head = false) {
  const { filename } = await context.params;
  if (!videoFilename.test(filename)) return new Response(null, { status: 404, headers: noStore });
  const p = await cms();
  // A readable showcase is never authority over private honor evidence, including old disclosed identifiers.
  try {
    if (await isReservedHonorVideo(p, filename)) return new Response(null, { status: 404, headers: noStore });
  } catch { return new Response(null, { status: 503, headers: noStore }); }
  const { user } = await p.auth({ headers: request.headers });
  // Author/reviewer can inspect pending media; guests only see published showcases.
  const posts = await p.find({ collection: 'community-showcase', overrideAccess: false, user: user || null,
    where: { videoURL: { equals: '/api/showcase-videos/' + filename } }, depth: 0, limit: 1, select: { title: true } });
  if (!posts.docs.length) return new Response(null, { status: 404, headers: noStore });
  const file = videoPath(filename); const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response(null, { status: 404, headers: noStore });
  const range = videoRange(request.headers.get('range'), info.size);
  if (!range) return new Response(null, { status: 416, headers: { ...noStore, 'Content-Range': `bytes */${info.size}` } });
  const headers = { ...noStore, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    'Content-Length': String(range.end - range.start + 1), ...(range.partial ? { 'Content-Range': `bytes ${range.start}-${range.end}/${info.size}` } : {}) };
  const body = head ? null : Readable.toWeb(createReadStream(file, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range.partial ? 206 : 200, headers });
}
export const GET = (request: Request, context: { params: Promise<{ filename: string }> }) => serve(request, context);
export const HEAD = (request: Request, context: { params: Promise<{ filename: string }> }) => serve(request, context, true);
