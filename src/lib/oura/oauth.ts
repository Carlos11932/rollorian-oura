import { prisma } from "@/lib/prisma"

const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize"
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token"
const OURA_REVOKE_URL = "https://api.ouraring.com/oauth/revoke"

export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(OURA_AUTH_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set(
    "scope",
    "daily heartrate workout tag session spo2 personal",
  )
  url.searchParams.set("state", state)
  return url.toString()
}

export interface OuraTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<OuraTokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`)
  }
  return res.json() as Promise<OuraTokenResponse>
}

export async function saveTokens(tokens: OuraTokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  await prisma.ouraOAuthToken.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      tokenType: tokens.token_type,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
      tokenType: tokens.token_type,
    },
  })
}

export async function getValidAccessToken(): Promise<string> {
  const token = await prisma.ouraOAuthToken.findUnique({
    where: { id: "singleton" },
  })

  if (!token) {
    throw new Error("No Oura token found. Run OAuth2 flow first.")
  }

  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (token.expiresAt > fiveMinutesFromNow) {
    return token.accessToken
  }

  return refreshAccessToken(token.refreshToken)
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env["OURA_CLIENT_ID"]
  const clientSecret = process.env["OURA_CLIENT_SECRET"]
  if (!clientId || !clientSecret) {
    throw new Error("Oura credentials not configured")
  }

  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${await res.text()}`)
  }

  const newTokens = (await res.json()) as OuraTokenResponse

  // CRITICAL: refresh token is single-use — persist immediately
  await saveTokens(newTokens)

  return newTokens.access_token
}

export async function revokeToken(accessToken: string): Promise<void> {
  await fetch(`${OURA_REVOKE_URL}?access_token=${accessToken}`, {
    method: "POST",
  })
  await prisma.ouraOAuthToken
    .delete({ where: { id: "singleton" } })
    .catch(() => {})
}
