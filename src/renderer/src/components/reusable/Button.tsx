import { type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-op-primary hover:bg-op-primary/80',
  secondary: 'bg-op-secondary hover:bg-op-secondary/80',
  tertiary: 'bg-op-tertiary hover:bg-op-tertiary/80',
  danger: 'bg-op-error hover:bg-op-error/80',
  success: 'bg-op-success hover:bg-op-success/80'
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5',
  lg: 'px-7 py-3.5 text-lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const base = 'rounded-lg text-white font-semibold transition-colors'
  const classes = disabled
    ? `${base} bg-op-disabled cursor-not-allowed opacity-60 ${sizeClasses[size]} ${className}`
    : `${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button disabled={disabled} className={classes} {...props}>
      {children}
    </button>
  )
}
