import { useState } from 'react'
import type { BranchInfo } from './types'
import { BranchList } from './components/BranchList'
import { Header } from './components/Header'
import { MappingEditor } from './components/MappingEditor'

export default function App() {
  const [selectedBranch, setSelectedBranch] = useState<BranchInfo | null>(null)

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {!selectedBranch ? (
          <BranchList onOpen={setSelectedBranch} />
        ) : (
          <MappingEditor branch={selectedBranch} onBack={() => setSelectedBranch(null)} />
        )}
      </main>
    </div>
  )
}
