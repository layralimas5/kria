// POST { projectId, count, idempotencyKey? }
// Multiplicador: abre o lote (plano, saldo, limites e teto de gasto em `start_multiplier_batch`),
// pede as variações ao Claude e grava tudo de uma vez. Se o Claude falhar, o crédito volta.
// A montagem dos vídeos acontece no navegador; aqui só nasce o roteiro.

import { z } from 'npm:zod@3'
import { ClaudeError, generateText } from '../_shared/claude.ts'
import { effortFrom } from '../_shared/assistant.ts'
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
import {
  buildMultiplierMessage,
  MULTIPLIER_OUTPUT_JSON_SCHEMA,
  MULTIPLIER_SYSTEM_PROMPT,
  parseMultiplierOutput,
  type MultiplierProject,
} from '../_shared/multiplier.ts'
import { providerFor } from '../_shared/providers.ts'

const bodySchema = z.object({
  projectId: z.string().uuid(),
  count: z.number().int().min(1).max(20),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,80}$/).optional(),
})

const PROJECT_COLUMNS = 'name, product_name, product_description, audience, platform, objective, aspect, transcript, takes'

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const parsed = bodySchema.safeParse(await readJson(request))
    if (!parsed.success) return errorResponse(400, 'invalid_body', 'Pedido inválido.')
    const body = parsed.data

    const { data: project } = await admin
      .from('multiplier_projects')
      .select(PROJECT_COLUMNS)
      .eq('id', body.projectId)
      .eq('user_id', userId)
      .maybeSingle<MultiplierProject>()
    if (!project) return errorResponse(404, 'project_not_found', 'Projeto não encontrado.')

    const briefing = [project.product_name, project.product_description, project.audience, project.transcript, ...project.takes.map((take) => take.note)]
    const check = checkPrompt(briefing.join(' ').trim() || project.name)
    if (!check.ok) return errorResponse(422, 'prompt_blocked', check.reason)

    const { data: generation, error } = await admin
      .rpc('start_multiplier_batch', {
        p_user_id: userId,
        p_project_id: body.projectId,
        p_count: body.count,
        p_idempotency_key: body.idempotencyKey ?? null,
      })
      .single<{ id: string }>()
    if (error?.message === 'duplicate_request' && body.idempotencyKey) {
      const { data: existing } = await admin
        .from('generations')
        .select('id, status')
        .eq('user_id', userId)
        .eq('idempotency_key', body.idempotencyKey)
        .single()
      return json({ generation: existing }, 200)
    }
    if (error || !generation) return databaseErrorResponse(error ?? { message: 'no_row' })

    try {
      await admin.from('generations').update({ status: 'running' }).eq('id', generation.id)

      const { data: model, error: modelError } = await admin
        .from('models')
        .select('provider, endpoint, defaults')
        .eq('slug', 'multiplicador')
        .single<{ provider: string; endpoint: string; defaults: Record<string, unknown> }>()
      if (modelError || !model) throw new Error(`modelo: ${modelError?.message}`)
      providerFor(model.provider, 'text')

      const result = await generateText(requireEnv('ANTHROPIC_API_KEY'), {
        model: model.endpoint,
        effort: effortFrom(model.defaults),
        system: MULTIPLIER_SYSTEM_PROMPT,
        userMessage: buildMultiplierMessage(project, body.count),
        schema: MULTIPLIER_OUTPUT_JSON_SCHEMA,
      })
      const output = parseMultiplierOutput(result.json, project.takes, body.count)
      if (!output) throw new ClaudeError('saída fora do formato', 'Os roteiros vieram incompletos. Tente de novo.')
      console.log('multiplier usage', body.count, result.usage)

      const { error: completeError } = await admin.rpc('complete_multiplier_batch', {
        p_generation_id: generation.id,
        p_project_id: body.projectId,
        p_analysis: output.analysis,
        p_scripts: output.variations,
      })
      if (completeError) throw new Error(`complete: ${completeError.message}`)

      return json({ generation: { id: generation.id, status: 'succeeded' }, variations: output.variations.length }, 201)
    } catch (failure) {
      console.error('multiplier failed', failure)
      const message = failure instanceof ClaudeError ? failure.publicMessage : 'O Multiplicador não respondeu agora.'
      await admin.rpc('fail_generation', { p_id: generation.id, p_error: message })
      return errorResponse(502, 'provider_unavailable', `${message} Seus créditos foram devolvidos.`)
    }
  }),
)
