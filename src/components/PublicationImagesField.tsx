"use client";

import { useField } from "@payloadcms/ui";
import type { JSONFieldClientProps } from "payload";
import { PublicationImagesEditor } from "./PublicationImagesEditor";
import { publicationImages } from "@/lib/publication-images";
import { useT } from "@/components/i18n/LocaleProvider";

export function PublicationImagesField({ path, readOnly }: JSONFieldClientProps) {
  const t = useT();
  const { value, setValue } = useField<unknown>({ path });
  return (
    <PublicationImagesEditor
      label={t("正文配图", "Body images")}
      images={publicationImages(value)}
      onChange={setValue}
      readOnly={readOnly}
    />
  );
}
