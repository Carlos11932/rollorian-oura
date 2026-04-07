import { NextRequest } from "next/server"
import crypto from "crypto"
import { getInternalApiKey } from "@/lib/env"

export function validateInternalApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key") ?? ""
  const expected = getInternalApiKey() ?? ""
  if (expected.length === 0) return false
  // HMAC with a non-secret constant normalizes both inputs to fixed-length 32-byte
  // digests, eliminating the length-leak that timingSafeEqual would otherwise have.
  // The secrecy is in INTERNAL_API_KEY itself, not in the HMAC key.
  const constant = "internal-api-key-comparison"
  const hmacKey = crypto.createHmac("sha256", constant).update(key).digest()
  const hmacExpected = crypto.createHmac("sha256", constant).update(expected).digest()
  return crypto.timingSafeEqual(hmacKey, hmacExpected)
}
