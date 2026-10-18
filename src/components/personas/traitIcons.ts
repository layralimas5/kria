import {
  Briefcase,
  Cake,
  ChefHat,
  Coffee,
  Dumbbell,
  Eye,
  Gamepad2,
  Gem,
  Globe,
  Laptop,
  MapPin,
  PaintBucket,
  Palette,
  PersonStanding,
  Plane,
  Scissors,
  Shirt,
  Smile,
  Sparkle,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { TraitGroupId } from '@/domain/personaTraits'

export const GROUP_ICONS: Record<TraitGroupId, LucideIcon> = {
  niche: Sparkles,
  gender: UsersRound,
  age: Cake,
  ethnicity: Globe,
  skin: Palette,
  build: PersonStanding,
  hairstyle: Scissors,
  hairColor: PaintBucket,
  eyeColor: Eye,
  outfit: Shirt,
  features: Sparkle,
  expression: Smile,
  setting: MapPin,
}

/** Ícone de cada nicho, nos cards grandes do primeiro grupo. */
export const NICHE_ICONS: Record<string, LucideIcon> = {
  lifestyle: Coffee,
  fitness: Dumbbell,
  moda: Shirt,
  beleza: Gem,
  tech: Laptop,
  games: Gamepad2,
  viagem: Plane,
  gastronomia: ChefHat,
  negocios: Briefcase,
}
