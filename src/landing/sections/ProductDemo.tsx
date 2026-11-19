import { ModelGrid } from '../components/ModelGrid'
import { Reveal } from '../components/Reveal'

/**
 * Logo abaixo do topo: os modelos de IA que já geram no Vynkio. O print do painel saiu daqui, a página
 * mostra o que se cria (vitrine do topo e "Como funciona"), não a interface.
 */
export function ProductDemo() {
  return (
    <section id="demo" aria-label="Modelos de IA do Vynkio" className="scroll-mt-20 px-4 pt-6 md:pt-10">
      <Reveal>
        <ModelGrid />
      </Reveal>
    </section>
  )
}
