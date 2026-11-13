import type { CollectionConfig } from "payload";

// Access is exclusively through the activity service, after its own permission checks.
export const EventSignupLotteries: CollectionConfig = {
  slug: "event-signup-lotteries",
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: "activityKey", type: "text", required: true, unique: true },
    { name: "candidates", type: "json", required: true },
    { name: "winners", type: "json", required: true },
    { name: "history", type: "json", required: true },
    { name: "revision", type: "text", required: true },
    { name: "drawnBy", type: "text", required: true },
  ],
};
