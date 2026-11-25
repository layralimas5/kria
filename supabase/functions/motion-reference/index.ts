// POST { path, rightsConfirmed: true }: registra o vídeo de referência do Copiar movimento (0044).
// O navegador já subiu o arquivo em `motion/<user_id>/<uuid>.mp4|mov`. Aqui o servidor baixa, mede a duração
// no próprio arquivo e devolve o nível de cobrança. Vídeo fora das regras é apagado na hora.
//   npx supabase functions deploy motion-reference

import { z } from 'npm:zod@3'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, authenticatedUserId, errorResponse, handle, isSuspended, json, readJson } from '../_shared/http.ts'
import { motionTierFor, mp4DurationMs } from '../_shared/mp4Duration.ts'

const BUCKET = 'motion'
const MAX_BYTES = 50 * 1024 * 1024
const MAX_PER_DAY = 30
/** Vídeo com mais de 6 h (abandonado, ou de geração que não fechou): apagado quando a pessoa registra outro. */
const ABANDONED_AFTER_MS = 6 * 60 * 60 * 1000

const bodySchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov)$/),
  rightsConfirmed: z.literal(true),
})

async function discard(admin: SupabaseClient, path: string): Promise<void> {
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) console.error('motion: não apagou o arquivo', path, error.message)
}

async function cleanAbandoned(admin: SupabaseClient, userId: string): Promise<void> {
  const before = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString()
  const { data } = await admin
    .from('motion_references')
    .select('id, path')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .lt('created_at', before)
  for (const row of (data ?? []) as { id: string; path: string }[]) {
    await discard(admin, row.path)
    await admin.from('motion_references').update({ deleted_at: new Date().toISOString() }).eq('id', row.id)
  }
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')
    if (await isSuspended(admin, userId)) return errorResponse(403, 'account_suspended', 'Sua conta está suspensa. Fale com o suporte.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return errorResponse(400, 'invalid_body', 'Confirme que o vídeo é seu ou que você tem autorização para usá-lo.')
    }
    const path = parsed.data.path
    if (!path.startsWith(`${userId}/`)) return errorResponse(404, 'upload_not_found', 'Vídeo não encontrado. Envie de novo.')

    const { count } = await admin
      .from('motion_references')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if ((count ?? 0) >= MAX_PER_DAY) {
      await discard(admin, path)
      return errorResponse(429, 'too_many_uploads', 'Você chegou ao limite de vídeos de referência de hoje. Volte amanhã.')
    }

    const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path)
    if (downloadError || !file) return errorResponse(404, 'upload_not_found', 'Vídeo não encontrado. Envie de novo.')
    if (file.size > MAX_BYTES) {
      await discard(admin, path)
      return errorResponse(413, 'file_too_large', 'O vídeo pode ter até 50 MB.')
    }

    const durationMs = mp4DurationMs(new Uint8Array(await file.arrayBuffer()))
    if (durationMs === null) {
      await discard(admin, path)
      return errorResponse(422, 'invalid_video', 'Não deu para ler esse vídeo. Envie um MP4 ou MOV gravado no celular.')
    }
    const tier = motionTierFor(durationMs)
    if (!tier.ok) {
      await discard(admin, path)
      return errorResponse(422, 'invalid_duration', tier.reason)
    }

    const { data: reference, error: insertError } = await admin
      .from('motion_references')
      .insert({
        user_id: userId,
        path,
        content_type: path.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
        size_bytes: file.size,
        duration_ms: durationMs,
        rights_confirmed_at: new Date().toISOString(),
      })
      .select('id')
      .single<{ id: string }>()
    if (insertError || !reference) {
      await discard(admin, path)
      throw new Error(`motion_references: ${insertError?.message}`)
    }

    await cleanAbandoned(admin, userId).catch((cleanError) => console.error('motion: limpeza', cleanError))
    return json({ id: reference.id, durationMs, model: tier.tier.slug }, 201)
  }),
)
