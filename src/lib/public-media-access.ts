import type { Access } from "payload";

// Public image metadata stays readable. The file endpoint receives a decoded
// filename, so it must never reach private directories beneath MEDIA_DIR.
export const publicMediaRead: Access = ({ isReadingStaticFile, data }) => {
  if (!isReadingStaticFile) return true;
  const filename = data?.filename;
  return typeof filename === "string" &&
    !filename.startsWith(".") &&
    !/[\/\\\u0000]/.test(filename) &&
    /\.(png|jpe?g|webp)$/i.test(filename);
};
