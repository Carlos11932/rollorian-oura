export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { buildAuthorizationUrl } from "@/lib/oura/oauth"
import crypto from "crypto"

export async function GET() {
  const clientId = process.env["OURA_CLIENT_ID"]
  const redirectUri =
    process.env["OURA_REDIRECT_URI"] ??
    `${process.env["NEXTAUTH_URL"]}/api/auth/oura/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: "OURA_CLIENT_ID not configured" },
      { status: 500 },
    )
  }

  const state = crypto.randomBytes(16).toString("hex")
  const url = buildAuthorizationUrl(clientId, redirectUri, state)

  // TODO: store state in a cookie and verify in callback
  return NextResponse.redirect(url)
}
