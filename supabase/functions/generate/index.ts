// POST { model, prompt, options?, personaId?, sourceGenerationId?, brandId?, projectId?, idempotencyKey? }
// Reserva os créditos, manda para a fila do fal.ai e devolve a geração.
// O resultado chega pelo fal-webhook (ou pelo polling do generation-status).

import { z } from 'npm:zod@3'
import { submit } from '../_shared/fal.ts'
import { buildProviderInput, checkPrompt, parseModelOptions, resolveOptions, type ModelRow } from '../_shared/generation.ts'
import { providerFor } from '../_shared/providers.ts'
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
  /** Escolhas da pessoa (proporção, por exemplo), conferidas contra `models.options`. */
  options: z.record(z.string().regex(/^[a-z_]{2,30}$/), z.string().max(20)).default({}),
  personaId: z.string().uuid().optional(),
  sourceGenerationId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
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

    // Antes de reservar crédito: opção fora do catálogo não chega ao fornecedor.
    const { data: catalogRow, error: catalogError } = await admin
      .from('models')
      .select('options')
      .eq('slug', body.model)
      .maybeSingle<{ options: unknown }>()
    if (catalogError) return databaseErrorResponse(catalogError)
    if (!catalogRow) return errorResponse(400, 'model_unavailable', 'Esse modelo não está disponível.')
    const options = resolveOptions(parseModelOptions(catalogRow.options), body.options)
    if (!options.ok) return errorResponse(400, 'invalid_option', options.reason)

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

    if (body.brandId || body.projectId || Object.keys(options.values).length > 0) {
      // Antes de pagar o fal: o trigger `generations_context` recusa marca ou projeto de outra pessoa.
      const { error: contextError } = await admin
        .from('generations')
        .update({ brand_id: body.brandId ?? null, project_id: body.projectId ?? null, options: options.values })
        .eq('id', generation.id)
      if (contextError) {
        await admin.rpc('fail_generation', { p_id: generation.id, p_error: 'Projeto ou marca não encontrados.' })
        return errorResponse(404, 'context_not_found', 'Projeto ou marca não encontrados. Seus créditos foram devolvidos.')
      }
    }

    try {
      const { data: model, error: modelError } = await admin
        .from('models')
        .select('slug, name, kind, provider, endpoint, image_input, requires_image, credits, defaults, options')
        .eq('slug', body.model)
        .single<Omit<ModelRow, 'options'> & { provider: string; options: unknown }>()
      if (modelError || !model) throw new Error(`modelo: ${modelError?.message}`)
      providerFor(model.provider, model.kind)

      const imageUrl = await sourceImageUrl(body.personaId, body.sourceGenerationId)
      const token = await signGenerationId(requireEnv('WEBHOOK_SECRET'), generation.id)
      const webhookUrl = `${requireEnv('SUPABASE_URL')}/functions/v1/fal-webhook?gid=${generation.id}&t=${token}`
      const submission = await submit(
        requireEnv('FAL_KEY'),
        model.endpoint,
        buildProviderInput({ ...model, options: parseModelOptions(model.options) }, body.prompt, imageUrl, options.values),
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
