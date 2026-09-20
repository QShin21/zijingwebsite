import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";
import sharp from "sharp";
if (process.env.APP_ENV !== "development")
  throw new Error("Development fixture only");
const p = await getPayload({ config });
const existing = await p.find({
  collection: "media",
  where: { filename: { equals: "restore-fixture.png" } },
  overrideAccess: true,
});
if (!existing.docs.length) {
  const data = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#592a91" },
  })
    .png()
    .toBuffer();
  await p.create({
    collection: "media",
    overrideAccess: true,
    data: {
      alt: "恢复演练用纯色测试图片，非社团照片",
      credit: "程序生成的测试像素",
      demo: true,
    },
    file: {
      data,
      size: data.length,
      mimetype: "image/png",
      name: "restore-fixture.png",
    },
  });
}
await p.destroy();
console.log("恢复媒体测试样本已准备");
process.exit(0);
