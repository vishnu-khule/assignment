import type { Request } from "express";

/** Best-effort client IP for audit trails (respect trust proxy). */
export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() ?? "unknown";
  }
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}
