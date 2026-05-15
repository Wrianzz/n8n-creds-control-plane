import { config } from '../../config.js'

type N8nCredential = {
  id: string
  name: string
  type: string
}

type ListResponse = {
  data?: Array<{ id?: string; name?: string; type?: string }>
}

class CredentialsService {
  async list(): Promise<N8nCredential[]> {
    if (!config.N8N_API_BASE_URL || !config.N8N_API_KEY) return []

    const base = config.N8N_API_BASE_URL.replace(/\/$/, '')

    try {
      if (config.N8N_ALLOW_SELF_SIGNED_TLS) {
        // Development-only escape hatch for internal/self-signed certificates.
        // Keep this scoped to environments that explicitly opt in via .env.
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      }

      const res = await fetch(`${base}/credentials`, {
        headers: {
          'X-N8N-API-KEY': config.N8N_API_KEY,
          Accept: 'application/json'
        }
      })

      if (!res.ok) return []
      const body = await res.json() as ListResponse
      const rows = body.data ?? []

      return rows
        .map((row) => ({
          id: String(row.id ?? '').trim(),
          name: String(row.name ?? '').trim(),
          type: String(row.type ?? '').trim()
        }))
        .filter((row) => row.id && row.name && row.type)
    } catch {
      return []
    }
  }
}

export const credentialsService = new CredentialsService()
