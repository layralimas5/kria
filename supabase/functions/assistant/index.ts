// POST { tool, brief, channel, format?, goal?, length?, tone?, brandId?, projectId?, idempotencyKey? }
// Vynkio AI: reserva os créditos, pede o texto ao Claude com o contexto da marca
// e conclui na hora. Se o Claude falhar ou recusar, a reserva volta.

import { z } from 'npm:zod@3'
import {
  ASSISTANT_TOOLS,
  buildUserMessage,
  CHANNELS,
  COPY_FORMATS,
  effortFrom,
  GOALS,
  LENGTHS,
  parseAssistantOutput,
  SYSTEM_PROMPT,
  type BrandContext,
} from '../_shared/assistant.ts'
import { ClaudeError, generateText } from '../_shared/claude.ts'
import { providerFor } from '../_shared/providers.ts'
import { checkPrompt } from '../_shared/generation.ts'
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

const bodySchema = z.object({
  tool: z.enum(ASSISTANT_TOOLS),
  brief: z.string().trim().min(3).max(2000),
  channel: z.enum(CHANNELS).default('instagram'),
  format: z.enum(COPY_FORMATS).optional(),
  goal: z.enum(GOALS).optional(),
  length: z.enum(LENGTHS).optional(),
  tone: z.string().trim().max(80).optional(),
  brandId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,80}$/).optional(),
})

const BRAND_COLUMNS =
  'name, niche, audience, tone, offer, avoid, visual_style, description, goals, platforms, communication, references_notes'

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    const body = parsed.data

    const check = checkPrompt(body.brief)
    if (!check.ok) return errorResponse(422, 'prompt_blocked', check.reason)

    const brand = body.brandId ? await loadBrand(userId, body.brandId) : null
    if (body.brandId && !brand) return errorResponse(404, 'brand_not_found', 'Marca não encontrada.')

    const { data: generation, error } = await admin
      .rpc('create_generation', {
        p_user_id: userId,
        p_model_slug: body.tool,
        p_prompt: body.brief,
        p_idempotency_key: body.idempotencyKey ?? null,
      })
      .single<{ id: string }>()
    if (error?.message === 'duplicate_request' && body.idempotencyKey) {
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
      // O trigger `generations_context` recusa marca ou projeto de outra pessoa.
      const { error: contextError } = await admin
        .from('generations')
        .update({ brand_id: body.brandId ?? null, project_id: body.projectId ?? null, status: 'running' })
        .eq('id', generation.id)
      if (contextError) throw new ClaudeError(`contexto: ${contextError.message}`, 'Projeto ou marca não encontrados.')

      const { data: model, error: modelError } = await admin
        .from('models')
        .select('provider, endpoint, defaults')
        .eq('slug', body.tool)
        .single<{ provider: string; endpoint: string; defaults: Record<string, unknown> }>()
      if (modelError || !model) throw new Error(`modelo: ${modelError?.message}`)
      providerFor(model.provider, 'text')

      const result = await generateText(requireEnv('ANTHROPIC_API_KEY'), {
        model: model.endpoint,
        effort: effortFrom(model.defaults),
        system: SYSTEM_PROMPT,
        userMessage: buildUserMessage({
          tool: body.tool,
          brief: body.brief,
          channel: body.channel,
          brand,
          format: body.format,
          goal: body.goal,
          length: body.length,
          tone: body.tone,
        }),
      })
      const output = parseAssistantOutput(result.json)
      if (!output) throw new ClaudeError('saída fora do formato', 'A resposta veio incompleta. Tente de novo.')
      console.log('assistant usage', body.tool, result.usage)

      const { error: completeError } = await admin.rpc('complete_text_generation', {
        p_id: generation.id,
        p_output_text: JSON.stringify(output),
      })
      if (completeError) throw new Error(`complete: ${completeError.message}`)

      const { data: done } = await admin.from('generations').select('*').eq('id', generation.id).single()
      return json({ generation: done }, 201)
    } catch (failure) {
      console.error('assistant failed', failure)
      const message = failure instanceof ClaudeError ? failure.publicMessage : 'O assistente não respondeu agora.'
      await admin.rpc('fail_generation', { p_id: generation.id, p_error: message })
      return errorResponse(502, 'provider_unavailable', `${message} Seus créditos foram devolvidos.`)
    }

    async function loadBrand(ownerId: string, brandId: string): Promise<BrandContext | null> {
      const { data } = await admin
        .from('brands')
        .select(BRAND_COLUMNS)
        .eq('id', brandId)
        .eq('user_id', ownerId)
        .maybeSingle<BrandContext>()
      return data ?? null
    }
  }),
)
