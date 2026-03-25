import { NextRequest } from "next/server"

export function validateInternalApiKey(request: NextRequest): boolean {
  const key = request.headers.get("x-api-key")
  const expected = process.env["INTERNAL_API_KEY"]
  if (!expected) return false
  return key === expected
}
