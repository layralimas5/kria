// POST {}
// Confere no fal o preço atual de cada modelo ativo (API de preço, sem gerar nada) e grava o resultado
// por `admin_record_price_check`, que roda como a pessoa logada: só quem tem `models.manage` e segundo
// fator passa. Preço diferente do guardado tira o modelo do ar (com a trava ligada) até o admin rever.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchFalPrices } from '../_shared/falPricing.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, json, requireEnv } from '../_shared/http.ts'

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    // Cliente com o JWT da pessoa: a permissão é conferida no banco, não aqui.
    const asUser = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: request.headers.get('authorization') ?? '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: models, error: modelsError } = await asUser.rpc('admin_model_quotes')
    if (modelsError) return errorResponse(403, modelsError.message, 'Você não tem acesso a essa conferência.')
    const endpoints = ((models as { models: { provider: string; endpoint: string; active: boolean }[] }).models ?? [])
      .filter((model) => model.provider === 'fal' && model.active)
      .map((model) => model.endpoint)

    let prices
    try {
      prices = await fetchFalPrices(requireEnv('FAL_KEY'), endpoints)
    } catch (fetchError) {
      console.error('pricing-check fal', fetchError)
      return errorResponse(502, 'provider_unavailable', 'O fal não respondeu a consulta de preço. Nada foi alterado.')
    }

    const { data: checked, error } = await asUser.rpc('admin_record_price_check', { p_checks: prices })
    if (error) return errorResponse(403, error.message, 'A conferência não foi gravada.')
    const found = new Set(prices.map((price) => price.endpoint_id))
    return json({ checked, missing: [...new Set(endpoints)].filter((endpoint) => !found.has(endpoint)) })
  }),
)
