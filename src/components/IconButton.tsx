import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../utils/cx'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  children: ReactNode
  variant?: 'ghost' | 'accent' | 'danger'
  size?: 'sm' | 'md'
  active?: boolean
}

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900 disabled:pointer-events-none disabled:opacity-40'

const VARIANTS = {
  ghost:
    'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
  accent:
    'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400',
  danger:
    'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300',
}

const SIZES = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
}

export function IconButton({
  label,
  children,
  className,
  variant = 'ghost',
  size = 'md',
  active = false,
  type = 'button',
  title,
  ...rest
}: Readonly<IconButtonProps>) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      title={title ?? label}
      className={cx(
        BASE,
        SIZES[size],
        VARIANTS[variant],
        active &&
          'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
