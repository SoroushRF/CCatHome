import * as crypto from "crypto";

/**
 * Constant-time compare of provided approval token to CCATHOME_APPROVAL_TOKEN.
 */
export function matchesApprovalSecret(provided: string | undefined): boolean {
  const expected = process.env.CCATHOME_APPROVAL_TOKEN;
  if (!provided || !expected) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
