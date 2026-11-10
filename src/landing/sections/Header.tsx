import clsx from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { CtaLink } from '../components/CtaLink'
import { LOGIN_PATH } from '../content'
import { useScrolled } from '../hooks/useScrolled'

const NAV: readonly { href: string; label: string }[] = [
  { href: '#estudio', label: 'Estúdio' },
  { href: '#ferramentas', label: 'Ferramentas' },
  { href: '#video', label: 'Por dentro' },
  { href: '#precos', label: 'Planos' },
  { href: '#faq', label: 'Dúvidas' },
]

const LINK = 'rounded-md px-2.5 py-1.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function MobileMenu({ id, onClose }: { readonly id: string; readonly onClose: () => void }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.nav
      id={id}
      aria-label="Seções"
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="border-t border-white/[0.06] bg-stage/95 px-4 pb-6 pt-2 backdrop-blur-xl lg:hidden"
    >
      <ul className="flex flex-col">
        {NAV.map(({ href, label }) => (
          <li key={href}>
            <a href={href} onClick={onClose} className="flex min-h-12 items-center border-b border-white/[0.05] text-base font-medium text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {label}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-3">
        <CtaLink cta="header_mobile" size="lg" className="w-full" />
        <Link to={LOGIN_PATH} onClick={onClose} className="inline-flex min-h-12 items-center justify-center rounded-xl text-sm font-semibold text-zinc-200 ring-1 ring-white/[0.1]">
          Já tenho conta
        </Link>
      </div>
    </motion.nav>
  )
}

export function Header() {
  const scrolled = useScrolled()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const close = useCallback(() => setOpen(false), [])
  const solid = scrolled || open

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-300',
        solid ? 'border-white/[0.06] bg-stage/80 backdrop-blur-xl' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[1fr_auto] items-center gap-6 px-4 lg:grid-cols-[1fr_auto_1fr]">
        <a href="#topo" aria-label="Vynkio, topo da página" className="justify-self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo />
        </a>
        <nav aria-label="Seções" className="hidden items-center gap-0.5 rounded-full bg-white/[0.03] p-1 ring-1 ring-white/[0.06] lg:flex">
          {NAV.map(({ href, label }) => (
            <a key={href} href={href} className={`${LINK} rounded-full text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 justify-self-end">
          <Link to={LOGIN_PATH} className={`${LINK} hidden text-zinc-300 hover:text-zinc-50 sm:inline-flex`}>
            Entrar
          </Link>
          <CtaLink cta="header" size="sm" className="rounded-lg" />
          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((value) => !value)}
            className="grid size-11 place-items-center rounded-lg text-zinc-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <AnimatePresence>{open && <MobileMenu id={menuId} onClose={close} />}</AnimatePresence>
    </header>
  )
}
