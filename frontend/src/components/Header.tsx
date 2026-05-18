import { LogOut, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'

type HeaderProps = {
  user: {
    name: string
    email: string
  }
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">
              Credential Control Panel
            </h1>
            <p className="text-sm text-slate-500">
              n8n workflow branch-based credential map manager
            </p>
          </div>
        </div>

        <div className="cm-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="min-w-64 rounded-xl border border-slate-200 px-4 py-2">
            <p className="text-sm font-semibold text-slate-900">
              {user.name}
            </p>
            <p className="text-xs text-slate-500">
              {user.email}
            </p>
          </div>

          <button
            className="cm-btn-secondary flex items-center gap-2"
            onClick={() => api.logout()}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}