import { Plus, Trash2 } from 'lucide-react'
import type { CredentialEntry, CredentialNodeOption, N8nCredentialOption } from '../types'

type Props = {
  entries: CredentialEntry[]
  onChange: (entries: CredentialEntry[]) => void
  nodeOptions?: CredentialNodeOption[]
  credentials?: N8nCredentialOption[]
}

function emptyEntry(): CredentialEntry {
  return { nodeName: '', credentialName: '', credentialId: '' }
}

export function MappingTable({ entries, onChange, nodeOptions = [], credentials = [] }: Props) {
  const nodeTypeByName = new Map(nodeOptions.map((option) => [option.nodeName, option.credentialType]))


  function updateCredential(index: number, credentialId: string) {
    const selected = credentials.find((item) => item.id === credentialId)
    const next = entries.map((entry, i) => (
      i === index
        ? { ...entry, credentialId: selected?.id ?? '', credentialName: selected?.name ?? '' }
        : entry
    ))
    onChange(next)
  }

  function updateNode(index: number, nodeName: string) {
    const next = entries.map((entry, i) => (
      i === index
        ? { ...entry, nodeName, credentialId: '', credentialName: '' }
        : entry
    ))
    onChange(next)
  }

  function deleteRow(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }

  function addRow() {
    onChange([...entries, emptyEntry()])
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button className="cm-btn-primary" onClick={addRow}>
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">nodeName</th>
                <th className="px-4 py-3">credential</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {entries.map((entry, index) => {
                const nodeType = nodeTypeByName.get(entry.nodeName) ?? ''
                const filteredCredentials = credentials.filter((item) => item.type === nodeType)
                const selectedByOtherRows = new Set(
                  entries
                    .filter((_, rowIndex) => rowIndex !== index)
                    .map((item) => item.nodeName)
                    .filter(Boolean)
                )
                const availableNodeOptions = nodeOptions.filter(
                  (option) => option.nodeName === entry.nodeName || !selectedByOtherRows.has(option.nodeName)
                )

                return (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <select
                        className="cm-input"
                        value={entry.nodeName}
                        onChange={(event) => updateNode(index, event.target.value)}
                      >
                        <option value="">Pilih node...</option>
                        {availableNodeOptions.map((option) => (
                          <option key={option.nodeName} value={option.nodeName}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="cm-input"
                        value={entry.credentialId}
                        onChange={(event) => updateCredential(index, event.target.value)}
                        disabled={!entry.nodeName}
                      >
                        <option value="">{entry.nodeName ? 'Pilih credential...' : 'Pilih node dulu'}</option>
                        {filteredCredentials.map((cred) => (
                          <option key={cred.id} value={cred.id}>{cred.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="cm-btn-danger" onClick={() => deleteRow(index)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </td>
                  </tr>
                )
              })}

              {entries.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    Belum ada mapping. Klik Add Row.
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
