import { z } from 'zod'
import { TEXT_GENERATION_COLUMNS, textGenerationSchema, type Brand, type Project, type TextGeneration } from '@/domain/types'
import { fetchBrands, fetchProjects } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useQuery, type QueryState } from './useQuery'

const TEXT_HISTORY_LIMIT = 30

async function fetchTextHistory(): Promise<TextGeneration[]> {
  const { data, error } = await supabase
    .from('generations')
    .select(TEXT_GENERATION_COLUMNS)
    .eq('kind', 'text')
    .order('created_at', { ascending: false })
    .limit(TEXT_HISTORY_LIMIT)
  if (error) throw error
  return z.array(textGenerationSchema).parse(data)
}

export function useBrands(): QueryState<Brand[]> {
  return useQuery(fetchBrands, 'Não deu para carregar suas marcas.')
}

export function useProjects(): QueryState<Project[]> {
  return useQuery(fetchProjects, 'Não deu para carregar seus projetos.')
}

/** Os últimos textos do assistente, de todas as ferramentas. */
export function useTextHistory(): QueryState<TextGeneration[]> {
  return useQuery(fetchTextHistory, 'Não deu para carregar seu histórico de textos.')
}
