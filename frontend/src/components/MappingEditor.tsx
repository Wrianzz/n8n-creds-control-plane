import { ArrowLeft, GitCommit, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { BranchInfo, CredentialEntry, MapItem, MapMutationPayload, WorkflowMapResponse } from '../types'
import { DiffViewer } from './DiffViewer'
import { MappingTable } from './MappingTable'

type Props = {
  branch: BranchInfo
  onBack: () => void
}

function cleanEntries(entries: CredentialEntry[]): CredentialEntry[] {
  return entries.map((entry) => ({
    nodeName: entry.nodeName.trim(),
    credentialName: entry.credentialName.trim(),
    credentialId: entry.credentialId.trim()
  }))
}

export function MappingEditor({ branch, onBack }: Props) {
  const [data, setData] = useState<WorkflowMapResponse | null>(null)
  const [map, setMap] = useState<MapItem | null>(null)
  const [originalMap, setOriginalMap] = useState<MapItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [commitResult, setCommitResult] = useState<any>(null)

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await api.getWorkflowMap(branch.branchName, branch.workflowId)
      const selectedMap = result.maps.find((item) => item.workflowId === branch.workflowId) ?? result.maps[0] ?? null
      setData(result)
      setMap(selectedMap ? structuredClone(selectedMap) : null)
      setOriginalMap(selectedMap ? structuredClone(selectedMap) : null)
      setCommitResult(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [branch.branchName])

  function buildPayload(): MapMutationPayload {
    return {
      branchName: data?.branch.branchName ?? branch.branchName,
      workflowId: branch.workflowId,
      baseSha: data?.branch.headSha ?? branch.headSha,
      selectedSubworkflowIds: [],
      maps: map ? [{ workflowId: map.workflowId, entries: cleanEntries(map.map.entries) }] : []
    }
  }

  async function commit() {
    if (!map) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await api.commit(buildPayload())
      setCommitResult(result)
      setMessage(result.status === 'no_changes' ? result.message : `Commit berhasil: ${result.commitSha}`)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const beforeJson = useMemo(() => (originalMap ? { [originalMap.workflowId]: originalMap.map } : null), [originalMap])
  const afterJson = useMemo(() => (map ? { [map.workflowId]: { entries: cleanEntries(map.map.entries) } } : null), [map])

  return (
    <div className="space-y-6">
      <section className="cm-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back to Branch List
            </button>
            <h2 className="text-xl font-bold text-slate-950">Mapping Editor</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="cm-btn-secondary" onClick={load} disabled={loading}><RefreshCcw className="h-4 w-4" /> Sync from repo</button>
            <button className="cm-btn-primary" onClick={commit} disabled={loading || !map}><GitCommit className="h-4 w-4" /> Commit & Push</button>
          </div>
        </div>
        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      </section>

      <section className="cm-card p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-950">Credential Mapping Table</h3>
          <p className="text-sm text-slate-500">Editing workflow: <span className="font-mono text-slate-700">{map?.workflowId ?? branch.workflowId}</span></p>
        </div>
        {map ? (
          <MappingTable
            entries={map.map.entries}
            nodeOptions={map.credentialNodeOptions ?? []}
            credentials={data?.credentials ?? []}
            onChange={(entries) => setMap({ ...map, map: { entries } })}
          />
        ) : <div className="rounded-2xl border border-slate-200 p-10 text-center text-slate-500">Loading map...</div>}
      </section>

      <DiffViewer before={beforeJson} after={afterJson} />

      {commitResult && <section className="cm-card p-5"><h3 className="text-base font-semibold text-slate-950">Last Commit Result</h3><pre className="mt-3 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(commitResult, null, 2)}</pre></section>}
    </div>
  )
}
