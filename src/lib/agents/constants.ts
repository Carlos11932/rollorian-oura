export const AGENT_CLIENT_KINDS = [
  "PRIVATE_COMPANION",
  "MCP_CLIENT",
  "CUSTOM",
] as const

export type AgentClientKind = (typeof AGENT_CLIENT_KINDS)[number]

export const AGENT_SCOPES = [
  "status:read",
  "health:read",
  "trends:read",
] as const

export type AgentScope = (typeof AGENT_SCOPES)[number]

export const AGENT_SCOPE_LABELS: Record<AgentScope, { title: string; description: string }> = {
  "status:read": {
    title: "Status",
    description: "Read the current Oura integration status and sync freshness.",
  },
  "health:read": {
    title: "Daily health",
    description: "Read the aggregated daily health snapshot for a single day.",
  },
  "trends:read": {
    title: "Health trends",
    description: "Read 7-day or 30-day health trends across sleep, stress, and readiness.",
  },
}

export function isAgentScope(value: string): value is AgentScope {
  return AGENT_SCOPES.includes(value as AgentScope)
}
