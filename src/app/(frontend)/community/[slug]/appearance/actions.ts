"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { saveCommunityIcon } from "@/lib/community-icons";
import type { IconCrop } from "@/lib/community-icon-shared";
import { applicationError } from "@/lib/application-error";

export async function updateCommunityIcon(input: {
  slug: string;
  source?: string;
  crop: IconCrop;
  credit: string;
  revision: string;
}) {
  try {
    const p = await cms(),
      { user } = await p.auth({ headers: await headers() });
    const saved = await saveCommunityIcon(p, user, input);
    revalidatePath("/");
    revalidatePath("/community");
    revalidatePath(`/community/${input.slug}`, "layout");
    return { ok: true as const, ...saved };
  } catch (error) {
    return { ok: false as const, error: applicationError(error) };
  }
}
