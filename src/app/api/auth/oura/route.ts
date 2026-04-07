export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { buildAuthorizationUrl } from "@/lib/oura/oauth"
import { cookies } from "next/headers"
import crypto from "crypto"
import { getAppBaseUrl, getOuraOAuthEnv, getOuraRedirectUri } from "@/lib/env"

export async function GET(request: NextRequest) {
  const { OURA_CLIENT_ID: clientId } = getOuraOAuthEnv()
  const redirectUri = getOuraRedirectUri(request)
  const baseUrl = getAppBaseUrl(request)

  const state = crypto.randomBytes(16).toString("hex")
  const url = buildAuthorizationUrl(clientId, redirectUri, state)

  const cookieStore = await cookies()
  cookieStore.set("oura_oauth_state", state, {
    httpOnly: true,
    path: "/api/auth/oura/callback",
    sameSite: "lax",
    maxAge: 600,
    secure: baseUrl.startsWith("https://") || process.env.NODE_ENV === "production",
  })

  return NextResponse.redirect(url)
}
