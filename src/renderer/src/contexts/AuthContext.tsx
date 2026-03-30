import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        console.log('AuthProvider: got session', session ? 'logged in' : 'no session')
        console.log('AuthProvider: session data', session)
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
      .catch((err) => console.error('Auth init error:', err))
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
    })

    const handleAuthCallback = (
      _event: unknown,
      { accessToken, refreshToken }: { accessToken: string; refreshToken: string }
    ): void => {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    }

    window.electron.ipcRenderer.on('auth-callback', handleAuthCallback)

    return () => {
      subscription.unsubscribe()
      window.electron.ipcRenderer.removeListener('auth-callback', handleAuthCallback)
    }
  }, [])

  const signInWithMicrosoft = async (): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email',
        redirectTo: 'postpro://auth/callback'
      }
    })

    if (error) throw error

    if (data.url) {
      window.electron.ipcRenderer.invoke('open-external', data.url)
    }
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
