import { NextRequest } from "next/server"
import crypto from "crypto"

export function validateInternalApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key") ?? ""
  const expected = process.env["INTERNAL_API_KEY"] ?? ""
  if (expected.length === 0) return false
  const a = Buffer.from(key)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
