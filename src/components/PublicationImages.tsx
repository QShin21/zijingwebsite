import { publicationPreview, type PublicationImage } from "@/lib/publication-images";
import styles from "./PublicationImages.module.css";

export function PublicationImages({ images = [] }: { images?: PublicationImage[] }) {
  if (!images.length) return null;
  return (
    <div className={styles.images}>
      {images.map((image, index) => (
        <img
          key={index}
          src={publicationPreview(image)}
          alt={image.alt || `配图 ${index + 1}`}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}
