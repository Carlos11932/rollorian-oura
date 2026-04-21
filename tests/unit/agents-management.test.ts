import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  prismaMock,
  createAgentTokenMock,
} = vi.hoisted(() => ({
  prismaMock: {
    agentClient: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentCredential: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    agentAuditEvent: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAgentTokenMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/agents/tokens", () => ({
  createAgentToken: createAgentTokenMock,
}))

import { AgentInputError } from "@/lib/agents/errors"
import {
  createAgentClient,
  issueAgentCredential,
  revokeAgentClient,
} from "@/lib/agents/management"

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    name: "Donna",
    kind: "PRIVATE_COMPANION",
    status: "ACTIVE",
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    lastUsedAt: null,
    credentials: [
      {
        id: "credential-1",
        tokenPrefix: "roa_test",
        scopes: ["status:read"],
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
      },
    ],
    auditEvents: [
      {
        id: "event-1",
        action: "status.read",
        outcome: "SUCCESS",
        resourceType: "status",
        resourceId: null,
        idempotencyKey: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ],
    ...overrides,
  }
}

describe("agent management", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createAgentTokenMock.mockReturnValue({
      plainToken: "plain-token",
      tokenHash: "hashed-token",
      tokenPrefix: "roa_test",
    })
    prismaMock.agentClient.create.mockResolvedValue(makeClient())
    prismaMock.agentClient.findUnique.mockResolvedValue(makeClient())
    prismaMock.agentCredential.create.mockResolvedValue({})
    prismaMock.agentCredential.findFirst.mockResolvedValue({
      id: "credential-1",
      revokedAt: null,
    })
    prismaMock.agentCredential.update.mockResolvedValue({})
    prismaMock.agentCredential.updateMany.mockResolvedValue({})
    prismaMock.agentAuditEvent.findMany.mockResolvedValue([])
    prismaMock.$transaction.mockResolvedValue([])
  })

  it("creates an agent client with deduplicated valid scopes and returns the plain token once", async () => {
    const result = await createAgentClient({
      name: " Donna ",
      kind: "PRIVATE_COMPANION",
      scopes: ["status:read", "status:read", "health:read"],
      expiresInDays: 7,
    })

    expect(prismaMock.agentClient.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Donna",
        credentials: {
          create: expect.objectContaining({
            tokenHash: "hashed-token",
            tokenPrefix: "roa_test",
            scopes: ["status:read", "health:read"],
          }),
        },
      }),
    }))
    expect(result.plainToken).toBe("plain-token")
    expect(result.client.credentials).toHaveLength(1)
  })

  it("rejects invalid scopes before issuing a new credential", async () => {
    await expect(issueAgentCredential("agent-1", {
      scopes: ["status:read", "nope:scope" as never],
      expiresInDays: 7,
    })).rejects.toThrowError(new AgentInputError("Invalid scopes: nope:scope"))

    expect(prismaMock.agentCredential.create).not.toHaveBeenCalled()
  })

  it("revokes a client and all active credentials in one transaction", async () => {
    await revokeAgentClient("agent-1")

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.agentClient.update).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      data: { status: "REVOKED" },
    })
    expect(prismaMock.agentCredential.updateMany).toHaveBeenCalledWith({
      where: { agentClientId: "agent-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
