// Apaga o vídeo de referência do Copiar movimento (0044) quando a geração termina, dá certo ou falha.
// Nunca lança: o vídeo que sobrar é apagado depois pela limpeza da function motion-reference.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function discardMotionReference(admin: SupabaseClient, referenceId: string | null): Promise<void> {
  if (!referenceId) return
  try {
    const { data } = await admin
      .from('motion_references')
      .select('path')
      .eq('id', referenceId)
      .is('deleted_at', null)
      .maybeSingle<{ path: string }>()
    if (!data) return
    const { error } = await admin.storage.from('motion').remove([data.path])
    if (error) throw new Error(error.message)
    await admin.from('motion_references').update({ deleted_at: new Date().toISOString() }).eq('id', referenceId)
  } catch (error) {
    console.error('motion: não apagou o vídeo de referência', referenceId, error)
  }
}
