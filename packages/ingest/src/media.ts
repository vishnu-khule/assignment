export function imageMediaType(
  mime: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg";
  if (mime === "image/png") return "image/png";
  if (mime === "image/gif") return "image/gif";
  if (mime === "image/webp") return "image/webp";
  return null;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}
