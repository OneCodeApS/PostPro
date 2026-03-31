import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // navigator.locks (Web Locks API) can hang indefinitely in Electron,
    // so bypass it and just execute the callback directly.
    lock: async (_name, _acquireTimeout, fn) => await fn()
  }
})
