import { z } from 'zod'
import {
  creditPackSchema,
  ledgerEntrySchema,
  modelSchema,
  personaSchema,
  type CreditPack,
  type LedgerEntry,
  type Model,
  type Persona,
} from '@/domain/types'
import { supabase } from '@/lib/supabase'
import { useQuery, type QueryState } from './useQuery'

async function fetchModels(): Promise<Model[]> {
  const { data, error } = await supabase
    .from('models')
    .select('slug, name, description, kind, requires_image, credits, position, badge, defaults, allowed_plans')
    .order('position')
  if (error) throw error
  return z.array(modelSchema).parse(data)
}

async function fetchPacks(): Promise<CreditPack[]> {
  const { data, error } = await supabase
    .from('credit_packs')
    .select('slug, name, credits, price_cents, highlight')
    .order('position')
  if (error) throw error
  return z.array(creditPackSchema).parse(data)
}

async function fetchPersonas(): Promise<Persona[]> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, name, description, image_path, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return z.array(personaSchema).parse(data)
}

async function fetchLedger(): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, delta, reason, note, balance_after, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return z.array(ledgerEntrySchema).parse(data)
}

export function useModels(): QueryState<Model[]> {
  return useQuery(fetchModels, 'Não deu para carregar os modelos.')
}

export function usePacks(): QueryState<CreditPack[]> {
  return useQuery(fetchPacks, 'Não deu para carregar os pacotes.')
}

export function usePersonas(): QueryState<Persona[]> {
  return useQuery(fetchPersonas, 'Não deu para carregar suas personas.')
}

export function useLedger(): QueryState<LedgerEntry[]> {
  return useQuery(fetchLedger, 'Não deu para carregar o extrato.')
}
