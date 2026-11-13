"use client";
import { publicationPreview, type PublicationImage } from "@/lib/publication-images";
import styles from "./PublicationImages.module.css";
import { useT } from "./i18n/LocaleProvider";

export function PublicationImages({ images = [] }: { images?: PublicationImage[] }) {
  const t = useT();
  if (!images.length) return null;
  return (
    <div className={styles.images}>
      {images.map((image, index) => (
        <img
          key={index}
          src={publicationPreview(image)}
          alt={image.alt || t(`配图 ${index + 1}`, `Image ${index + 1}`)}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}
