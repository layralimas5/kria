import clsx from 'clsx'

type LogoSize = 'md' | 'lg'

/** Símbolo e texto em `public/logo-mark.svg`: a mesma arte do favicon e do checkout (`npm run billing:image`). */
const MARK_SRC = '/logo-mark.svg'

const MARK_SIZE: Record<LogoSize, string> = {
  md: 'h-[22px]',
  lg: 'h-9',
}

const WORD_SIZE: Record<LogoSize, string> = {
  md: 'text-[21px]',
  lg: 'text-[34px]',
}

/** Só o símbolo: o V em duas peças, roxo descendo para o lilás e a lâmina indo para o azul. */
export function LogoMark({ size = 'md' }: { readonly size?: LogoSize }) {
  return <img src={MARK_SRC} alt="" aria-hidden="true" width={216} height={144} className={clsx('w-auto shrink-0', MARK_SIZE[size])} />
}

/** "vynkio" em minúsculas; o pingo do i é um quadrado lilás, como na marca. */
function Wordmark({ size }: { readonly size: LogoSize }) {
  return (
    <span aria-hidden="true" className={clsx('font-display font-semibold leading-none tracking-[-0.045em] text-zinc-50', WORD_SIZE[size])}>
      vynk
      <span className="relative">
        ı
        <span className="absolute left-1/2 top-[0.21em] size-[0.16em] -translate-x-1/2 bg-accent-soft" />
      </span>
      o
    </span>
  )
}

/** Marca completa. Leitor de tela ouve "Vynkio". */
export function Logo({ size = 'md' }: { readonly size?: LogoSize }) {
  return (
    <span className={clsx('flex items-center', size === 'lg' ? 'gap-3' : 'gap-2')}>
      <LogoMark size={size} />
      <Wordmark size={size} />
      <span className="sr-only">Vynkio</span>
    </span>
  )
}
