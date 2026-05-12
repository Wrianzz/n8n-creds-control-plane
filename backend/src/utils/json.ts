import { createHash } from 'node:crypto'
import type { CredentialEntry, CredentialMap } from '../types.js'

export function normalizeEntry(entry: CredentialEntry): CredentialEntry {
  return {
    nodeName: entry.nodeName.trim(),
    credentialName: entry.credentialName.trim(),
    credentialId: entry.credentialId.trim()
  }
}

export function normalizeMap(map: CredentialMap): CredentialMap {
  return {
    entries: (map.entries ?? []).map(normalizeEntry)
  }
}

export function stringifyMap(map: CredentialMap): string {
  const normalized = normalizeMap(map)
  return `${JSON.stringify(normalized, null, 2)}\n`
}

export function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}
