import { z } from "zod"
import { AGENT_CLIENT_KINDS, AGENT_SCOPES } from "./constants"

export const createAgentClientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(AGENT_CLIENT_KINDS).default("CUSTOM"),
  scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
})

export const issueAgentCredentialSchema = z.object({
  scopes: z.array(z.enum(AGENT_SCOPES)).min(1),
  expiresInDays: z.number().int().positive().max(365).optional(),
})

export type CreateAgentClientInput = z.infer<typeof createAgentClientSchema>
export type IssueAgentCredentialInput = z.infer<typeof issueAgentCredentialSchema>
