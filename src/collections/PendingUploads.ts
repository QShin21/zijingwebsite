import { APIError, type CollectionConfig, type Where } from "payload";
import { canParticipate, relationID } from "../lib/rules";

/** Temporary bytes never enter public REST projections or the CMS navigation. */
export const PendingUploads: CollectionConfig = {
  slug: "pending-uploads",
  labels: { singular: "临时图片", plural: "临时图片" },
  admin: { hidden: true },
  access: {
    read: ({ req }) => canParticipate(req.user) ? { owner: { equals: req.user!.id } } as Where : false,
    create: ({ req }) => canParticipate(req.user) && req.context.v2UploadWrite === true,
    update: ({ req }) => canParticipate(req.user) && req.context.v2UploadConsume === true
      ? { owner: { equals: req.user!.id } } as Where : false,
    delete: ({ req }) => canParticipate(req.user) && req.context.v2UploadCleanup === true
      ? { and: [{ expiresAt: { less_than_equal: new Date().toISOString() } }, { consumedAt: { exists: false } }] } as Where : false,
  },
  hooks: {
    beforeChange: [({ req, data, originalDoc, operation }) => {
      if (!canParticipate(req.user)) throw new APIError("请登录可用账号", 403);
      if (operation === "create") {
        if (req.context.v2UploadWrite !== true || !["showcase", "publication"].includes(data.purpose) ||
          typeof data.data !== "string" || !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(data.data) ||
          !Number.isSafeInteger(data.width) || !Number.isSafeInteger(data.height) || data.width < 1 || data.height < 1)
          throw new APIError("请通过图片上传入口操作", 403);
        return { ...data, owner: req.user!.id, expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(), consumedAt: null };
      }
      if (req.context.v2UploadConsume !== true || !req.transactionID ||
        Number(relationID(originalDoc?.owner)) !== req.user!.id)
        throw new APIError("图片不可修改", 403);
      if (originalDoc?.consumedAt || Date.parse(originalDoc?.expiresAt) <= Date.now())
        throw new APIError("图片已使用或过期，请重新上传", 409);
      for (const key of ["owner", "purpose", "data", "width", "height", "expiresAt"])
        if (data[key] !== undefined && JSON.stringify(relationID(data[key])) !== JSON.stringify(relationID(originalDoc?.[key])))
          throw new APIError("临时图片内容不可修改", 403);
      return { ...data, consumedAt: new Date().toISOString() };
    }],
  },
  fields: [
    { name: "owner", label: "上传者", type: "relationship", relationTo: "users", maxDepth: 0, index: true },
    { name: "purpose", label: "用途", type: "select", required: true, options: ["showcase", "publication"] },
    { name: "data", label: "图片内容", type: "textarea", required: true, maxLength: 6_000_000 },
    { name: "width", label: "宽度", type: "number", required: true, min: 1 },
    { name: "height", label: "高度", type: "number", required: true, min: 1 },
    { name: "expiresAt", label: "过期时间", type: "date", required: true, index: true },
    { name: "consumedAt", label: "使用时间", type: "date" },
  ],
};
