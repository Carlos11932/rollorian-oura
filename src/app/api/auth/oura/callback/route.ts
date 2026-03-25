export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, saveTokens } from "@/lib/oura/oauth"

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, origin),
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", origin))
  }

  const clientId = process.env["OURA_CLIENT_ID"]
  const clientSecret = process.env["OURA_CLIENT_SECRET"]
  const redirectUri =
    process.env["OURA_REDIRECT_URI"] ??
    `${origin}/api/auth/oura/callback`

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
    return NextResponse.redirect(new URL("/dashboard?connected=true", origin))
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[oura/callback] OAuth error:", err)
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, origin),
    )
  }
}
