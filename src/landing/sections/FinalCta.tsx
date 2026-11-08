import { AnchorButton, CtaLink } from '../components/CtaLink'
import { SAFETY_LINE } from '../content'

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 py-20 md:py-28">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(70%_90%_at_50%_0%,rgba(124,58,237,0.3)_0%,#0a0a0b_55%,#000_100%)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(60%_70%_at_50%_30%,black,transparent)]"
        />
        <div aria-hidden="true" className="absolute -bottom-24 left-1/2 -z-10 h-64 w-[70%] -translate-x-1/2 rounded-full bg-galaxy/20 blur-3xl" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center md:py-28">
          <h2 id="final-title" className="text-balance font-landing text-[2.5rem] font-bold leading-[0.95] tracking-[-0.045em] text-zinc-50 md:text-[4.75rem]">
            Sua próxima ideia <span className="bg-gradient-to-r from-accent-soft to-[#60a5fa] bg-clip-text text-transparent">já tem onde nascer.</span>
          </h2>
          <p className="mt-6 max-w-xl text-pretty text-[17px] font-medium text-zinc-300">
            Roteiro, imagem, personagem e vídeo no mesmo estúdio, em português e num saldo só. Crie a conta, use os créditos de boas-vindas e só escolha um plano
            quando fizer sentido para você.
          </p>
          <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <CtaLink cta="final" size="lg" className="w-full sm:w-auto" />
            <AnchorButton href="#precos" size="lg" tone="ghost" className="w-full sm:w-auto">
              Ver os planos
            </AnchorButton>
          </div>
          <p className="mt-4 text-pretty text-[13px] text-zinc-400">{SAFETY_LINE}</p>
        </div>
      </div>
    </section>
  )
}
