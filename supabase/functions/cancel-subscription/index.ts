// POST {}
// Cancela a cobrança recorrente no Asaas e marca a assinatura como cancelada.
// O plano e os créditos dele continuam valendo até o fim do período pago.

import { deleteSubscription } from '../_shared/asaas.ts'
import { adminClient, authenticatedUserId, errorResponse, handle, json } from '../_shared/http.ts'

interface LiveSubscription {
  readonly id: string
  readonly provider_subscription_id: string | null
  readonly current_period_end: string | null
}

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'unauthorized', 'Entre na sua conta.')

    const { data: live } = await admin
      .from('subscriptions')
      .select('id, provider_subscription_id, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due'])
      .maybeSingle<LiveSubscription>()
    if (!live) return errorResponse(404, 'no_subscription', 'Você não tem assinatura ativa.')

    // Primeiro no Asaas: se falhar lá, nada muda aqui e a pessoa pode tentar de novo.
    if (live.provider_subscription_id) {
      try {
        await deleteSubscription(live.provider_subscription_id)
      } catch (cancelError) {
        console.error('cancel subscription failed', cancelError)
        return errorResponse(502, 'payment_unavailable', 'Não conseguimos cancelar agora. Tente de novo em instantes.')
      }
    }

    const { error } = await admin.rpc('set_subscription_status', { p_subscription_id: live.id, p_status: 'canceled' })
    if (error) throw new Error(`set_subscription_status: ${error.message}`)
    return json({ currentPeriodEnd: live.current_period_end })
  }),
)
