function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export class RollorianOuraAgentClient {
  private readonly baseUrl: string
  private readonly token: string

  constructor(options?: { baseUrl?: string; token?: string }) {
    this.baseUrl = (options?.baseUrl ?? requireEnv("ROLLORIAN_OURA_BASE_URL")).replace(/\/$/, "")
    this.token = options?.token ?? requireEnv("ROLLORIAN_OURA_AGENT_TOKEN")
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const message =
        typeof body === "object" && body && "error" in body
          ? String(body.error)
          : `HTTP ${response.status}`
      throw new Error(message)
    }

    return response.json() as Promise<T>
  }

  getStatus() {
    return this.request("/api/agent/v1/status")
  }

  getHealthDay(day: string) {
    return this.request(`/api/agent/v1/health?day=${encodeURIComponent(day)}`)
  }

  getTrends(window: "7d" | "30d") {
    return this.request(`/api/agent/v1/trends?window=${encodeURIComponent(window)}`)
  }
}
