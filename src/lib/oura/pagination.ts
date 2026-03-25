export interface OuraListResponse<T> {
  data: T[]
  next_token: string | null
}

export class OuraApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`Oura API error ${status}: ${body}`)
    this.name = "OuraApiError"
  }
}

export async function fetchAllPages<T>(
  initialUrl: string,
  accessToken: string,
): Promise<T[]> {
  const results: T[] = []
  let url: string | null = initialUrl

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new OuraApiError(res.status, await res.text(), url)
    }

    const json = (await res.json()) as OuraListResponse<T>
    results.push(...json.data)

    if (json.next_token) {
      const currentUrl: string = url
      const nextUrl = new URL(currentUrl)
      nextUrl.searchParams.set("next_token", json.next_token)
      nextUrl.searchParams.delete("start_date")
      nextUrl.searchParams.delete("end_date")
      nextUrl.searchParams.delete("start_datetime")
      nextUrl.searchParams.delete("end_datetime")
      url = nextUrl.toString()
    } else {
      url = null
    }
  }

  return results
}
