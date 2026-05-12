import { stringifyPretty } from '../lib/format'

type Props = {
  before: unknown
  after: unknown
}

export function DiffViewer({ before, after }: Props) {
  return (
    <section className="cm-card p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-950">Diff Preview</h3>
        <p className="text-sm text-slate-500">Preview sederhana before/after JSON. Production bisa diganti Monaco Diff Editor.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-600">Before</div>
          <pre className="max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
            {stringifyPretty(before)}
          </pre>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-600">After</div>
          <pre className="max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
            {stringifyPretty(after)}
          </pre>
        </div>
      </div>
    </section>
  )
}
