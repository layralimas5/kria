// Mídias do modo demo: as fotos realistas geradas com os modelos do app (npm run demo:photos)
// e, enquanto uma foto não existe, a ilustração SVG de public/demo no lugar dela.

import generated from './demoPhotos.generated.json'

const GENERATED: Readonly<Record<string, string>> = generated

export const demoPhoto = (id: string, fallbackIndex: number): string => GENERATED[id] ?? `demo/img-${fallbackIndex}.svg`

export const DEMO_VIDEO = GENERATED['luna-video'] ?? 'demo/video-1.webm'

const FIRST_IMAGE = demoPhoto('varanda', 2)
const NEW_IMAGES = [FIRST_IMAGE, demoPhoto('produto', 3), demoPhoto('loja', 4), demoPhoto('coworking', 7), demoPhoto('cozinha', 8)]

/** O que aparece quando uma geração nova termina no demo, em rodízio. */
export const demoImageAt = (index: number): string => NEW_IMAGES[index % NEW_IMAGES.length] ?? FIRST_IMAGE

const MEDIA_TYPES: Readonly<Record<string, string>> = { svg: 'image/svg+xml', jpg: 'image/jpeg', webm: 'video/webm', mp4: 'video/mp4' }

export function demoMediaType(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1)
  const type = MEDIA_TYPES[extension]
  if (!type) throw new Error(`Mídia do demo com extensão desconhecida: ${path}`)
  return type
}
