import { RefreshCcw, Search, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { BranchInfo } from '../types'

type Props = {
  onOpen: (branch: BranchInfo) => void
}

export function BranchList({ onOpen }: Props) {
  const [q, setQ] = useState('')
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.listBranches(q)
      setBranches(result.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function sync() {
    setLoading(true)
    setError(null)
    try {
      await api.syncBranches()
      await load()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <section className="cm-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Branch List</h2>
            <p className="text-sm text-slate-500">Hanya branch dengan prefix workflow/* yang ditampilkan.</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="cm-input pl-9 sm:w-80"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && load()}
                placeholder="Search workflowId..."
              />
            </div>
            <button className="cm-btn-secondary" onClick={load} disabled={loading}>Search</button>
            <button className="cm-btn-primary" onClick={sync} disabled={loading}>
              <RefreshCcw className="h-4 w-4" /> Sync from repo
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}
      </section>

      <section className="cm-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Workflow ID</th>
                <th className="px-5 py-3">Head SHA</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {branches.map((branch) => (
                <tr key={branch.branchName} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-slate-400" />
                      {branch.branchName}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{branch.workflowId}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-600">{branch.headSha}</td>
                  <td className="px-5 py-4">
                    <span className="cm-badge bg-emerald-100 text-emerald-700">{branch.status}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button className="cm-btn-primary" onClick={() => onOpen(branch)}>Open Mapping Editor</button>
                  </td>
                </tr>
              ))}

              {!loading && branches.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-500" colSpan={5}>
                    Tidak ada branch workflow/* ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
