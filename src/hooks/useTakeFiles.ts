import { useCallback, useSyncExternalStore } from 'react'

// Os arquivos dos takes ficam só na memória desta aba, por projeto. Nada sobe para o servidor.
// Sobrevivem à troca de tela; ao recarregar a página, a pessoa escolhe os arquivos de novo.

type FileMap = ReadonlyMap<string, File>

const EMPTY: FileMap = new Map()
const store = new Map<string, FileMap>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setTakeFile(projectId: string, takeId: string, file: File) {
  const next = new Map(store.get(projectId) ?? EMPTY)
  next.set(takeId, file)
  store.set(projectId, next)
  emit()
}

export function removeTakeFile(projectId: string, takeId: string) {
  const current = store.get(projectId)
  if (!current?.has(takeId)) return
  const next = new Map(current)
  next.delete(takeId)
  store.set(projectId, next)
  emit()
}

/** Arquivos já escolhidos para o projeto, por id do take. */
export function useTakeFiles(projectId: string | undefined): FileMap {
  const snapshot = useCallback(() => (projectId ? (store.get(projectId) ?? EMPTY) : EMPTY), [projectId])
  return useSyncExternalStore(subscribe, snapshot)
}
