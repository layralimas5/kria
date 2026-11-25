import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { detectPlatform, type Platform } from '@/domain/appDevice'
import { canPromptInstall, isStandalone, promptInstall, subscribeInstallPrompt } from '@/lib/pwa'

export interface InstallApp {
  readonly installed: boolean
  /** O navegador deixa abrir o diálogo de instalação pelo nosso botão (Chrome, Edge, Android). */
  readonly canPrompt: boolean
  readonly platform: Platform
  readonly install: () => Promise<boolean>
}

export function useInstallApp(): InstallApp {
  const canPrompt = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false)
  const installed = useMemo(() => isStandalone(), [])
  const platform = useMemo(() => detectPlatform(navigator.userAgent, navigator.maxTouchPoints), [])
  const install = useCallback(() => promptInstall(), [])
  return { installed, canPrompt, platform, install }
}
