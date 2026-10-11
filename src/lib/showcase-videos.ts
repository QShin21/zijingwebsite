import { APIError } from 'payload';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_MAX_BYTES = 12 * 1024 * 1024;
export const videoFilename = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/;
export function videoDirectory() { return path.resolve(process.env.MEDIA_DIR || 'media', '.showcase-videos'); }
export function videoPath(filename: string) {
  if (!videoFilename.test(filename)) throw new Error('无效视频标识');
  return path.join(videoDirectory(), filename);
}
export function validateVideo(data: Buffer) {
  if (data.length < 24 || data.length > VIDEO_MAX_BYTES || data.toString('ascii', 4, 8) !== 'ftyp') throw new APIError('请上传 10 MB 以内的 MP4 文件', 400);
  const boxLength = data.readUInt32BE(0);
  if (boxLength < 16 || boxLength > data.length || boxLength > 1024) throw new APIError('MP4 文件头无效', 400);
  const brands = [data.toString('ascii', 8, 12)];
  for (let i = 16; i + 4 <= boxLength; i += 4) brands.push(data.toString('ascii', i, i + 4));
  if (!brands.some(brand => /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(brand))) throw new APIError('请使用标准 MP4 文件', 400);
  if (!data.includes(Buffer.from('moov')) || !data.includes(Buffer.from('mdat'))) throw new APIError('MP4 视频不完整', 400);
}
export async function saveVideo(file: File) {
  if (file.size > VIDEO_MAX_BYTES || !/\.mp4$/i.test(file.name)) throw new APIError('请上传 10 MB 以内的 MP4 文件', 400);
  const data = Buffer.from(await file.arrayBuffer()); validateVideo(data);
  await mkdir(videoDirectory(), { recursive: true, mode: 0o700 });
  const name = randomUUID() + '.mp4';
  await writeFile(videoPath(name), data, { flag: 'wx', mode: 0o600 });
  return '/api/showcase-videos/' + name;
}
export async function discardVideo(url: string) { await unlink(videoPath(url.split('/').pop() || '')).catch(() => {}); }
export function videoRange(header: string | null, size: number) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start < size && end >= start ? { start, end, partial: true } : null;
}
