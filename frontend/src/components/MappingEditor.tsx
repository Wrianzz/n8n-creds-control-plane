import { ArrowLeft, CheckCircle2, GitCommit, RefreshCcw, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { BranchInfo, CredentialEntry, MapItem, MapMutationPayload, ValidationResponse, WorkflowMapResponse } from '../types'
import { AuditHistory } from './AuditHistory'
import { DiffViewer } from './DiffViewer'
import { MappingTable } from './MappingTable'
import { ValidationPanel } from './ValidationPanel'

type Props = {
  branch: BranchInfo
  onBack: () => void
}

type EditableMap = MapItem & {
  included: boolean
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
  const [maps, setMaps] = useState<EditableMap[]>([])
  const [activeWorkflowId, setActiveWorkflowId] = useState(branch.workflowId)
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [auditRefreshKey, setAuditRefreshKey] = useState(0)
  const [commitResult, setCommitResult] = useState<any>(null)

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await api.getWorkflowMap(branch.branchName, branch.workflowId)
      setData(result)
      setMaps(result.maps.map((item) => ({ ...item, included: item.type === 'main' || item.exists })))
      setActiveWorkflowId(result.maps[0]?.workflowId ?? branch.workflowId)
      setValidation(null)
      setCommitResult(null)
      setAuditRefreshKey((key) => key + 1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch.branchName])

  const activeMap = maps.find((map) => map.workflowId === activeWorkflowId)

  const beforeJson = useMemo(() => {
    if (!data) return null
    return Object.fromEntries(data.maps.map((item) => [item.workflowId, item.map]))
  }, [data])

  const afterJson = useMemo(() => {
    return Object.fromEntries(maps.filter((map) => map.included).map((item) => [item.workflowId, { entries: cleanEntries(item.map.entries) }]))
  }, [maps])

  function updateEntries(workflowId: string, entries: CredentialEntry[]) {
    setMaps((prev) => prev.map((map) => (
      map.workflowId === workflowId ? { ...map, map: { entries }, included: true } : map
    )))
    setValidation(null)
  }

  function toggleIncluded(workflowId: string, included: boolean) {
    setMaps((prev) => prev.map((map) => (map.workflowId === workflowId ? { ...map, included } : map)))
    setValidation(null)
  }

  function buildPayload(): MapMutationPayload {
    const includedMaps = maps.filter((map) => map.included)
    return {
      branchName: data?.branch.branchName ?? branch.branchName,
      workflowId: branch.workflowId,
      baseSha: data?.branch.headSha ?? branch.headSha,
      selectedSubworkflowIds: includedMaps.filter((map) => map.type === 'subworkflow').map((map) => map.workflowId),
      maps: includedMaps.map((map) => ({
        workflowId: map.workflowId,
        entries: cleanEntries(map.map.entries)
      }))
    }
  }

  async function validate() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await api.validateMap(buildPayload())
      setValidation(result)
      setAuditRefreshKey((key) => key + 1)
      setMessage(result.valid ? 'Validasi sukses. Map siap di-commit.' : 'Validasi selesai, masih ada error yang perlu diperbaiki.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveDraft() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const result = await api.saveDraft(buildPayload())
      setValidation(result.validation)
      setAuditRefreshKey((key) => key + 1)
      setMessage(`Draft tersimpan. Draft ID: ${result.draftId}, version: ${result.version}.`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function commit() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const payload = { ...buildPayload(), commitMessage: commitMessage.trim() || undefined }
      const result = await api.commit(payload)
      setCommitResult(result)
      setAuditRefreshKey((key) => key + 1)
      setMessage(result.status === 'no_changes' ? result.message : `Commit berhasil: ${result.commitSha}`)
      await load()
    } catch (err: any) {
      setError(err.message)
      if (err.code === 'REMOTE_BRANCH_CHANGED') {
        setMessage('Remote branch berubah. Klik Sync from repo lalu validate ulang.')
      }
    } finally {
      setLoading(false)
    }
  }

  const hasValidationError = validation ? validation.summary.error > 0 : true

  return (
    <div className="space-y-6">
      <section className="cm-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back to Branch List
            </button>
            <h2 className="text-xl font-bold text-slate-950">Mapping Editor</h2>
            <div className="mt-2 space-y-1 text-sm text-slate-500">
              <p>Branch: <span className="font-mono text-slate-700">{branch.branchName}</span></p>
              <p>Head SHA: <span className="font-mono text-slate-700">{data?.branch.headSha ?? branch.headSha}</span></p>
              <p>Main workflow: <span className="font-mono text-slate-700">{branch.workflowId}</span></p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="cm-btn-secondary" onClick={load} disabled={loading}>
              <RefreshCcw className="h-4 w-4" /> Sync from repo
            </button>
            <button className="cm-btn-secondary" onClick={validate} disabled={loading || maps.length === 0}>
              <CheckCircle2 className="h-4 w-4" /> Validate
            </button>
            <button className="cm-btn-secondary" onClick={saveDraft} disabled={loading || maps.length === 0}>
              <Save className="h-4 w-4" /> Save Draft
            </button>
            <button className="cm-btn-primary" onClick={commit} disabled={loading || hasValidationError}>
              <GitCommit className="h-4 w-4" /> Commit & Push
            </button>
          </div>
        </div>

        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="cm-card p-5">
          <h3 className="text-base font-semibold text-slate-950">Workflow Scope</h3>
          <p className="mt-1 text-sm text-slate-500">Pilih map yang ingin diedit dan include saat commit.</p>

          <div className="mt-4 space-y-2">
            {maps.map((map) => (
              <button
                key={map.workflowId}
                onClick={() => setActiveWorkflowId(map.workflowId)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  activeWorkflowId === map.workflowId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={map.included}
                    disabled={map.type === 'main'}
                    onChange={(event) => toggleIncluded(map.workflowId, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div>
                    <div className="font-mono text-xs">{map.workflowId}</div>
                    <div className="mt-1 text-xs opacity-80">{map.type}</div>
                    <div className="mt-1 text-xs opacity-80">{map.path}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="cm-card p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-950">Credential Mapping Table</h3>
            <p className="text-sm text-slate-500">
              Editing workflow: <span className="font-mono text-slate-700">{activeWorkflowId}</span>
            </p>
          </div>

          {activeMap ? (
            <MappingTable
              entries={activeMap.map.entries}
              nodeOptions={activeMap.credentialNodeOptions ?? []}
              onChange={(entries) => updateEntries(activeMap.workflowId, entries)}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 p-10 text-center text-slate-500">Loading map...</div>
          )}
        </section>
      </section>

      <section className="cm-card p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-950">Commit Message Optional</h3>
        <textarea
          className="cm-input min-h-24 font-mono text-xs"
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          placeholder={`chore(credentials): update map for workflow ${branch.workflowId}`}
        />
      </section>

      <ValidationPanel validation={validation} />
      <DiffViewer before={beforeJson} after={afterJson} />

      {commitResult && (
        <section className="cm-card p-5">
          <h3 className="text-base font-semibold text-slate-950">Last Commit Result</h3>
          <pre className="mt-3 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(commitResult, null, 2)}
          </pre>
        </section>
      )}

      <AuditHistory branchName={branch.branchName} workflowId={branch.workflowId} refreshKey={auditRefreshKey} />
    </div>
  )
}
