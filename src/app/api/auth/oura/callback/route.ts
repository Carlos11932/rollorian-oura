export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, saveTokens } from "@/lib/oura/oauth"
import { cookies } from "next/headers"
import { getAppBaseUrl, getOuraOAuthEnv, getOuraRedirectUri } from "@/lib/env"

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request)

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(error)}`)
  }

  // Verify CSRF state cookie
  const cookieStore = await cookies()
  const storedState = cookieStore.get("oura_oauth_state")?.value

  if (!storedState || !state || storedState !== state) {
    cookieStore.delete("oura_oauth_state")
    return NextResponse.json({ error: "invalid_state" }, { status: 400 })
  }

  // Clear the state cookie now that it has been verified
  cookieStore.delete("oura_oauth_state")

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_code`)
  }

  const { OURA_CLIENT_ID: clientId, OURA_CLIENT_SECRET: clientSecret } = getOuraOAuthEnv()
  const redirectUri = getOuraRedirectUri(request)

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri,
    )
    await saveTokens(tokens)
    return NextResponse.redirect(`${baseUrl}/?connected=true`)
  } catch (err) {
    console.error("[oura/callback] OAuth error:", err)
    return NextResponse.redirect(`${baseUrl}/?error=oauth_exchange_failed`)
  }
}
