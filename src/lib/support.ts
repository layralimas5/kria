import { mySupportSchema, type MySupport } from '@/domain/support'
import { supabase } from './supabase'

/** Canal e contato do plano em vigor de quem está logado (`my_support`, 0028). */
export async function fetchMySupport(): Promise<MySupport> {
  const { data, error } = await supabase.rpc('my_support')
  if (error) throw new Error(`my_support: ${error.message}`)
  return mySupportSchema.parse(data)
}
