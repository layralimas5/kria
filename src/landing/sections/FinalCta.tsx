import { CtaLink } from '../components/CtaLink'
import { LoopVideo } from '../components/LoopVideo'
import { avatar, WELCOME_CREDITS } from '../content'

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 py-20 md:py-28">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-white/[0.06]">
        <LoopVideo clip={avatar('faria-lima')} className="absolute inset-0 -z-10 size-full object-cover opacity-70" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_50%,rgba(15,17,19,0.55),rgba(15,17,19,0.95))]" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center md:py-28">
          <h2 id="final-title" className="text-balance font-landing text-5xl font-bold uppercase leading-[0.88] tracking-[-0.045em] text-zinc-50 md:text-[5.5rem]">
            Seu próximo post <span className="text-accent">não precisa de câmera</span>
          </h2>
          <p className="mt-6 text-pretty text-[17px] font-medium text-zinc-300">
            Cria a conta, usa os {WELCOME_CREDITS} créditos de presente e vê o primeiro vídeo ficar pronto.
          </p>
          <CtaLink size="lg" className="mt-9" />
        </div>
      </div>
    </section>
  )
}
