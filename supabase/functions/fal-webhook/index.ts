// Chamado pelo fal.ai quando uma geração termina. Não confia no corpo:
// confere a assinatura do id na URL e consulta o resultado no fal.
//
// Deploy sem verificação de JWT (quem chama é o fal):
//   npx supabase functions deploy fal-webhook --no-verify-jwt

import { adminClient, errorResponse, handle, json, requireEnv } from '../_shared/http.ts'
import { GENERATION_COLUMNS, settleGeneration, type OpenGeneration } from '../_shared/settle.ts'
import { verifyGenerationId } from '../_shared/signature.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(
  handle(async (request) => {
    const url = new URL(request.url)
    const generationId = url.searchParams.get('gid') ?? ''
    const token = url.searchParams.get('t') ?? ''
    if (!UUID.test(generationId) || !(await verifyGenerationId(requireEnv('WEBHOOK_SECRET'), generationId, token))) {
      return errorResponse(401, 'invalid_signature', 'Assinatura inválida.')
    }

    const admin = adminClient()
    const { data: generation } = await admin
      .from('generations')
      .select(GENERATION_COLUMNS)
      .eq('id', generationId)
      .maybeSingle<OpenGeneration>()
    if (!generation) return json({ outcome: 'unknown_generation' })

    // Erro devolve 500 e o fal reenvia; o polling do app também cobre.
    // `pending` acontece quando o fal responde antes de o `generate` gravar
    // as URLs da fila: 503 pede uma nova tentativa.
    const outcome = await settleGeneration(admin, requireEnv('FAL_KEY'), generation)
    return json({ outcome }, outcome === 'pending' ? 503 : 200)
  }),
)
