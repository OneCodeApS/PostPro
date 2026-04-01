import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    lock: async (_name, _acquireTimeout, fn) => await fn()
  }
})

/**
 * Store the session directly in localStorage (bypassing setSession which hangs
 * in Electron due to Web Locks). Then reload the page so the Supabase client
 * picks it up on init via getSession().
 */
export function storeSessionAndReload(accessToken: string, refreshToken: string): void {
  const payload = JSON.parse(atob(accessToken.split('.')[1]))
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: payload.exp - Math.floor(Date.now() / 1000),
    expires_at: payload.exp,
    user: {
      id: payload.sub,
      email: payload.email,
      app_metadata: payload.app_metadata ?? {},
      user_metadata: payload.user_metadata ?? {},
      aud: payload.aud,
      created_at: ''
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  window.location.reload()
}
