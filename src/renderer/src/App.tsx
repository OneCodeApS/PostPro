import { useRef, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Sidebar } from './components/Sidebar'
import { EndpointsPanel } from './components/endpoints/EndpointsPanel'
import { RequestDetail } from './components/endpoints/RequestDetail'
import { EnvironmentsPanel } from './components/environments/EnvironmentsPanel'
import { EnvironmentDetail } from './components/environments/EnvironmentDetail'
import { DetailPanel } from './components/DetailPanel'

function UserMenu(): React.JSX.Element {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : '?'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white transition-colors hover:bg-white/30"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white py-2 shadow-lg z-50">
          <div className="border-b border-gray-100 px-4 py-2">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-gray-900">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function LoginPage(): React.JSX.Element {
  const { signInWithMicrosoft } = useAuth()

  return (
    <div className="flex h-screen items-center justify-center">
      <button
        onClick={signInWithMicrosoft}
        className="border border-red-500 m-4 flex items-center gap-3 rounded border border-gray-300 bg-op-primary px-10 py-4 text-sm font-semibold text-[#5e5e5e] shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
        Sign in with Microsoft
      </button>
    </div>
  )
}

function EndpointsRoute(): React.JSX.Element {
  const { companyId } = useAuth()

  if (!companyId) return <NoCompany />

  return (
    <>
      <div className="w-64 shrink-0 border-r border-white/10 overflow-hidden">
        <EndpointsPanel companyId={companyId} />
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </>
  )
}

function EnvironmentsRoute(): React.JSX.Element {
  const { companyId } = useAuth()

  if (!companyId) return <NoCompany />

  return (
    <>
      <div className="w-64 shrink-0 border-r border-white/10 overflow-hidden">
        <EnvironmentsPanel companyId={companyId} />
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </>
  )
}

function NoCompany(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center text-white/40">
      No company associated with your account.
    </div>
  )
}

function AppLayout(): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-op-primary">
        <h1 className="text-lg font-bold text-white">PostPro</h1>
        <UserMenu />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <Outlet />
      </div>
    </div>
  )
}

function AppContent(): React.JSX.Element {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-op-disabled">Loading...</div>
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/endpoints" element={<EndpointsRoute />}>
          <Route
            index
            element={<DetailPanel selectedEnvironment={null} selectedRequest={null} />}
          />
          <Route path=":requestId" element={<RequestDetail />} />
        </Route>
        <Route path="/environments" element={<EnvironmentsRoute />}>
          <Route
            index
            element={<DetailPanel selectedEnvironment={null} selectedRequest={null} />}
          />
          <Route path=":environmentId" element={<EnvironmentDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/endpoints" replace />} />
      </Route>
    </Routes>
  )
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  )
}

export default App
