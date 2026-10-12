import path from "node:path";
import { constants } from "node:fs";
import { mkdir, open, lstat, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { APIError, type Payload, type PayloadRequest } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import {
  controlledVideoName,
  controlledVideoVersion,
  validateVideo,
  videoDirectory,
  videoFilename,
  videoPath,
  VIDEO_MAX_BYTES,
} from "./showcase-videos";

// A storage identifier, not a serving endpoint. Only the scoped revision/version endpoint serves these bytes.
const prefix = "/api/private-team-honor-videos/";
const directory = () =>
  path.resolve(process.env.MEDIA_DIR || "media", ".team-honor-videos");
export function privateHonorVideoName(url: string) {
  const name = url.startsWith(prefix) ? url.slice(prefix.length) : "";
  return videoFilename.test(name) ? name : null;
}
export function honorVideoPath(url: string) {
  const name = privateHonorVideoName(url);
  if (name) return path.join(directory(), name);
  const oldName = controlledVideoName(url);
  if (oldName) return videoPath(oldName);
  throw new APIError("荣誉证据只接受本站私有上传的 MP4", 400);
}
export async function saveHonorVideo(file: File) {
  if (file.size > VIDEO_MAX_BYTES || !/\.mp4$/i.test(file.name))
    throw new APIError("请上传 10 MB 以内的 MP4 文件", 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  validateVideo(bytes);
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const url = prefix + randomUUID() + ".mp4";
  await writeFile(honorVideoPath(url), bytes, { flag: "wx", mode: 0o600 });
  return url;
}
export async function discardHonorVideo(url: string) {
  if (privateHonorVideoName(url))
    await unlink(honorVideoPath(url)).catch(() => {});
}
function reservationPath(name: string) {
  return path.join(videoDirectory(), ".team-honor-reserved", name);
}
// Permanent tombstones keep a previously disclosed old identifier private after edits, replacement or withdrawal.
export async function reserveLegacyHonorVideo(url: string) {
  const name = controlledVideoName(url);
  if (!name) return;
  await mkdir(path.dirname(reservationPath(name)), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(
    reservationPath(name),
    "reserved for scoped team honor evidence\n",
    {
      flag: "wx",
      mode: 0o600,
    },
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
}
export async function isReservedHonorVideo(
  p: Payload,
  name: string,
  req?: PayloadRequest,
) {
  if (!videoFilename.test(name)) return true;
  if (
    await lstat(reservationPath(name))
      .then(() => true)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw new APIError("暂时无法核验视频归属", 503);
      })
  )
    return true;
  const url = "/api/showcase-videos/" + name;
  const adapter = p.db as unknown as PostgresAdapter;
  const transactionID = req ? await req.transactionID : null;
  const database =
    transactionID != null
      ? adapter.sessions[String(transactionID)]?.db
      : adapter.drizzle;
  if (!database) throw new APIError("暂时无法核验视频归属", 503);
  // Trusted boolean-only lookup; private record material never leaves the server.
  const result = await database.execute(sql`SELECT EXISTS (
    SELECT 1 FROM team_honor_records WHERE video_u_r_l=${url}
      OR approved_snapshot->>'videoURL'=${url}
      OR history @> jsonb_build_array(jsonb_build_object('approvedSnapshot',jsonb_build_object('videoURL',${url}::text)))
  ) AS reserved`);
  if (result.rows[0]?.reserved) {
    await reserveLegacyHonorVideo(url);
    return true;
  }
  return false;
}
export async function honorVideoVersion(url: string) {
  if (controlledVideoName(url)) {
    await reserveLegacyHonorVideo(url);
    return controlledVideoVersion(url);
  }
  const file = await open(
    honorVideoPath(url),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  ).catch(() => null);
  if (!file) throw new APIError("荣誉视频已不可用，请重新上传后审核", 409);
  try {
    const before = await file.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.size < 24n ||
      before.size > BigInt(VIDEO_MAX_BYTES)
    )
      throw new APIError("荣誉视频已不可用", 409);
    const parts: Buffer[] = [];
    let length = 0;
    for await (const part of file.createReadStream({ autoClose: false })) {
      length += part.length;
      if (length > VIDEO_MAX_BYTES)
        throw new APIError("荣誉视频字节已变化", 409);
      parts.push(part);
    }
    const bytes = Buffer.concat(parts);
    const after = await file.stat({ bigint: true });
    if (
      !after.nlink ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      BigInt(bytes.length) !== before.size
    )
      throw new APIError("荣誉视频字节已变化，请重新提交审核", 409);
    validateVideo(bytes);
    return createHash("sha256").update(bytes).digest("hex");
  } finally {
    await file.close();
  }
}
