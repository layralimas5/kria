// POST {}
// Encerra a cobrança recorrente no Asaas. O plano continua valendo até o fim
// do período já pago (current_plan olha current_period_end), e os créditos ficam.

import { AsaasError, cancelProviderSubscription } from '../_shared/asaas.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, json } from '../_shared/http.ts'

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const { data: open } = await admin
      .from('subscriptions')
      .select('id, status, provider_subscription_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'active', 'overdue'])
      .maybeSingle<{ id: string; status: string; provider_subscription_id: string | null }>()
    if (!open) return errorResponse(404, 'no_subscription', 'Você não tem assinatura ativa.')

    const now = new Date().toISOString()
    if (open.status === 'pending' || !open.provider_subscription_id) {
      await admin.from('subscriptions').update({ status: 'expired', updated_at: now }).eq('id', open.id)
      return json({ canceled: true })
    }

    try {
      await cancelProviderSubscription(open.provider_subscription_id)
    } catch (cancelError) {
      // 404: já não existe no Asaas; o resto é falha de verdade.
      if (!(cancelError instanceof AsaasError && cancelError.status === 404)) {
        console.error('cancel failed', cancelError instanceof AsaasError ? cancelError.body : cancelError)
        return errorResponse(502, 'payment_unavailable', 'Não deu para cancelar agora. Tente de novo em instantes.')
      }
    }
    await admin.from('subscriptions').update({ status: 'canceled', canceled_at: now, updated_at: now }).eq('id', open.id)
    return json({ canceled: true })
  }),
)
