import clsx from 'clsx'

export function Spinner({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  )
}
