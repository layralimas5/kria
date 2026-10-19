// POST { ids: uuid[] }
// Rede de segurança do webhook: o app chama para gerações que estão
// abertas há um tempo. Fecha as que já terminaram no fal e cancela (com
// estorno) as que passaram do limite.

import { z } from 'npm:zod@3'
import { adminClient, authenticatedUserId, errorResponse, handle, json, readJson, requireEnv } from '../_shared/http.ts'
import { GENERATION_COLUMNS, settleGeneration, type OpenGeneration } from '../_shared/settle.ts'

const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(10) })

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')

    const { data: open, error } = await admin
      .from('generations')
      .select(GENERATION_COLUMNS)
      .eq('user_id', userId)
      .in('id', parsed.data.ids)
      .in('status', ['queued', 'running'])
      .returns<OpenGeneration[]>()
    if (error) throw new Error(`select: ${error.message}`)

    const falKey = requireEnv('FAL_KEY')
    const outcomes = await Promise.all(
      (open ?? []).map(async (generation) => {
        try {
          return { id: generation.id, outcome: await settleGeneration(admin, falKey, generation) }
        } catch (settleError) {
          console.error('settle failed', generation.id, settleError)
          return { id: generation.id, outcome: 'pending' as const }
        }
      }),
    )
    return json({ outcomes })
  }),
)
