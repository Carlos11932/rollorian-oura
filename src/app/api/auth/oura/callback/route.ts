import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, saveTokens } from "@/lib/oura/oauth"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`/?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect("/?error=missing_code")
  }

  const clientId = process.env["OURA_CLIENT_ID"]
  const clientSecret = process.env["OURA_CLIENT_SECRET"]
  const redirectUri =
    process.env["OURA_REDIRECT_URI"] ??
    `${process.env["NEXTAUTH_URL"]}/api/auth/oura/callback`

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
    return NextResponse.redirect("/dashboard?connected=true")
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.redirect(`/?error=${encodeURIComponent(message)}`)
  }
}
