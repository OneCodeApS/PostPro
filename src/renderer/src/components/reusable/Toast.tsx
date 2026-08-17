import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ToastState {
  id: number
  text: string
}

interface UseToastResult {
  toast: ToastState | null
  showToast: (text: string) => void
}

const TOAST_DURATION_MS = 2000

/**
 * Transient confirmation message. Pair with `<Toast toast={toast} />` to render it:
 *
 *   const { toast, showToast } = useToast()
 *   ...
 *   showToast('Saved')
 */
export function useToast(): UseToastResult {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(0)

  const showToast = useCallback((text: string): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast({ id: nextId.current++, text })
    timeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { toast, showToast }
}

export function Toast({ toast }: { toast: ToastState | null }): React.JSX.Element | null {
  if (!toast) return null

  return createPortal(
    // Keyed by id so repeated messages replay the animation instead of sitting still.
    <div
      key={toast.id}
      className="animate-toast-in fixed bottom-6 right-6 z-[60] rounded-md border border-white/10 bg-op-secondary px-3 py-2 text-sm text-white/90 shadow-lg"
    >
      {toast.text}
    </div>,
    document.body
  )
}
