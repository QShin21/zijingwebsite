import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import config from "../src/payload.config";
import { normalizePublicationImages } from "../src/lib/publication-image-storage";
import { normalizeShowcaseImage } from "../src/lib/showcase-images";
import { publicationImageBytes } from "../src/lib/publication-images";
import { processMultipartFormdata } from "../node_modules/payload/dist/uploads/fetchAPI-multipart/index.js";

function request(form: FormData) {
  return new Request("http://localhost/api/events/1", { method: "PATCH", body: form });
}

describe("后台活动配图 multipart 表单", () => {
  let source: string;

  beforeAll(async () => {
    const image = await sharp(randomBytes(1800 * 1800 * 3), {
      raw: { width: 1800, height: 1800, channels: 3 },
    }).png().toBuffer();
    expect(image.length).toBeGreaterThan(9 * 1024 * 1024);
    expect(image.length).toBeLessThan(publicationImageBytes);
    source = `data:image/png;base64,${image.toString("base64")}`;
  });

  it("允许历史后台表单中多张 2 MB 以内的配图", async () => {
    const legacy = `data:image/png;base64,${Buffer.alloc(2 * 1024 * 1024).toString("base64")}`;
    const images = Array.from({ length: 4 }, (_, index) => ({ source: legacy, alt: `合成配图 ${index + 1}` }));
    const form = new FormData();
    form.set("_payload", JSON.stringify({ title: "合成活动", postImages: images }));

    const { fields } = await processMultipartFormdata({ options: (await config).upload, request: request(form) });
    const parsed = JSON.parse(fields._payload);
    expect(parsed.postImages).toHaveLength(4);
    expect(parsed.postImages.map((image: { alt: string }) => image.alt)).toEqual(images.map((image) => image.alt));
  });

  it("继续拒绝过大的表单字段和媒体文件", async () => {
    const options = (await config).upload;
    const fieldForm = new FormData();
    fieldForm.set("_payload", "x".repeat(13 * 1024 * 1024));
    await expect(processMultipartFormdata({ options, request: request(fieldForm) }))
      .rejects.toMatchObject({ status: 413, message: "Multipart limit has been reached" });

    const fileForm = new FormData();
    fileForm.set("file", new File([Buffer.alloc(8 * 1024 * 1024 + 1)], "synthetic.png", { type: "image/png" }));
    await expect(processMultipartFormdata({ options, request: request(fileForm) }))
      .rejects.toMatchObject({ status: 413, message: "File size limit has been reached" });
  });

  it("超过 10 MB 的活动图片仍被拒绝，其他用途仍按原限额校验", async () => {
    const tooLarge = `data:image/png;base64,${Buffer.alloc(publicationImageBytes + 1).toString("base64")}`;
    await expect(normalizePublicationImages([{ source: tooLarge, alt: "" }], []))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining("10 MB") });
    await expect(normalizeShowcaseImage(source)).rejects.toThrow();
    const accepted = await normalizePublicationImages([{ source, alt: "合成大图" }], []);
    expect(accepted[0].source).toMatch(/^data:image\/webp;base64,/);
  });
});
