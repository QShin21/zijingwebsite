import { APIError, type CollectionConfig, type FieldAccess, type PayloadRequest, type Where } from "payload";
import { canUseCampus, canManageStaffRecruitment, type Identity } from "../lib/rules";

async function currentReader(req: PayloadRequest) {
  if (!req.user?.id) return null;
  const user = await req.payload.findByID({ collection: "users", id: req.user.id, req, overrideAccess: true, depth: 0,
    select: { roles: true, accountStatus: true, affiliation: true } }).catch(() => null);
  if (user) req.user = { ...req.user, ...user, collection: "users" };
  return user;
}
const internal: FieldAccess = ({ req }) => canManageStaffRecruitment(req.user as Identity);
export const StaffBatches: CollectionConfig = {
  slug: "staff-batches", labels: { singular: "骨干招新批次", plural: "骨干招新批次" },
  admin: { useAsTitle: "title", description: "通过网页骨干招新工作台管理；当前批次动态出现在首页和全部社群，普通入社不要求填写。" },
  access: {
    read: async ({ req }) => canManageStaffRecruitment(await currentReader(req)) ? true : { state: { in: ["open", "closed"] } } as Where,
    create: ({ req }) => req.context.staffBatchWrite === true && canManageStaffRecruitment(req.user as Identity),
    update: ({ req }) => req.context.staffBatchWrite === true && canManageStaffRecruitment(req.user as Identity),
    delete: () => false,
  },
  hooks: { beforeChange: [({ req, data }) => {
    if (!req.transactionID || req.context.staffBatchWrite !== true || !canManageStaffRecruitment(req.user as Identity)) throw new APIError("请从骨干招新管理工作台操作", 403);
    return data;
  }] },
  fields: [
    { name: "title", type: "text", required: true, maxLength: 120 },
    { name: "description", type: "textarea", maxLength: 5000 },
    { name: "state", type: "select", required: true, options: ["draft", "open", "closed"] },
    { name: "startAt", type: "date" }, { name: "endAt", type: "date" },
    { name: "currentKey", type: "text", unique: true, admin: { hidden: true } },
    { name: "signupForm", type: "json", required: true, admin: { hidden: true } },
  ],
};
export const StaffApplications: CollectionConfig = {
  slug: "staff-applications", labels: { singular: "骨干申请", plural: "骨干申请" },
  admin: { useAsTitle: "memberName", description: "候选资料仅本人及社长/副社长可见；录用后普通成员自动获得骨干身份。" },
  access: {
    read: async ({ req }) => {
      const user = await currentReader(req);
      if (!canUseCampus(user)) return false;
      if (canManageStaffRecruitment(user)) {
        if (!req.context.staffReadAudited) {
          req.context.staffReadAudited = true;
          await req.payload.create({ collection: "audit", req, overrideAccess: true, data: {
            actor: String(user!.id), object: "staff-applications", action: "read-staff-applications", status: "authorized",
          } });
        }
        return true;
      }
      return { applicant: { equals: user!.id } } as Where;
    },
    create: ({ req }) => req.context.staffApplicationWrite === true && canUseCampus(req.user as Identity),
    update: ({ req }) => req.context.staffApplicationWrite === true && canUseCampus(req.user as Identity),
    delete: () => false,
  },
  hooks: { beforeChange: [({ req, data, originalDoc, operation }) => {
    if (!req.transactionID || req.context.staffApplicationWrite !== true || !canUseCampus(req.user as Identity)) throw new APIError("请从本人申请或管理工作台操作", 403);
    if (operation === "update") for (const key of ["batch", "applicant", "requestKey"]) {
      if (data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(originalDoc?.[key])) throw new APIError("不能转移申请批次或申请人", 403);
    }
    return data;
  }] },
  fields: [
    { name: "batch", type: "relationship", relationTo: "staff-batches", required: true, maxDepth: 0 },
    { name: "applicant", type: "relationship", relationTo: "users", required: true, maxDepth: 0 },
    { name: "requestKey", type: "text", required: true, unique: true, admin: { hidden: true } },
    { name: "memberName", type: "text", required: true },
    { name: "batchTitle", type: "text", required: true },
    { name: "department", type: "select", required: true, options: ["execution", "publicity", "both"] },
    { name: "status", type: "select", required: true, options: ["submitted", "reviewing", "returned", "accepted", "rejected", "withdrawn"] },
    { name: "formVersion", type: "text", required: true },
    { name: "questions", type: "json", required: true }, { name: "answers", type: "json", required: true },
    { name: "feedback", type: "textarea", maxLength: 1000 },
    { name: "reviewNotes", type: "textarea", maxLength: 3000, access: { read: internal } },
    { name: "history", type: "json", admin: { hidden: true } },
  ],
};
