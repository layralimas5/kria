import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Profile, ProfileUpdate } from '@/domain/types'
import { fetchAccountStats, fetchProfile, updateProfile, type AccountStats } from '@/lib/api'
import { useUserId } from './useSession'

interface ProfileState {
  readonly profile: Profile | null
  readonly error: string | null
  readonly stats: AccountStats | null
  readonly refreshStats: () => Promise<void>
  readonly save: (update: ProfileUpdate) => Promise<Profile>
}

const ProfileContext = createContext<ProfileState | null>(null)

/** Perfil da pessoa logada, usado pelo menu do topo, pela página da conta e pelo editor. */
export function ProfileProvider({ children }: { readonly children: ReactNode }) {
  const userId = useUserId()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<AccountStats | null>(null)

  useEffect(() => {
    let active = true
    fetchProfile(userId)
      .then((loaded) => {
        if (active) setProfile(loaded)
      })
      .catch((loadError: unknown) => {
        console.error('perfil', loadError)
        if (active) setError('Não deu para carregar seu perfil.')
      })
    return () => {
      active = false
    }
  }, [userId])

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchAccountStats())
    } catch (statsError) {
      console.error('números da conta', statsError)
    }
  }, [])

  const save = useCallback(
    async (update: ProfileUpdate) => {
      const saved = await updateProfile(userId, update)
      setProfile(saved)
      return saved
    },
    [userId],
  )

  return <ProfileContext.Provider value={{ profile, error, stats, refreshStats, save }}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileState {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfile fora do ProfileProvider')
  return context
}

/** Nome para mostrar: o nome escolhido ou, sem ele, o @. */
export function displayNameOf(profile: Profile | null): string {
  return profile?.display_name?.trim() || profile?.username || ''
}
