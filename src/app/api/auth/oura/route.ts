export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { buildAuthorizationUrl } from "@/lib/oura/oauth"
import { cookies } from "next/headers"
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

  const cookieStore = await cookies()
  cookieStore.set("oura_oauth_state", state, {
    httpOnly: true,
    path: "/api/auth/oura/callback",
    sameSite: "lax",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  })

  return NextResponse.redirect(url)
}
