import { Plus, Trash2, Upload } from 'lucide-react'
import type { CredentialEntry, CredentialNodeOption } from '../types'

type Props = {
  entries: CredentialEntry[]
  onChange: (entries: CredentialEntry[]) => void
  nodeOptions?: CredentialNodeOption[]
}

function emptyEntry(): CredentialEntry {
  return { nodeName: '', credentialName: '', credentialId: '' }
}

export function MappingTable({ entries, onChange, nodeOptions = [] }: Props) {
  function updateRow(index: number, key: keyof CredentialEntry, value: string) {
    const next = entries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
    onChange(next)
  }

  function deleteRow(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }

  function addRow() {
    onChange([...entries, emptyEntry()])
  }

  function importJson() {
    const raw = window.prompt('Paste JSON map. Format: { "entries": [...] } atau array entries.')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      const imported = Array.isArray(parsed) ? parsed : parsed.entries
      if (!Array.isArray(imported)) throw new Error('JSON harus array atau object dengan field entries.')
      onChange(imported.map((entry) => ({
        nodeName: String(entry.nodeName ?? ''),
        credentialName: String(entry.credentialName ?? ''),
        credentialId: String(entry.credentialId ?? '')
      })))
    } catch (err: any) {
      alert(`Import JSON gagal: ${err.message}`)
    }
  }

  function importCsv() {
    const raw = window.prompt('Paste CSV dengan kolom: nodeName,credentialName,credentialId')
    if (!raw) return
    const rows = raw.split('\n').map((line) => line.trim()).filter(Boolean)
    const next = rows.map((row) => {
      const [nodeName, credentialName, credentialId] = row.split(',').map((part) => part?.trim() ?? '')
      return { nodeName, credentialName, credentialId }
    })
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button className="cm-btn-primary" onClick={addRow}>
          <Plus className="h-4 w-4" /> Add Row
        </button>
        <button className="cm-btn-secondary" onClick={importCsv}>
          <Upload className="h-4 w-4" /> Import CSV
        </button>
        <button className="cm-btn-secondary" onClick={importJson}>
          <Upload className="h-4 w-4" /> Import JSON
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">nodeName</th>
                <th className="px-4 py-3">credentialName</th>
                <th className="px-4 py-3">credentialId</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {entries.map((entry, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <select
                      className="cm-input"
                      value={entry.nodeName}
                      onChange={(event) => updateRow(index, 'nodeName', event.target.value)}
                    >
                      <option value="">Pilih node...</option>
                      {nodeOptions.map((option) => (
                        <option key={option.label} value={option.nodeName}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="cm-input"
                      value={entry.credentialName}
                      onChange={(event) => updateRow(index, 'credentialName', event.target.value)}
                      placeholder="TEST PSQL-Production"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="cm-input font-mono text-xs"
                      value={entry.credentialId}
                      onChange={(event) => updateRow(index, 'credentialId', event.target.value)}
                      placeholder="fyglbtpDUghobyaK"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="cm-btn-danger" onClick={() => deleteRow(index)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </td>
                </tr>
              ))}

              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Belum ada mapping. Klik Add Row atau Import JSON/CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
