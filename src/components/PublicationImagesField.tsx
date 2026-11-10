"use client";

import { useField } from "@payloadcms/ui";
import type { JSONFieldClientProps } from "payload";
import { PublicationImagesEditor } from "./PublicationImagesEditor";
import { publicationImages } from "@/lib/publication-images";

export function PublicationImagesField({ path, readOnly }: JSONFieldClientProps) {
  const { value, setValue } = useField<unknown>({ path });
  return (
    <PublicationImagesEditor
      label="正文配图"
      images={publicationImages(value)}
      onChange={setValue}
      readOnly={readOnly}
    />
  );
}
