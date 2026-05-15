import { config } from '../../config.js'

type N8nCredential = {
  id: string
  name: string
  type: string
}

type ListResponse = {
  data?: Array<{
    id?: string | number
    name?: string
    type?: string
  }>
  nextCursor?: string | null
}

class CredentialsService {
  private getBaseUrl(): string | null {
    if (!config.N8N_API_BASE_URL) return null

    const base = config.N8N_API_BASE_URL.replace(/\/+$/, '')

    // Kalau env sudah berisi /api/v1, jangan ditambah lagi.
    if (/\/api\/v\d+$/i.test(base)) {
      return base
    }

    return `${base}/api/v1`
  }

  private async readResponseBody(res: Response): Promise<unknown> {
    const text = await res.text()

    if (!text) return null

    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  async list(): Promise<N8nCredential[]> {
    if (!config.N8N_API_KEY) {
      console.error('[credentialsService.list] N8N_API_KEY kosong')
      return []
    }

    const base = this.getBaseUrl()

    if (!base) {
      console.error('[credentialsService.list] N8N_API_BASE_URL kosong')
      return []
    }

    if (config.N8N_ALLOW_SELF_SIGNED_TLS) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const credentials: N8nCredential[] = []
    let cursor: string | null = null

    try {
      do {
        const url = new URL(`${base}/credentials`)
        url.searchParams.set('limit', '250')

        if (cursor) {
          url.searchParams.set('cursor', cursor)
        }

        console.log('[credentialsService.list] request:', url.toString())

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-N8N-API-KEY': config.N8N_API_KEY
          }
        })

        const body = await this.readResponseBody(res)

        if (!res.ok) {
          console.error('[credentialsService.list] n8n API error:', {
            status: res.status,
            statusText: res.statusText,
            body
          })

          return []
        }

        const payload = body as ListResponse
        const rows = Array.isArray(payload.data) ? payload.data : []

        for (const row of rows) {
          const id = String(row.id ?? '').trim()
          const name = String(row.name ?? '').trim()
          const type = String(row.type ?? '').trim()

          if (!id || !name || !type) continue

          credentials.push({
            id,
            name,
            type
          })
        }

        cursor = payload.nextCursor ?? null
      } while (cursor)

      console.log('[credentialsService.list] loaded:', credentials.length)

      return credentials
    } catch (error) {
      console.error('[credentialsService.list] failed:', error)
      return []
    }
  }
}

export const credentialsService = new CredentialsService()