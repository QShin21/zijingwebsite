"use client";
import { useState } from "react";
import type { ImageRef } from "@/lib/v2/types";
import { Icon } from "./v2/Icon";

export function CommunityGameIcon({ image }: { image?: ImageRef | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return image && failed !== image.src ? (
    <img
      src={image.src}
      width={image.width ?? 512}
      height={image.height ?? 512}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(image.src)}
    />
  ) : (
    <Icon name="community" size={56} />
  );
}
