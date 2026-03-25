import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  OURA_CLIENT_ID: z.string().min(1),
  OURA_CLIENT_SECRET: z.string().min(1),
  INTERNAL_API_KEY: z.string().min(32),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export const env = envSchema.parse(process.env)
