import type { CollectionBeforeChangeHook, Field } from "payload";
import { normalizePublicationImages } from "../lib/publication-image-storage";

export const postImagesField: Field = {
  name: "postImages",
  label: "正文配图",
  type: "json",
  admin: {
    components: { Field: "@/components/PublicationImagesField#PublicationImagesField" },
  },
};

export const validatePostImages: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
  if (data.postImages !== undefined)
    data.postImages = await normalizePublicationImages(data.postImages, originalDoc?.postImages);
  return data;
};
