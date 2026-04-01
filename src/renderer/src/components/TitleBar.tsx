import { useRef, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

function UpdateBadge(): React.JSX.Element | null {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const off1 = window.api.onUpdateAvailable((info) => {
      setVersion(info.version)
      setState('available')
    })
    const off2 = window.api.onUpdateDownloaded(() => {
      setState('ready')
    })
    const off3 = window.api.onUpdateProgress((info) => {
      setProgress(info.percent)
    })
    return () => {
      off1()
      off2()
      off3()
    }
  }, [])

  if (state === 'idle') return null

  if (state === 'available') {
    return (
      <button
        onClick={() => {
          setState('downloading')
          window.api.downloadUpdate()
        }}
        className="rounded bg-op-success/20 px-2 py-0.5 text-xs font-medium text-op-success transition-colors hover:bg-op-success/30"
      >
        v{version} available
      </button>
    )
  }

  if (state === 'downloading') {
    return (
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/50">
        Downloading {progress}%
      </span>
    )
  }

  return (
    <button
      onClick={() => window.api.installUpdate()}
      className="rounded bg-op-success/20 px-2 py-0.5 text-xs font-medium text-op-success transition-colors hover:bg-op-success/30"
    >
      Restart to update
    </button>
  )
}

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
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white transition-colors hover:bg-white/30"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-white/10 bg-op-primary py-2 shadow-lg">
          <div className="border-b border-white/10 px-4 py-2">
            <p className="text-xs text-white/40">Signed in as</p>
            <p className="truncate text-sm font-medium text-white">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full px-4 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function WindowControls(): React.JSX.Element {
  return (
    <div className="flex items-center">
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
  )
}

export function TitleBar(): React.JSX.Element {
  return (
    <div className="flex h-10 shrink-0 items-center border-b border-white/10 bg-op-primary">
      {/* Drag region */}
      <div className="flex flex-1 items-center px-4 [-webkit-app-region:drag]">
        <h1 className="text-sm font-bold text-white">PostPro</h1>
      </div>

      {/* Non-draggable controls */}
      <div className="flex items-center gap-2 px-2 [-webkit-app-region:no-drag]">
        <UpdateBadge />
        <UserMenu />
        <WindowControls />
      </div>
    </div>
  )
}
