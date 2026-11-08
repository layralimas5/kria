import { REAL_GALLERY } from '../content'
import { SHOWCASE_VISIBLE } from '../showcase'
import { Gallery } from './Gallery'
import { PhotoGallery } from './PhotoGallery'
import { SameFace } from './SameFace'
import { StartBento } from './StartBento'

/**
 * Exemplos reais feitos no Vynkio. Cada bloco só entra quando as mídias foram geradas de verdade:
 * sem exemplo real, a seção não aparece (nada de imagem de banco ou de outra plataforma).
 */
export function Examples() {
  if (!SHOWCASE_VISIBLE && !REAL_GALLERY) return null
  return (
    <div id="exemplos" className="scroll-mt-20">
      {SHOWCASE_VISIBLE && <StartBento />}
      {SHOWCASE_VISIBLE && <SameFace />}
      {SHOWCASE_VISIBLE && <PhotoGallery />}
      {REAL_GALLERY && <Gallery />}
    </div>
  )
}
