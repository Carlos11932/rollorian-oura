import type { NextRequest } from "next/server"
import { z } from "zod"

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
})

const internalApiEnvSchema = z.object({
  INTERNAL_API_KEY: z.string().min(1),
})

const cronEnvSchema = z.object({
  CRON_SECRET: z.string().min(1),
})

const ouraOAuthEnvSchema = z.object({
  OURA_CLIENT_ID: z.string().min(1),
  OURA_CLIENT_SECRET: z.string().min(1),
})

const optionalUrlEnvSchema = z.object({
  NEXTAUTH_URL: z.string().url().optional(),
  OURA_REDIRECT_URI: z.string().url().optional(),
})

export function getDatabaseUrl(): string {
  return databaseEnvSchema.parse(process.env).DATABASE_URL
}

export function getCronSecret(): string {
  return cronEnvSchema.parse(process.env).CRON_SECRET
}

export function getInternalApiKey(): string | null {
  const parsed = internalApiEnvSchema.safeParse(process.env)
  return parsed.success ? parsed.data.INTERNAL_API_KEY : null
}

export function getOuraOAuthEnv(): z.infer<typeof ouraOAuthEnvSchema> {
  return ouraOAuthEnvSchema.parse(process.env)
}

export function getAppBaseUrl(request?: NextRequest): string {
  const parsed = optionalUrlEnvSchema.safeParse(process.env)
  if (parsed.success && parsed.data.NEXTAUTH_URL) {
    return parsed.data.NEXTAUTH_URL
  }

  if (!request) {
    throw new Error("NEXTAUTH_URL is not configured and no request was provided")
  }

  const host = request.headers.get("host")
  if (!host) {
    throw new Error("Unable to infer application host from request headers")
  }

  return `https://${host}`
}

export function getOuraRedirectUri(request?: NextRequest): string {
  const parsed = optionalUrlEnvSchema.safeParse(process.env)
  if (parsed.success && parsed.data.OURA_REDIRECT_URI) {
    return parsed.data.OURA_REDIRECT_URI
  }

  return `${getAppBaseUrl(request)}/api/auth/oura/callback`
}
