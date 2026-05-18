import { useEffect, useState } from 'react'
import type { BranchInfo } from './types'
import { BranchList } from './components/BranchList'
import { Header } from './components/Header'
import { MappingEditor } from './components/MappingEditor'
import { api } from './api/client'

type CurrentUser = {
  id: string
  email: string
  name: string
}

export default function App() {
  const [selectedBranch, setSelectedBranch] = useState<BranchInfo | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me()
      .then((res) => {
        if (!res.authenticated || !res.user) {
          api.login()
          return
        }

        setUser(res.user)
      })
      .catch((err) => {
        console.error('[App] failed to load session:', err)
        setError(err?.message ?? 'Gagal memuat session login.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading session...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="mb-2 text-lg font-bold">Session error</h1>
          <p>{error}</p>

          <button
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-white"
            onClick={() => api.login()}
          >
            Login ulang
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!selectedBranch ? (
          <BranchList onOpen={setSelectedBranch} />
        ) : (
          <MappingEditor
            branch={selectedBranch}
            onBack={() => setSelectedBranch(null)}
          />
        )}
      </main>
    </div>
  )
}