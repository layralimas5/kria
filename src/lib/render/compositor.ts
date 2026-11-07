// Monta uma variação no navegador, quadro a quadro: decodifica os takes no tempo exato de cada
// quadro, desenha os textos num canvas e codifica com o WebCodecs (H.264 + AAC, aceleração do
// aparelho). O áudio dos takes e a trilha são mixados fora do tempo real. Nada sai do aparelho.
//
// Não usa MediaRecorder: ele grava em tempo real, perde quadro quando a máquina engasga e
// embaralha o tempo ao pausar. Aqui cada quadro tem o carimbo de tempo certo, a duração bate com
// o roteiro e a aba não precisa ficar visível.

import { overlaysAt, segmentAt, type RenderStyle, type Segment, type Timeline } from '@/domain/multiplier'
import { drawEndCardBackdrop, drawOverlay, FONT_FAMILY } from './overlayStyles'

export interface RenderInput {
  readonly timeline: Timeline
  /** Arquivo de cada take, pelo id. */
  readonly files: ReadonlyMap<string, File>
  readonly style: RenderStyle
  readonly music: File | null
  /** 0 a 1. */
  readonly musicVolume: number
  /** Volume do som original dos takes, 0 a 1. */
  readonly takeVolume: number
  readonly signal: AbortSignal
  readonly onProgress: (fraction: number) => void
}

export interface RenderOutput {
  readonly blob: Blob
  readonly mimeType: string
  readonly extension: 'mp4'
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RenderError'
  }
}

const FRAME_RATE = 30
const SAMPLE_RATE = 48_000
const FADE_SECONDS = 0.18
const KEN_BURNS = 0.07
const MUSIC_FADE_SECONDS = 0.8
/** Parte do progresso que é do vídeo; o resto é áudio e fechamento do arquivo. */
const VIDEO_SHARE = 0.92

/** Motivo para não montar neste navegador; nulo quando dá. A checagem do codificador vem na hora de montar. */
export function renderUnsupportedReason(): string | null {
  if (typeof document === 'undefined') return 'Abra no navegador para montar.'
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    return 'Este navegador não monta vídeo. Use o Chrome ou o Edge atualizados no computador.'
  }
  if (typeof OfflineAudioContext === 'undefined') return 'Este navegador não mistura áudio. Use o Chrome ou o Edge atualizados.'
  return null
}

function abortError(): DOMException {
  return new DOMException('Montagem cancelada.', 'AbortError')
}

type Mediabunny = typeof import('mediabunny')
type Wrapped = { readonly canvas: HTMLCanvasElement | OffscreenCanvas }

interface VideoTake {
  readonly input: InstanceType<Mediabunny['Input']>
  readonly frames: InstanceType<Mediabunny['CanvasSink']>
  readonly sound: InstanceType<Mediabunny['AudioBufferSink']> | null
}

interface Sources {
  readonly videos: Map<string, VideoTake>
  readonly images: Map<string, ImageBitmap>
}

async function openSources(mb: Mediabunny, timeline: Timeline, files: ReadonlyMap<string, File>): Promise<Sources> {
  const sources: Sources = { videos: new Map(), images: new Map() }
  try {
    for (const segment of timeline.segments) {
      if (sources.videos.has(segment.takeId) || sources.images.has(segment.takeId)) continue
      const file = files.get(segment.takeId)
      if (!file) throw new RenderError('Falta um arquivo deste projeto. Reenvie os takes na aba Materiais.')
      if (segment.kind === 'image') {
        sources.images.set(segment.takeId, await createImageBitmap(file))
        continue
      }
      const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
      const track = await input.getPrimaryVideoTrack().catch(() => null)
      if (!track || !(await track.canDecode())) {
        input.dispose()
        throw new RenderError(`O navegador não conseguiu ler o vídeo "${file.name}". Exporte em MP4 (H.264) e envie de novo.`)
      }
      const soundTrack = await input.getPrimaryAudioTrack().catch(() => null)
      const sound = soundTrack && (await soundTrack.canDecode()) ? new mb.AudioBufferSink(soundTrack) : null
      // O decodificador já entrega o quadro no tamanho final, cortando como `object-fit: cover`.
      const frames = new mb.CanvasSink(track, { width: timeline.width, height: timeline.height, fit: 'cover', poolSize: 2 })
      sources.videos.set(segment.takeId, { input, frames, sound })
    }
    return sources
  } catch (error) {
    closeSources(sources)
    throw error
  }
}

function closeSources(sources: Sources) {
  sources.videos.forEach((take) => take.input.dispose())
  sources.images.forEach((image) => image.close())
}

/** Desenha a imagem cobrindo o quadro inteiro, cortando o que sobra. */
function drawImageCover(ctx: CanvasRenderingContext2D, image: ImageBitmap, width: number, height: number, zoom: number) {
  const scale = Math.max(width / image.width, height / image.height) * zoom
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

/** Mistura o som dos takes nos trechos usados e a trilha, com a trilha sumindo no fim. */
async function mixAudio(timeline: Timeline, sources: Sources, input: RenderInput): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(timeline.duration * SAMPLE_RATE))
  const context = new OfflineAudioContext(2, length, SAMPLE_RATE)

  const takeGain = context.createGain()
  takeGain.gain.value = input.takeVolume
  takeGain.connect(context.destination)
  if (input.takeVolume > 0) {
    for (const segment of timeline.segments) {
      const sound = sources.videos.get(segment.takeId)?.sound
      if (!sound) continue
      for await (const piece of sound.buffers(segment.from, segment.from + segment.duration)) {
        if (input.signal.aborted) throw abortError()
        const offset = Math.max(0, segment.from - piece.timestamp)
        const when = segment.at + Math.max(0, piece.timestamp - segment.from)
        const playable = Math.min(piece.duration - offset, segment.at + segment.duration - when)
        if (playable <= 0) continue
        const node = context.createBufferSource()
        node.buffer = piece.buffer
        node.connect(takeGain)
        node.start(when, offset, playable)
      }
    }
  }

  if (input.music && input.musicVolume > 0) {
    const decoded = await context.decodeAudioData(await input.music.arrayBuffer()).catch(() => {
      throw new RenderError('A trilha não abriu. Use um arquivo MP3, M4A ou WAV.')
    })
    const musicGain = context.createGain()
    const fadeStart = Math.max(0, timeline.duration - MUSIC_FADE_SECONDS)
    musicGain.gain.setValueAtTime(input.musicVolume, 0)
    musicGain.gain.setValueAtTime(input.musicVolume, fadeStart)
    musicGain.gain.linearRampToValueAtTime(0, timeline.duration)
    musicGain.connect(context.destination)
    const node = context.createBufferSource()
    node.buffer = decoded
    node.loop = true
    node.connect(musicGain)
    node.start(0)
  }

  return context.startRendering()
}

/** Timestamps de quadro (segundos no vídeo final) de um trecho, a 30 por segundo. */
export function frameTimes(start: number, end: number): number[] {
  const times: number[] = []
  for (let frame = Math.ceil(start * FRAME_RATE - 1e-6); frame / FRAME_RATE < end - 1e-6; frame += 1) times.push(frame / FRAME_RATE)
  return times
}

export async function renderVariation(input: RenderInput): Promise<RenderOutput> {
  const { timeline, signal } = input
  const unsupported = renderUnsupportedReason()
  if (unsupported) throw new RenderError(unsupported)
  if (signal.aborted) throw abortError()

  const mb = await import('mediabunny')
  if (!(await mb.canEncodeVideo('avc', { width: timeline.width, height: timeline.height, quality: mb.QUALITY_HIGH }))) {
    throw new RenderError('Este navegador não grava vídeo em MP4. Use o Chrome ou o Edge atualizados no computador.')
  }
  const audioCodec = (await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE })) ? 'aac' : 'opus'

  await document.fonts.load(`800 64px ${FONT_FAMILY}`).catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = timeline.width
  canvas.height = timeline.height
  const ctx = canvas.getContext('2d')
  // Camada só com a imagem da cena, sem texto: também é a base congelada do cartão final.
  const scene = document.createElement('canvas')
  scene.width = canvas.width
  scene.height = canvas.height
  const sceneCtx = scene.getContext('2d')
  if (!ctx || !sceneCtx) throw new RenderError('O navegador não liberou o desenho do vídeo.')
  const box = { width: canvas.width, height: canvas.height }
  sceneCtx.fillStyle = '#000'
  sceneCtx.fillRect(0, 0, box.width, box.height)

  const target = new mb.BufferTarget()
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target })
  const video = new mb.CanvasSource(canvas, { codec: 'avc', quality: mb.QUALITY_HIGH, keyFrameInterval: 1 })
  const audio = new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH })
  output.addVideoTrack(video, { frameRate: FRAME_RATE })
  output.addAudioTrack(audio)

  const sources = await openSources(mb, timeline, input.files)
  const totalFrames = Math.max(1, Math.round(timeline.duration * FRAME_RATE))
  let written = 0

  async function emit(time: number, paintScene: () => void) {
    if (signal.aborted) throw abortError()
    paintScene()
    ctx!.drawImage(scene, 0, 0)
    const segment = segmentAt(timeline, time)
    if (segment) {
      const local = time - segment.at
      if (local < FADE_SECONDS) {
        ctx!.fillStyle = `rgba(0, 0, 0, ${1 - local / FADE_SECONDS})`
        ctx!.fillRect(0, 0, box.width, box.height)
      }
    } else {
      drawEndCardBackdrop(ctx!, box, time - timeline.endCardAt)
    }
    for (const overlay of overlaysAt(timeline, time)) drawOverlay(ctx!, box, overlay, input.style, time - overlay.at)
    await video.add(time, 1 / FRAME_RATE)
    written += 1
    input.onProgress(Math.min(VIDEO_SHARE, (written / totalFrames) * VIDEO_SHARE))
  }

  async function renderVideoSegment(segment: Segment, take: VideoTake) {
    const times = frameTimes(segment.at, segment.at + segment.duration)
    const sourceTimes = times.map((time) => segment.from + (time - segment.at))
    let index = 0
    let last: Wrapped | null = null
    for await (const frame of take.frames.canvasesAtTimestamps(sourceTimes)) {
      // Antes do primeiro quadro do arquivo, segura o anterior (ou preto).
      if (frame) last = frame
      const current = last
      await emit(times[index]!, () => {
        if (current) sceneCtx!.drawImage(current.canvas, 0, 0)
      })
      index += 1
    }
  }

  async function renderImageSegment(segment: Segment, image: ImageBitmap) {
    for (const time of frameTimes(segment.at, segment.at + segment.duration)) {
      const zoom = 1 + KEN_BURNS * ((time - segment.at) / segment.duration)
      await emit(time, () => {
        sceneCtx!.fillStyle = '#000'
        sceneCtx!.fillRect(0, 0, box.width, box.height)
        drawImageCover(sceneCtx!, image, box.width, box.height, zoom)
      })
    }
  }

  try {
    await output.start()
    // O áudio entra inteiro primeiro: é rápido e deixa o vídeo ditar o ritmo do resto.
    await audio.add(await mixAudio(timeline, sources, input))

    for (const segment of timeline.segments) {
      const take = sources.videos.get(segment.takeId)
      const image = sources.images.get(segment.takeId)
      if (take) await renderVideoSegment(segment, take)
      else if (image) await renderImageSegment(segment, image)
    }
    // Cartão final: a camada `scene` guarda o último quadro limpo da última cena.
    for (const time of frameTimes(timeline.endCardAt, timeline.duration)) await emit(time, () => undefined)

    video.close()
    audio.close()
    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => undefined)
    if (error instanceof RenderError || (error instanceof DOMException && error.name === 'AbortError')) throw error
    console.error('render', error)
    throw new RenderError('A montagem falhou. Tente de novo; se repetir, troque o arquivo do take.')
  } finally {
    closeSources(sources)
  }

  if (!target.buffer) throw new RenderError('O vídeo saiu vazio. Tente de novo.')
  input.onProgress(1)
  const blob = new Blob([target.buffer], { type: 'video/mp4' })
  return { blob, mimeType: blob.type, extension: 'mp4' }
}

/** Duração e tamanho de um vídeo escolhido, sem subir nada. */
export async function readVideoInfo(file: File): Promise<{ duration: number; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new RenderError('O vídeo demorou demais para abrir.')), 20_000)
      video.addEventListener(
        'loadedmetadata',
        () => {
          window.clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
      video.addEventListener(
        'error',
        () => {
          window.clearTimeout(timer)
          reject(new RenderError('O navegador não conseguiu ler este vídeo.'))
        },
        { once: true },
      )
    })
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new RenderError('Não deu para ler a duração do vídeo.')
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
