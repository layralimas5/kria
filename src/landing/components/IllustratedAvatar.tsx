import type { AvatarPalette } from '../scenarios'

/** Retrato ilustrado de pessoa fictícia: silhueta estilizada, nunca rosto real. */
export function IllustratedAvatar({ background, skin, hair, shirt, longHair }: AvatarPalette) {
  return (
    <svg viewBox="0 0 80 80" className="size-9 shrink-0 rounded-full" aria-hidden="true">
      <rect width="80" height="80" fill={background} />
      {longHair && <path d="M22 40 C20 22 29 14 40 14 C51 14 60 22 58 40 L62 70 L18 70 Z" fill={hair} />}
      <path d="M12 80 C13 64 25 57 40 57 C55 57 67 64 68 80 Z" fill={shirt} />
      <rect x="35" y="44" width="10" height="15" rx="4" fill={skin} />
      <ellipse cx="40" cy="34" rx="14" ry="17" fill={skin} />
      <path d="M26 32 C25 22 32 17 40 17 C48 17 55 22 54 32 C51 25 46 22 40 22 C34 22 29 25 26 32 Z" fill={hair} />
    </svg>
  )
}
