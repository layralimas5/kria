// POST { model, prompt, personaId?, sourceGenerationId?, idempotencyKey? }
// Reserva os créditos, manda para a fila do fal.ai e devolve a geração.
// O resultado chega pelo fal-webhook (ou pelo polling do generation-status).

import { z } from 'npm:zod@3'
import { submit } from '../_shared/fal.ts'
import { buildProviderInput, checkPrompt, type ModelRow } from '../_shared/generation.ts'
import {
  adminClient,
  authenticatedUserId,
  databaseErrorResponse,
  errorResponse,
  handle,
  json,
  readJson,
  requireEnv,
} from '../_shared/http.ts'
import { signGenerationId } from '../_shared/signature.ts'

const bodySchema = z.object({
  model: z.string().regex(/^[a-z0-9-]{2,40}$/),
  prompt: z.string().trim().min(3).max(2000),
  personaId: z.string().uuid().optional(),
  sourceGenerationId: z.string().uuid().optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,80}$/).optional(),
})

const SIGNED_URL_SECONDS = 60 * 60

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    const body = parsed.data

    const check = checkPrompt(body.prompt)
    if (!check.ok) return errorResponse(422, 'prompt_blocked', check.reason)

    const { data: generation, error } = await admin
      .rpc('create_generation', {
        p_user_id: userId,
        p_model_slug: body.model,
        p_prompt: body.prompt,
        p_persona_id: body.personaId ?? null,
        p_source_generation_id: body.sourceGenerationId ?? null,
        p_idempotency_key: body.idempotencyKey ?? null,
      })
      .single<{ id: string }>()
    if (error?.message === 'duplicate_request' && body.idempotencyKey) {
      // Clique repetido ou nova tentativa da rede: devolve o que já existe, sem cobrar nem reenviar.
      const { data: existing } = await admin
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .eq('idempotency_key', body.idempotencyKey)
        .single()
      return json({ generation: existing }, 200)
    }
    if (error || !generation) return databaseErrorResponse(error ?? { message: 'no_row' })

    try {
      const { data: model, error: modelError } = await admin
        .from('models')
        .select('slug, name, kind, endpoint, image_input, requires_image, credits, defaults')
        .eq('slug', body.model)
        .single<ModelRow>()
      if (modelError || !model) throw new Error(`modelo: ${modelError?.message}`)

      const imageUrl = await sourceImageUrl(body.personaId, body.sourceGenerationId)
      const token = await signGenerationId(requireEnv('WEBHOOK_SECRET'), generation.id)
      const webhookUrl = `${requireEnv('SUPABASE_URL')}/functions/v1/fal-webhook?gid=${generation.id}&t=${token}`
      const submission = await submit(
        requireEnv('FAL_KEY'),
        model.endpoint,
        buildProviderInput(model, body.prompt, imageUrl),
        webhookUrl,
      )

      const { data: running, error: updateError } = await admin
        .from('generations')
        .update({
          status: 'running',
          provider_request_id: submission.request_id,
          provider_status_url: submission.status_url,
          provider_response_url: submission.response_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generation.id)
        .eq('status', 'queued')
        .select('*')
        .single()
      if (updateError) throw new Error(`update: ${updateError.message}`)
      return json({ generation: running }, 201)
    } catch (submitError) {
      console.error('submit failed', submitError)
      await admin.rpc('fail_generation', { p_id: generation.id, p_error: 'Não conseguimos iniciar a geração.' })
      return errorResponse(502, 'provider_unavailable', 'O gerador não respondeu. Seus créditos foram devolvidos.')
    }

    async function sourceImageUrl(personaId?: string, sourceGenerationId?: string): Promise<string | null> {
      const path = personaId
        ? (await admin.from('personas').select('image_path').eq('id', personaId).single()).data?.image_path
        : sourceGenerationId
          ? (await admin.from('generations').select('output_path').eq('id', sourceGenerationId).single()).data
              ?.output_path
          : null
      if (!path) return null
      const { data, error: signError } = await admin.storage.from('media').createSignedUrl(path, SIGNED_URL_SECONDS)
      if (signError || !data) throw new Error(`signed url: ${signError?.message}`)
      return data.signedUrl
    }
  }),
)
