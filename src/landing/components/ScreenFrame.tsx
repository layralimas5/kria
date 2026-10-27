import clsx from 'clsx'
import type { ReactNode } from 'react'
import { screenSrc, type Screen } from '../content'

interface ScreenImageProps {
  readonly screen: Screen
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly eager?: boolean
  readonly className?: string
}

/** Print real do app. Fora do topo, carrega só quando chega perto da tela. */
export function ScreenImage({ screen, alt, width, height, eager = false, className }: ScreenImageProps) {
  return (
    <img
      src={screenSrc(screen)}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      className={clsx('block h-auto w-full', className)}
    />
  )
}

/** Janela de navegador em volta do print, para ler como produto e não como foto. */
interface BrowserFrameProps {
  readonly children: ReactNode
  /** Tela do app mostrada, na barra de endereço. */
  readonly label: string
  readonly className?: string
}

export function BrowserFrame({ children, label, className }: BrowserFrameProps) {
  return (
    <figure
      className={clsx(
        'overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0c1f] shadow-[0_40px_120px_-30px_rgba(124,58,237,0.45)]',
        className,
      )}
    >
      <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 hidden rounded-md bg-white/[0.05] px-3 py-1 text-[11px] text-zinc-500 sm:block">Vynkio · {label}</span>
      </div>
      {children}
    </figure>
  )
}

export function PhoneFrame({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <figure
      className={clsx(
        'overflow-hidden rounded-[2.2rem] bg-[#08071a] p-[6px] shadow-[0_30px_80px_-20px_rgba(124,58,237,0.5)] ring-1 ring-white/[0.12]',
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.85rem]">{children}</div>
    </figure>
  )
}
