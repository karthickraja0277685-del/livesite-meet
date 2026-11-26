import crypto from "crypto";

// Salted scrypt passcode hashing + timing-safe verification
export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(passcode, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasscode(provided: string, stored: string): boolean {
  if (!stored.startsWith("scrypt:")) {
    // Backward-compatible timing-safe check for any pre-existing plain passcode
    const a = Buffer.from(provided);
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [, salt, storedHex] = parts;
  if (!salt || !storedHex) return false;

  const derived = crypto.scryptSync(provided, salt, 64);
  const storedBuf = Buffer.from(storedHex, "hex");
  if (derived.length !== storedBuf.length) return false;

  return crypto.timingSafeEqual(derived, storedBuf);
}
