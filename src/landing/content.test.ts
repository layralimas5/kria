import { describe, expect, it } from 'vitest'
import { AVATARS, avatar, toClip } from './content'

const SPEC = { id: 'teste', title: 'Teste', image: 'foto', motion: 'mexe', placeholder: 'silk' }

describe('toClip', () => {
  it('usa o vídeo provisório enquanto o avatar não foi gerado', () => {
    const clip = toClip(SPEC, undefined)
    expect(clip).toMatchObject({ src: '/landing/silk.webm', poster: '/landing/silk.jpg', generated: false })
  })

  it('troca pelo vídeo gerado quando ele existe no manifesto', () => {
    const clip = toClip(SPEC, { video: '/landing/avatars/teste.mp4', poster: '/landing/avatars/teste.jpg' })
    expect(clip).toMatchObject({ src: '/landing/avatars/teste.mp4', generated: true })
  })

  it('recusa placeholder que não existe', () => {
    expect(() => toClip({ ...SPEC, placeholder: 'praia' }, undefined)).toThrow()
  })
})

describe('avatar', () => {
  it('encontra todos os avatares de avatars.json pelo id', () => {
    for (const clip of AVATARS) expect(avatar(clip.id)).toBe(clip)
  })

  it('falha alto com id desconhecido', () => {
    expect(() => avatar('nao-existe')).toThrow()
  })
})
