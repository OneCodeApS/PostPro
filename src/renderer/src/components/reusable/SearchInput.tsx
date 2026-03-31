import { type InputHTMLAttributes } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  ...props
}: SearchInputProps): React.JSX.Element {
  function handleClear(): void {
    onChange('')
    onClear?.()
  }

  return (
    <div className={`relative ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-white/10 py-1.5 pl-7 pr-7 text-xs text-white placeholder-white/40 outline-none focus:bg-white/15"
        {...props}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
