import { isDeepStrictEqual } from "node:util";
import {
  APIError,
  type CollectionConfig,
  type CollectionBeforeChangeHook,
  type Field,
  type Where,
} from "payload";
import {
  canParticipate,
  canPublish,
  communityIDs,
  type Identity,
} from "../lib/rules";
import { normalizeSignup } from "../lib/signup-schema";
import { normalizePublicationImages } from "../lib/publication-image-storage";
export const signupFields: Field[] = [
  {
    name: "signupForm",
    label: "活动报名问卷",
    type: "json",
    access: {
      create: ({ req }) =>
        req.context.manageSignupForm === true || req.context.system === true,
      update: ({ req }) =>
        req.context.manageSignupForm === true || req.context.system === true,
    },
    admin: { hidden: true },
  },
  {
    name: "signupImages",
    type: "json",
    access: {
      create: ({ req }) => req.context.manageSignupImages === true,
      update: ({ req }) => req.context.manageSignupImages === true,
      read: ({ req }) => req.context.readSignupImages === true,
    },
    admin: { hidden: true },
  },
  {
    name: "signupEditor",
    type: "ui",
    admin: {
      components: { Field: "@/components/SignupEditorLink#SignupEditorLink" },
    },
  },
];
export const validateSignupForm: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  collection,
  req,
}) => {
  // Payload fills omitted fields from the saved document. Preserve an untouched form as stored.
  if (data.signupForm !== undefined && !isDeepStrictEqual(data.signupForm, originalDoc?.signupForm)) {
    try {
      data.signupForm = normalizeSignup(data.signupForm);
    } catch (error) {
      throw new APIError((error as Error).message, 400);
    }
  }
  if (
    collection.slug === "community-posts" &&
    (data.category || originalDoc?.category) !== "event" &&
    (data.signupForm || originalDoc?.signupForm)?.enabled
  )
    throw new APIError("通知不能启用活动报名", 400);
  if (req.context.manageSignupImages === true && data.signupImages !== undefined) {
    const form = normalizeSignup(data.signupForm ?? originalDoc?.signupForm);
    data.signupImages = await normalizePublicationImages(
      data.signupImages,
      originalDoc?.signupImages,
      new Set(form.questions.map(({ id }) => id)),
      req,
    );
  }
  return data;
};
export const EventSignups: CollectionConfig = {
  slug: "event-signups",
  labels: { singular: "活动报名记录", plural: "活动报名记录" },
  admin: {
    useAsTitle: "eventTitle",
    defaultColumns: ["eventTitle", "member", "createdAt"],
  },
  access: {
    create: ({ req }) =>
      canParticipate(req.user as Identity) &&
      req.context.submitEventSignup === true,
    read: async ({ req }) => {
      if (!canParticipate(req.user as Identity)) return false;
      const fresh = await req.payload.findByID({ collection: "users", id: req.user!.id, req, overrideAccess: true, depth: 0,
        select: { roles: true, accountStatus: true, communityOffices: true } }).catch(() => null);
      if (!canParticipate(fresh)) return false;
      const user = fresh!;
      if (canPublish(user)) return true;
      const scope: Where[] = [{ member: { equals: user.id } }];
      const games = communityIDs(user, "viewSignups");
      if (games.length) {
        const currentReq = { ...req, user: { ...req.user!, ...user, accountStatus: user.accountStatus, communityOffices: user.communityOffices } };
        // Historic attribution is retained, but private reads use the activity's current authority.
        // Organizer is a protected field: this lookup is only for authorization IDs, never returned.
        const events = await req.payload.find({ collection: "events", req: currentReq, overrideAccess: true, draft: true,
          depth: 0, pagination: false, limit: 0, select: { submittedBy: true, game: true }, where: { and: [
            { submittedBy: { equals: user.id } }, { or: [{ game: { in: games } }, { game: { exists: false } }] },
          ] } });
        const posts = await req.payload.find({ collection: "community-posts", req: currentReq, overrideAccess: false,
          depth: 0, pagination: false, limit: 0, select: { title: true }, where: { and: [
            { category: { equals: "event" } }, { game: { in: games } },
          ] } });
        if (events.docs.length) scope.push({ and: [{ activityType: { equals: "events" } }, { activityID: { in: events.docs.map(doc => doc.id) } }] });
        if (posts.docs.length) scope.push({ and: [{ activityType: { equals: "community-posts" } }, { activityID: { in: posts.docs.map(doc => doc.id) } }] });
      }
      return { or: scope };
    },
    update: ({ req }) =>
      canParticipate(req.user as Identity) && req.context.updateEventSignup === true
        ? { member: { equals: req.user!.id } }
        : false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ req, data, operation, originalDoc }) => {
        if (operation === "update") {
          if (
            req.context.updateEventSignup !== true ||
            String(originalDoc?.member?.id ?? originalDoc?.member) !== String(req.user?.id) ||
            Object.keys(data).some((key) =>
              data[key] !== undefined &&
              !["answers", "questions", "formVersion", "updatedAt"].includes(key) &&
              JSON.stringify(data[key]) !== JSON.stringify(originalDoc?.[key]),
            )
          )
            throw new APIError("请从本人报名入口修改作答", 403);
        } else if (req.context.submitEventSignup !== true)
          throw new APIError("请从活动报名入口提交", 403);
        return data;
      },
    ],
  },
  fields: [
    { name: "activityType", type: "text", required: true },
    { name: "activityID", type: "number", required: true, index: true },
    {
      name: "dedupeKey",
      type: "text",
      required: true,
      unique: true,
      admin: { hidden: true },
    },
    {
      name: "member",
      type: "relationship",
      relationTo: "users",
      required: true,
      maxDepth: 0,
    },
    {
      name: "organizer",
      type: "relationship",
      relationTo: "users",
      maxDepth: 0,
    },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    { name: "memberName", type: "text", required: true },
    { name: "eventTitle", type: "text", required: true },
    { name: "formVersion", type: "text", required: true },
    { name: "questions", type: "json", required: true },
    { name: "answers", type: "json", required: true },
  ],
};
