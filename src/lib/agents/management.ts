import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { CreateAgentClientInput, IssueAgentCredentialInput } from "./contracts"
import { AGENT_SCOPES, type AgentScope } from "./constants"
import { AgentInputError, AgentNotFoundError } from "./errors"
import { createAgentToken } from "./tokens"
import type {
  AgentAuditEventSummary,
  AgentClientSummary,
} from "./types"

type AgentClientWithRelations = Prisma.AgentClientGetPayload<{
  include: {
    credentials: true
    auditEvents: true
  }
}>

function validateScopes(scopes: string[]): AgentScope[] {
  const invalid = scopes.filter((scope) => !AGENT_SCOPES.includes(scope as AgentScope))

  if (invalid.length > 0) {
    throw new AgentInputError(`Invalid scopes: ${invalid.join(", ")}`)
  }

  return [...new Set(scopes)] as AgentScope[]
}

function expiresAtFromDays(expiresInDays?: number): Date | null {
  if (!expiresInDays) {
    return null
  }

  const expiresAt = new Date()
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays)
  return expiresAt
}

function toClientSummary(client: AgentClientWithRelations): AgentClientSummary {
  return {
    id: client.id,
    name: client.name,
    kind: client.kind,
    status: client.status,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    lastUsedAt: client.lastUsedAt?.toISOString() ?? null,
    credentials: client.credentials
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((credential) => ({
        id: credential.id,
        tokenPrefix: credential.tokenPrefix,
        scopes: validateScopes(credential.scopes),
        createdAt: credential.createdAt.toISOString(),
        expiresAt: credential.expiresAt?.toISOString() ?? null,
        revokedAt: credential.revokedAt?.toISOString() ?? null,
        lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
      })),
    recentEvents: client.auditEvents
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((event) => ({
        id: event.id,
        action: event.action,
        outcome: event.outcome,
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        idempotencyKey: event.idempotencyKey ?? null,
        createdAt: event.createdAt.toISOString(),
      })),
  }
}

async function getAgentClientOrThrow(agentClientId: string) {
  const client = await prisma.agentClient.findUnique({
    where: { id: agentClientId },
    include: {
      credentials: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!client) {
    throw new AgentNotFoundError("Agent connection not found")
  }

  return client
}

export async function listAgentClients(): Promise<AgentClientSummary[]> {
  const clients = await prisma.agentClient.findMany({
    include: {
      credentials: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return clients.map(toClientSummary)
}

export async function listRecentAgentAuditEvents(): Promise<AgentAuditEventSummary[]> {
  const events = await prisma.agentAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    outcome: event.outcome,
    resourceType: event.resourceType ?? null,
    resourceId: event.resourceId ?? null,
    idempotencyKey: event.idempotencyKey ?? null,
    createdAt: event.createdAt.toISOString(),
  }))
}

export async function createAgentClient(
  input: CreateAgentClientInput,
): Promise<{ client: AgentClientSummary; plainToken: string }> {
  const scopes = validateScopes(input.scopes)
  const { plainToken, tokenHash, tokenPrefix } = createAgentToken()
  const expiresAt = expiresAtFromDays(input.expiresInDays)

  const client = await prisma.agentClient.create({
    data: {
      name: input.name.trim(),
      kind: input.kind,
      credentials: {
        create: {
          tokenPrefix,
          tokenHash,
          scopes,
          expiresAt,
        },
      },
    },
    include: {
      credentials: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  return {
    client: toClientSummary(client),
    plainToken,
  }
}

export async function issueAgentCredential(
  agentClientId: string,
  input: IssueAgentCredentialInput,
): Promise<{ client: AgentClientSummary; plainToken: string }> {
  const client = await getAgentClientOrThrow(agentClientId)
  const scopes = validateScopes(input.scopes)
  const { plainToken, tokenHash, tokenPrefix } = createAgentToken()
  const expiresAt = expiresAtFromDays(input.expiresInDays)

  await prisma.agentCredential.create({
    data: {
      agentClientId: client.id,
      tokenPrefix,
      tokenHash,
      scopes,
      expiresAt,
    },
  })

  return {
    client: toClientSummary(await getAgentClientOrThrow(agentClientId)),
    plainToken,
  }
}

export async function revokeAgentCredential(
  agentClientId: string,
  credentialId: string,
): Promise<AgentClientSummary> {
  await getAgentClientOrThrow(agentClientId)

  const credential = await prisma.agentCredential.findFirst({
    where: { id: credentialId, agentClientId },
    select: { id: true, revokedAt: true },
  })

  if (!credential) {
    throw new AgentNotFoundError("Agent credential not found")
  }

  if (!credential.revokedAt) {
    await prisma.agentCredential.update({
      where: { id: credential.id },
      data: { revokedAt: new Date() },
    })
  }

  return toClientSummary(await getAgentClientOrThrow(agentClientId))
}

export async function revokeAgentClient(agentClientId: string): Promise<AgentClientSummary> {
  await getAgentClientOrThrow(agentClientId)

  await prisma.$transaction([
    prisma.agentClient.update({
      where: { id: agentClientId },
      data: { status: "REVOKED" },
    }),
    prisma.agentCredential.updateMany({
      where: { agentClientId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  return toClientSummary(await getAgentClientOrThrow(agentClientId))
}
