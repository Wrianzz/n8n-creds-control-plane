import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const [email, setEmail] = useState(localStorage.getItem('cm_email') || import.meta.env.VITE_DEV_USER_EMAIL || 'operator@example.com')
  const [role, setRole] = useState(localStorage.getItem('cm_role') || import.meta.env.VITE_DEV_USER_ROLE || 'editor')

  function saveDevAuth() {
    localStorage.setItem('cm_email', email)
    localStorage.setItem('cm_role', role)
    window.location.reload()
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Credential Control Panel</h1>
            <p className="text-sm text-slate-500">n8n workflow branch-based credential map manager</p>
          </div>
        </div>

        <div className="cm-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <input
            className="cm-input w-64"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="operator@example.com"
          />
          <select className="cm-input w-36" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
            <option value="approver">approver</option>
            <option value="admin">admin</option>
          </select>
          <button className="cm-btn-secondary" onClick={saveDevAuth}>Set Dev Auth</button>
        </div>
      </div>
    </header>
  )
}
