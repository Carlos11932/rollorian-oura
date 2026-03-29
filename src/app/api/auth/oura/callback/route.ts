export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, saveTokens } from "@/lib/oura/oauth"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const baseUrl =
    process.env["NEXTAUTH_URL"] ??
    `https://${request.headers.get("host") ?? "rollorian-oura.vercel.app"}`

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

  const clientId = process.env["OURA_CLIENT_ID"]
  const clientSecret = process.env["OURA_CLIENT_SECRET"]
  const redirectUri =
    process.env["OURA_REDIRECT_URI"] ??
    `${baseUrl}/api/auth/oura/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Oura credentials not configured" },
      { status: 500 },
    )
  }

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri,
    )
    await saveTokens(tokens)
    return NextResponse.redirect(`${baseUrl}/dashboard?connected=true`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[oura/callback] OAuth error:", err)
    // Return JSON so we can see the actual error in the browser
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
