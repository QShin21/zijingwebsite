import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { APIError, type Payload } from "payload";
import type { User } from "../payload-types";
import {
  controlledVideoName,
  VIDEO_MAX_BYTES,
  videoPath,
  validateVideo,
  videoRange,
} from "./showcase-videos";
import { currentHonorVersion, teamHonorService } from "./team-honor-service";
import { honorID } from "./team-honor-model";

export async function honorVideoResponse(
  p: Payload,
  user: User | null,
  idValue: unknown,
  request: Request,
  head = false,
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const id = honorID(idValue),
      query = new URL(request.url).searchParams;
    let url: string | null = null,
      expectedHash: string | null = null;
    if (query.get("version")) {
      // Public evidence uses only the approved, currently eligible archive projection.
      const record = await teamHonorService.publicRecord(p, id);
      if (
        record?.videoHref ===
        "/api/team-honor-evidence/" +
          id +
          "/video?version=" +
          query.get("version")
      ) {
        url = record.videoURL;
        expectedHash = record.videoVersion;
      }
    } else if (user) {
      const record = await p
        .findByID({
          collection: "team-honor-records",
          id,
          user,
          overrideAccess: false,
          depth: 0,
        })
        .catch(() => null);
      if (
        record &&
        Number(query.get("revision")) === record.revision &&
        record.videoURL
      ) {
        const observed = await currentHonorVersion(record);
        if (
          record.state === "pending" &&
          observed.version !== record.submittedVersion
        )
          throw new APIError("待审证据已变化，请退回后重提", 409);
        if (
          record.state === "approved" &&
          observed.version !== record.approvedVersion
        )
          throw new APIError("批准证据已变化，公开展示已撤下", 409);
        url = record.videoURL;
        expectedHash = observed.videoVersion;
      }
    }
    const filename = url ? controlledVideoName(url) : null;
    if (!filename || !expectedHash)
      return new Response(null, { status: 404, headers });
    // Open once, without following symlinks; serve the very bytes validated below.
    const file = await open(
      videoPath(filename),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    ).catch(() => null);
    if (!file) return new Response(null, { status: 404, headers });
    let bytes: Buffer;
    try {
      const before = await file.stat({ bigint: true });
      if (
        !before.isFile() ||
        before.size > BigInt(VIDEO_MAX_BYTES) ||
        before.size < 24n
      )
        return new Response(null, { status: 404, headers });
      const parts: Buffer[] = [];
      let total = 0;
      for await (const chunk of file.createReadStream({ autoClose: false })) {
        total += chunk.length;
        if (total > VIDEO_MAX_BYTES)
          return new Response(null, { status: 409, headers });
        parts.push(chunk);
      }
      bytes = Buffer.concat(parts);
      const after = await file.stat({ bigint: true });
      if (
        !after.nlink ||
        before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs ||
        BigInt(total) !== before.size
      )
        return new Response(null, { status: 409, headers });
      validateVideo(bytes);
      if (createHash("sha256").update(bytes).digest("hex") !== expectedHash)
        return new Response(null, { status: 409, headers });
    } finally {
      await file.close();
    }
    const range = videoRange(request.headers.get("range"), bytes.length);
    if (!range)
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": "bytes */" + bytes.length },
      });
    return new Response(
      head ? null : new Uint8Array(bytes.subarray(range.start, range.end + 1)),
      {
        status: range.partial ? 206 : 200,
        headers: {
          ...headers,
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Content-Length": String(range.end - range.start + 1),
          ...(range.partial
            ? {
                "Content-Range": `bytes ${range.start}-${range.end}/${bytes.length}`,
              }
            : {}),
        },
      },
    );
  } catch (error) {
    const status =
      error instanceof APIError && error.status === 409 ? 409 : 404;
    return new Response(null, { status, headers });
  }
}
