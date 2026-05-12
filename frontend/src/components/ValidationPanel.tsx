import type { ValidationResponse } from '../types'

type Props = {
  validation: ValidationResponse | null
}

function badgeClass(severity: string) {
  if (severity === 'error') return 'bg-rose-100 text-rose-700'
  if (severity === 'warning') return 'bg-amber-100 text-amber-700'
  return 'bg-sky-100 text-sky-700'
}

export function ValidationPanel({ validation }: Props) {
  if (!validation) {
    return (
      <section className="cm-card p-5">
        <h3 className="text-base font-semibold text-slate-950">Validation Result</h3>
        <p className="mt-2 text-sm text-slate-500">Klik Validate untuk melihat error/warning/info sebelum commit.</p>
      </section>
    )
  }

  return (
    <section className="cm-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Validation Result</h3>
          <p className="text-sm text-slate-500">Commit hanya boleh dilakukan kalau error = 0.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="cm-badge bg-rose-100 text-rose-700">Errors: {validation.summary.error}</span>
          <span className="cm-badge bg-amber-100 text-amber-700">Warnings: {validation.summary.warning}</span>
          <span className="cm-badge bg-sky-100 text-sky-700">Info: {validation.summary.info}</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Node</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {validation.results.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <span className={`cm-badge ${badgeClass(item.severity)}`}>{item.severity}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.code}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.workflowId ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{item.nodeName ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{item.message}</td>
                </tr>
              ))}
              {validation.results.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Tidak ada hasil validasi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
