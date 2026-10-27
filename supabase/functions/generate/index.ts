// POST { model, prompt, options?, personaId?, sourceGenerationId?, uploadId?, endGenerationId?, brandId?, projectId?, idempotencyKey? }
//   ou { format: { slug, step, fields, note }, uploadId | sourceGenerationId, endGenerationId?, ... }:
//   com formato, modelo e prompt saem da tabela `formats` (0015), nunca do cliente.
// Reserva os créditos, manda para a fila do fal.ai e devolve a geração.
// O resultado chega pelo fal-webhook (ou pelo polling do generation-status).

import { z } from 'npm:zod@3'
import { submit } from '../_shared/fal.ts'
import { NOTE_MAX, parseFormatFields, planFormatStep, type FormatRow } from '../_shared/formats.ts'
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

const formatSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  step: z.enum(['edit', 'final']),
  fields: z.record(z.string().regex(/^[a-z_]{2,30}$/), z.string().max(40)).default({}),
  note: z.string().max(NOTE_MAX).default(''),
})

const bodySchema = z
  .object({
    model: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
    prompt: z.string().trim().min(3).max(2000).optional(),
    format: formatSchema.optional(),
    /** Escolhas da pessoa (proporção, por exemplo), conferidas contra `models.options`. */
    options: z.record(z.string().regex(/^[a-z_]{2,30}$/), z.string().max(20)).default({}),
    personaId: z.string().uuid().optional(),
    sourceGenerationId: z.string().uuid().optional(),
    uploadId: z.string().uuid().optional(),
    endGenerationId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,80}$/).optional(),
  })
  // Ou formato, ou modelo + prompt: nunca os dois.
  .refine((body) => (body.format ? !body.model && !body.prompt : Boolean(body.model && body.prompt)))

const SIGNED_URL_SECONDS = 60 * 60

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    const body = parsed.data

    let job: { model: string; prompt: string }
    if (body.format) {
      const { data: formatRow, error: formatError } = await admin
        .from('formats')
        .select('slug, flow, model_slug, prompt_template, edit_model_slug, edit_prompt_template, fields')
        .eq('slug', body.format.slug)
        .eq('active', true)
        .maybeSingle<Omit<FormatRow, 'fields'> & { fields: unknown }>()
      if (formatError) return databaseErrorResponse(formatError)
      if (!formatRow) return errorResponse(400, 'format_unavailable', 'Esse formato não está disponível.')
      const format: FormatRow = { ...formatRow, fields: parseFormatFields(formatRow.fields) }
      // O quadro final só existe no vídeo do antes e depois.
      const wantsEnd = format.flow === 'before_after' && body.format.step === 'final'
      if (wantsEnd !== Boolean(body.endGenerationId)) {
        return errorResponse(400, 'invalid_body', wantsEnd ? 'Gere a foto do depois primeiro.' : 'Pedido inválido.')
      }
      const plan = planFormatStep(format, body.format.step, body.format.fields, body.format.note)
      if (!plan.ok) return errorResponse(422, 'invalid_format_choice', plan.reason)
      job = { model: plan.model, prompt: plan.prompt }
    } else {
      job = { model: body.model!, prompt: body.prompt! }
    }

    const check = checkPrompt(job.prompt)
    if (!check.ok) return errorResponse(422, 'prompt_blocked', check.reason)

    // Antes de reservar crédito: opção fora do catálogo não chega ao fornecedor.
    const { data: catalogRow, error: catalogError } = await admin
      .from('models')
      .select('options')
      .eq('slug', job.model)
      .maybeSingle<{ options: unknown }>()
    if (catalogError) return databaseErrorResponse(catalogError)
    if (!catalogRow) return errorResponse(400, 'model_unavailable', 'Esse modelo não está disponível.')
    const options = resolveOptions(parseModelOptions(catalogRow.options), body.options)
    if (!options.ok) return errorResponse(400, 'invalid_option', options.reason)

    const { data: generation, error } = await admin
      .rpc('create_generation', {
        p_user_id: userId,
        p_model_slug: job.model,
        p_prompt: job.prompt,
        p_persona_id: body.personaId ?? null,
        p_source_generation_id: body.sourceGenerationId ?? null,
        p_idempotency_key: body.idempotencyKey ?? null,
        p_upload_id: body.uploadId ?? null,
        p_end_generation_id: body.endGenerationId ?? null,
        p_format_slug: body.format?.slug ?? null,
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
        .select('slug, name, kind, provider, endpoint, image_input, end_image_input, requires_image, credits, defaults, options')
        .eq('slug', job.model)
        .single<Omit<ModelRow, 'options'> & { provider: string; options: unknown }>()
      if (modelError || !model) throw new Error(`modelo: ${modelError?.message}`)
      providerFor(model.provider, model.kind)

      const imageUrl = await signedUrlFor(await sourcePath())
      const endImageUrl = body.endGenerationId ? await signedUrlFor(await generationOutputPath(body.endGenerationId)) : null
      const token = await signGenerationId(requireEnv('WEBHOOK_SECRET'), generation.id)
      const webhookUrl = `${requireEnv('SUPABASE_URL')}/functions/v1/fal-webhook?gid=${generation.id}&t=${token}`
      const submission = await submit(
        requireEnv('FAL_KEY'),
        model.endpoint,
        buildProviderInput({ ...model, options: parseModelOptions(model.options) }, job.prompt, imageUrl, options.values, endImageUrl),
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

    // A posse de persona, foto e geração já foi conferida em create_generation.
    async function sourcePath(): Promise<string | null> {
      if (body.personaId) return (await admin.from('personas').select('image_path').eq('id', body.personaId).single()).data?.image_path ?? null
      if (body.uploadId) return (await admin.from('uploads').select('path').eq('id', body.uploadId).single()).data?.path ?? null
      if (body.sourceGenerationId) return generationOutputPath(body.sourceGenerationId)
      return null
    }

    async function generationOutputPath(id: string): Promise<string | null> {
      return (await admin.from('generations').select('output_path').eq('id', id).single()).data?.output_path ?? null
    }

    async function signedUrlFor(path: string | null): Promise<string | null> {
      if (!path) return null
      const { data, error: signError } = await admin.storage.from('media').createSignedUrl(path, SIGNED_URL_SECONDS)
      if (signError || !data) throw new Error(`signed url: ${signError?.message}`)
      return data.signedUrl
    }
  }),
)
