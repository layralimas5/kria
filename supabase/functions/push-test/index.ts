// Botão "Mandar um teste" das configurações: notifica todos os aparelhos da conta logada.
//   npx supabase functions deploy push-test

import { adminClient, authenticatedUserId, errorResponse, handle, json } from '../_shared/http.ts'
import { sendPush } from '../_shared/push.ts'
import { testMessage } from '../_shared/pushMessages.ts'

Deno.serve(
  handle(async (request) => {
    const admin = adminClient()
    const userId = await authenticatedUserId(request, admin)
    if (!userId) return errorResponse(401, 'not_authenticated', 'Entre na sua conta.')
    const delivered = await sendPush(admin, testMessage(), userId)
    return json({ delivered })
  }),
)
