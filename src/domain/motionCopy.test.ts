import { describe, expect, it } from 'vitest'
import { checkMotionFile, maxMotionSeconds, motionModels, motionTierFor } from './motionCopy'
import type { Model } from './types'

const model = (slug: string, overrides: Partial<Model> = {}): Model => ({
  slug,
  name: slug,
  description: '',
  kind: 'video',
  requires_image: true,
  credits: 100,
  position: 0,
  badge: null,
  defaults: {},
  options: {},
  allowed_plans: null,
  studio: false,
  video_input: null,
  max_input_seconds: null,
  ...overrides,
})

const catalog = [
  model('video-kling', { studio: true }),
  model('motion-10', { video_input: 'video_url', max_input_seconds: 10, credits: 812 }),
  model('motion-5', { video_input: 'video_url', max_input_seconds: 5, credits: 406 }),
]

describe('checkMotionFile', () => {
  it('aceita MP4 e MOV até 50 MB', () => {
    expect(checkMotionFile({ type: 'video/mp4', size: 1000 })).toEqual({ ok: true, extension: 'mp4' })
    expect(checkMotionFile({ type: 'video/quicktime', size: 1000 })).toEqual({ ok: true, extension: 'mov' })
  })

  it('recusa outro formato e arquivo grande', () => {
    expect(checkMotionFile({ type: 'video/webm', size: 1000 })).toMatchObject({ ok: false })
    expect(checkMotionFile({ type: 'video/mp4', size: 60 * 1024 * 1024 })).toEqual({ ok: false, reason: 'O vídeo pode ter até 50 MB.' })
  })
})

describe('níveis', () => {
  it('só os modelos com vídeo, do mais curto ao mais longo', () => {
    expect(motionModels(catalog).map((item) => item.slug)).toEqual(['motion-5', 'motion-10'])
    expect(maxMotionSeconds(catalog)).toBe(10)
    expect(maxMotionSeconds([catalog[0]!])).toBeNull()
  })

  it('escolhe o menor nível que cobre a duração', () => {
    expect(motionTierFor(catalog, 3.2)?.slug).toBe('motion-5')
    expect(motionTierFor(catalog, 5.1)?.slug).toBe('motion-5')
    expect(motionTierFor(catalog, 7)?.slug).toBe('motion-10')
    expect(motionTierFor(catalog, 11)).toBeNull()
  })
})
