import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, storeSessionAndReload } from '../lib/supabase'

interface AuthContextType {
  session: Session | null
  user: User | null
  companyId: string | null
  loading: boolean
  signInWithMicrosoft: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('AuthProvider: starting getSession...')

    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) {
        console.warn('AuthProvider: getSession() timed out, reloading...')
        window.location.reload()
      }
    }, 5000)

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        settled = true
        clearTimeout(timeout)
        console.log('AuthProvider: got session', session ? 'logged in' : 'no session')
        setSession(session)
        if (session?.user) {
          const { data, error } = await supabase
            .from('users')
            .select('current_company_id')
            .eq('auth_user_id', session.user.id)
            .single()
          if (error) console.error('Failed to fetch company:', error)
          setCompanyId(data?.current_company_id ?? null)
        }
      })
      .catch((err) => {
        settled = true
        clearTimeout(timeout)
        console.error('Auth init error:', err)
      })
      .finally(() => setLoading(false))

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('current_company_id')
          .eq('auth_user_id', session.user.id)
          .single()
        setCompanyId(data?.current_company_id ?? null)
      } else {
        setCompanyId(null)
      }
      setLoading(false)
    })

    // Proactively refresh session when the app regains focus
    function handleVisibility(): void {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession().catch((err) => {
          console.error('Session refresh on focus failed:', err)
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Safety net: refresh session every 10 minutes regardless of visibility
    const refreshInterval = setInterval(() => {
      supabase.auth.refreshSession().catch((err) => {
        console.error('Periodic session refresh failed:', err)
      })
    }, 10 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(refreshInterval)
    }
  }, [])

  const signInWithMicrosoft = async (): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email',
        redirectTo: 'http://localhost:48372/auth-callback',
        skipBrowserRedirect: true
      }
    })

    if (error) throw error
    if (!data.url) return

    setLoading(true)

    try {
      const result = await window.electron.ipcRenderer.invoke('open-auth-window', data.url)

      if (result.ok && result.accessToken) {
        // Write session to localStorage and reload — bypasses setSession
        // which hangs in Electron. On reload, getSession() picks it up.
        storeSessionAndReload(result.accessToken, result.refreshToken ?? '')
        return
      } else if (!result.ok) {
        console.error('Auth failed:', result.error)
      }
    } catch (err) {
      console.error('[auth] ERROR:', err)
    }

    setLoading(false)
  }

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        companyId,
        loading,
        signInWithMicrosoft,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
