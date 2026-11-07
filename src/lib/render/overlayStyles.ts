// Como o texto aparece no vídeo em cada estilo. Só desenho em canvas; a regra de quando
// cada texto aparece está em `buildTimeline` (src/domain/multiplier.ts).

import { wrapText, type Overlay, type RenderStyle } from '@/domain/multiplier'

export const FONT_FAMILY = '"Space Grotesk Variable", "Geist Variable", system-ui, sans-serif'

const PURPLE = '#7c3aed'
const GOLD = '#f5b841'

interface Box {
  readonly width: number
  readonly height: number
}

/** 0 a 1 nos primeiros 0,3 s do texto: entra crescendo e aparecendo. */
function entrance(localTime: number): number {
  const progress = Math.min(1, Math.max(0, localTime / 0.3))
  return 1 - (1 - progress) ** 3
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()
}

interface TextBlock {
  readonly size: number
  readonly weight: number
  readonly uppercase: boolean
  /** Centro vertical do bloco, em fração da altura. */
  readonly centerY: number
  readonly maxWidth: number
}

function layout(ctx: CanvasRenderingContext2D, text: string, block: TextBlock) {
  ctx.font = `${block.weight} ${block.size}px ${FONT_FAMILY}`
  const value = block.uppercase ? text.toLocaleUpperCase('pt-BR') : text
  const lines = wrapText(value, block.maxWidth, (line) => ctx.measureText(line).width)
  const lineHeight = block.size * 1.18
  return { lines, lineHeight }
}

function withEntrance(ctx: CanvasRenderingContext2D, box: Box, centerY: number, localTime: number, draw: () => void) {
  const amount = entrance(localTime)
  ctx.save()
  ctx.globalAlpha = amount
  const scale = 0.9 + 0.1 * amount
  ctx.translate(box.width / 2, centerY)
  ctx.scale(scale, scale)
  ctx.translate(-box.width / 2, -centerY)
  draw()
  ctx.restore()
}

/** Faixa roxa atrás de cada linha, texto branco em caixa alta. */
function drawBanded(ctx: CanvasRenderingContext2D, box: Box, text: string, block: TextBlock, localTime: number, fill = PURPLE) {
  const { lines, lineHeight } = layout(ctx, text, block)
  const top = box.height * block.centerY - (lines.length * lineHeight) / 2
  const centerY = top + (lines.length * lineHeight) / 2
  withEntrance(ctx, box, centerY, localTime, () => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    lines.forEach((line, index) => {
      const y = top + lineHeight * index + lineHeight / 2
      const width = ctx.measureText(line).width + block.size * 0.7
      ctx.fillStyle = fill
      roundedRect(ctx, box.width / 2 - width / 2, y - lineHeight / 2 + 2, width, lineHeight - 4, block.size * 0.22)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(line, box.width / 2, y + block.size * 0.04)
    })
  })
}

/** Cápsula escura atrás do bloco, texto branco: cara de legenda de criador. */
function drawCaption(ctx: CanvasRenderingContext2D, box: Box, text: string, block: TextBlock, localTime: number) {
  const { lines, lineHeight } = layout(ctx, text, block)
  const blockHeight = lines.length * lineHeight
  const top = box.height * block.centerY - blockHeight / 2
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width))
  withEntrance(ctx, box, top + blockHeight / 2, localTime, () => {
    const padX = block.size * 0.7
    const padY = block.size * 0.45
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'
    roundedRect(ctx, box.width / 2 - widest / 2 - padX, top - padY, widest + padX * 2, blockHeight + padY * 2, block.size * 0.6)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    lines.forEach((line, index) => ctx.fillText(line, box.width / 2, top + lineHeight * index + lineHeight / 2))
  })
}

/** Texto com contorno preto grosso, sem fundo. */
function drawOutlined(ctx: CanvasRenderingContext2D, box: Box, text: string, block: TextBlock, localTime: number, color: string) {
  const { lines, lineHeight } = layout(ctx, text, block)
  const top = box.height * block.centerY - (lines.length * lineHeight) / 2
  withEntrance(ctx, box, top + (lines.length * lineHeight) / 2, localTime, () => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    // Sombra larga atrás do contorno: o texto continua legível sobre vídeo com muito detalhe.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
    ctx.shadowBlur = block.size * 0.5
    ctx.lineWidth = block.size * 0.16
    ctx.strokeStyle = '#000000'
    ctx.fillStyle = color
    lines.forEach((line, index) => {
      const y = top + lineHeight * index + lineHeight / 2
      ctx.strokeText(line, box.width / 2, y)
      ctx.fillText(line, box.width / 2, y)
    })
  })
}

/** Escurece a cena congelada para o cartão final do CTA. */
export function drawEndCardBackdrop(ctx: CanvasRenderingContext2D, box: Box, localTime: number) {
  const amount = Math.min(1, localTime / 0.35)
  ctx.fillStyle = `rgba(5, 4, 15, ${0.72 * amount})`
  ctx.fillRect(0, 0, box.width, box.height)
}

/** Desenha um texto da linha do tempo no estilo escolhido. `localTime` = segundos desde que ele apareceu. */
export function drawOverlay(ctx: CanvasRenderingContext2D, box: Box, overlay: Overlay, style: RenderStyle, localTime: number) {
  const short = Math.min(box.width, box.height)
  const maxWidth = box.width * 0.84
  const vertical = box.height > box.width

  if (overlay.kind === 'cta') {
    const block = { size: short * 0.095, weight: 800, uppercase: style !== 'legenda', centerY: 0.5, maxWidth }
    if (style === 'destaque') return drawOutlined(ctx, box, overlay.text, block, localTime, GOLD)
    if (style === 'legenda') return drawCaption(ctx, box, overlay.text, { ...block, weight: 700 }, localTime)
    return drawBanded(ctx, box, overlay.text, block, localTime)
  }

  const isHook = overlay.kind === 'hook'
  if (style === 'impacto') {
    const size = short * (isHook ? 0.082 : 0.062)
    return drawBanded(ctx, box, overlay.text, { size, weight: 800, uppercase: true, centerY: vertical ? 0.2 : 0.22, maxWidth }, localTime)
  }
  if (style === 'destaque') {
    const size = short * (isHook ? 0.095 : 0.07)
    return drawOutlined(ctx, box, overlay.text, { size, weight: 800, uppercase: true, centerY: isHook ? 0.42 : 0.62, maxWidth }, localTime, isHook ? GOLD : '#ffffff')
  }
  // Legenda: gancho no alto, texto das cenas acima da área de botões das redes.
  const size = short * (isHook ? 0.068 : 0.052)
  return drawCaption(ctx, box, overlay.text, { size, weight: 700, uppercase: false, centerY: isHook ? 0.16 : vertical ? 0.7 : 0.8, maxWidth }, localTime)
}
