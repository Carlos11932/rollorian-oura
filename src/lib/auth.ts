import { NextRequest } from "next/server"
import crypto from "crypto"

export function validateInternalApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key") ?? ""
  const expected = process.env["INTERNAL_API_KEY"] ?? ""
  if (expected.length === 0) return false
  // Use HMAC comparison so both operands are always the same length,
  // eliminating the length-leaking early return.
  const constant = "internal-api-key-comparison"
  const hmacKey = crypto.createHmac("sha256", constant).update(key).digest()
  const hmacExpected = crypto.createHmac("sha256", constant).update(expected).digest()
  return crypto.timingSafeEqual(hmacKey, hmacExpected)
}
