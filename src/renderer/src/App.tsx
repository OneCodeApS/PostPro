import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TabProvider, useTabs } from './contexts/TabContext'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { TabBar } from './components/endpoints/TabBar'
import { EndpointsPanel } from './components/endpoints/EndpointsPanel'
import { RequestDetail } from './components/endpoints/RequestDetail'
import { EnvironmentsPanel } from './components/environments/EnvironmentsPanel'
import { EnvironmentDetail } from './components/environments/EnvironmentDetail'
import { DetailPanel } from './components/DetailPanel'

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
  const { tabs, activeTabId } = useTabs()

  if (!companyId) return <NoCompany />

  return (
    <>
      <div className="w-64 shrink-0 border-r border-white/10 overflow-hidden">
        <EndpointsPanel companyId={companyId} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar />
        <div className="relative flex-1 overflow-hidden">
          {tabs.length === 0 && (
            <DetailPanel selectedEnvironment={null} selectedRequest={null} />
          )}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              <RequestDetail requestId={tab.id} />
            </div>
          ))}
        </div>
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
      <TitleBar />
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
        <Route path="/endpoints" element={<EndpointsRoute />} />
        <Route path="/endpoints/:requestId" element={<EndpointsRoute />} />
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
        <TabProvider>
          <AppContent />
        </TabProvider>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
