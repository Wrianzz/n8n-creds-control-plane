import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatDate } from '../lib/format'
import type { AuditLog } from '../types'

type Props = {
  branchName: string
  workflowId: string
  refreshKey: number
}

export function AuditHistory({ branchName, workflowId, refreshKey }: Props) {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const result = await api.listAudit(branchName, workflowId)
      setRows(result.data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchName, workflowId, refreshKey])

  return (
    <section className="cm-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">History / Audit</h3>
          <p className="text-sm text-slate-500">Jejak perubahan map dan validasi.</p>
        </div>
        <button className="cm-btn-secondary" onClick={load}>Refresh</button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.actorEmail}</td>
                  <td className="px-4 py-3"><span className="cm-badge bg-slate-100 text-slate-700">{row.action}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.commitSha ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.traceId}</td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Belum ada audit log.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
