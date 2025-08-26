import crypto from "crypto";

export function hashVolumeName(base: string): string {
  return crypto.createHash("sha1").update(base).digest("hex").slice(0, 8);
}
