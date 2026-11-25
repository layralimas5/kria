// Copiar movimento (0044): sobe o vídeo de referência e pede ao servidor para medir e registrar.
import { z } from 'zod'
import { ApiError, invoke } from './api'
import { supabase } from './supabase'

const referenceSchema = z.object({ id: z.string().uuid(), durationMs: z.number().int(), model: z.string() })
export type MotionReference = z.infer<typeof referenceSchema>

/** Duração que o navegador lê do arquivo, só para avisar antes de subir. Quem cobra mede de novo no servidor. */
export function readVideoSeconds(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    const done = () => URL.revokeObjectURL(url)
    video.onloadedmetadata = () => {
      done()
      if (Number.isFinite(video.duration)) resolve(video.duration)
      else reject(new ApiError('invalid_video', 'Não deu para ler esse vídeo. Envie um MP4 ou MOV gravado no celular.'))
    }
    video.onerror = () => {
      done()
      reject(new ApiError('invalid_video', 'Não deu para ler esse vídeo. Envie um MP4 ou MOV gravado no celular.'))
    }
    video.src = url
  })
}

export async function registerMotionReference(userId: string, file: Blob, extension: 'mp4' | 'mov'): Promise<MotionReference> {
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const contentType = extension === 'mov' ? 'video/quicktime' : 'video/mp4'
  const { error } = await supabase.storage.from('motion').upload(path, file, { contentType, upsert: false })
  if (error) throw new ApiError('upload_failed', 'Não deu para enviar o vídeo. Confira a conexão e tente de novo.')
  return referenceSchema.parse(await invoke('motion-reference', { path, rightsConfirmed: true }))
}
