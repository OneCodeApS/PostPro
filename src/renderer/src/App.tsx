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
    <div className="flex h-screen flex-col bg-op-primary">
      <div className="flex h-10 shrink-0 items-center border-b border-white/10 [-webkit-app-region:drag]">
        <span className="px-4 text-sm font-bold text-white">PostPro</span>
        <div className="ml-auto flex [-webkit-app-region:no-drag]">
          <button
            onClick={() => window.api.windowMinimize()}
            className="flex h-8 w-10 items-center justify-center text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => window.api.windowMaximize()}
            className="flex h-8 w-10 items-center justify-center text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>
          <button
            onClick={() => window.api.windowClose()}
            className="flex h-8 w-10 items-center justify-center text-white/40 transition-colors hover:bg-red-500/80 hover:text-white"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <button
          onClick={signInWithMicrosoft}
          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-10 py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/10 active:bg-white/15"
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
          {tabs.length === 0 && <DetailPanel selectedEnvironment={null} selectedRequest={null} />}
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
