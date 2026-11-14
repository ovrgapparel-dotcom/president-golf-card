import { createHash, randomBytes } from "crypto";

/** 256-bit random token, base64url (43 chars). Returned to the browser once; never stored raw. */
export function generateGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex. High-entropy input, so a fast hash is appropriate (no salt/KDF needed). */
export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Extracts a well-formed guest token from `Authorization: Bearer <token>`. Returns null otherwise. */
export function tokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (\S+)$/.exec(header);
  if (!match || !TOKEN_RE.test(match[1])) return null;
  return match[1];
}
