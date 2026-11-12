import "dotenv/config";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { zh } from "@payloadcms/translations/languages/zh";
import { s3Storage } from "@payloadcms/storage-s3";
import sharp from "sharp";
import path from "node:path";
import { Collections } from "./collections";
import { Site } from "./globals/Site";
import { PendingUploads } from "./collections/PendingUploads";
import { email } from "./lib/email";
import {serverURL} from './lib/environment';
if (!process.env.PAYLOAD_SECRET) throw new Error("PAYLOAD_SECRET is required");
export default buildConfig({
  email,
  secret: process.env.PAYLOAD_SECRET,
  serverURL,
  admin: {
    user: "users",
    importMap: { baseDir: path.resolve(process.cwd()) },
    timezones: {
      defaultTimezone: "Asia/Shanghai",
      supportedTimezones: [{ label: "中国标准时间", value: "Asia/Shanghai" }],
    },
  },
  i18n: { supportedLanguages: { zh }, fallbackLanguage: "zh" },
  collections: [...Collections, PendingUploads],
  globals: [Site],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) =>
      defaultFeatures.filter(
        (f) =>
          !["upload", "relationship", "blocks", "inlineBlocks"].includes(f.key),
      ),
  }),
  sharp,
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    push:
      process.env.DB_PUSH === "true" && process.env.APP_ENV === "development",
    migrationDir: path.resolve("src/migrations"),
  }),
  typescript: { outputFile: path.resolve("src/payload-types.ts") },
  csrf: [serverURL],
  cors: [serverURL],
  upload: { limits: { fileSize: 8 * 1024 * 1024 } },
  plugins: process.env.S3_BUCKET
    ? [
        s3Storage({
          collections: { media: true },
          bucket: process.env.S3_BUCKET,
          config: {
            region: process.env.S3_REGION,
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: true,
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
            },
          },
        }),
      ]
    : [],
});
