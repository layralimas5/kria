import { describe, expect, it } from 'vitest'
import { buildProviderInput, checkPrompt, extractOutput, storagePathFor, type ModelRow } from './generation.ts'
import { signGenerationId, verifyGenerationId } from './signature.ts'

const model = (overrides: Partial<ModelRow> = {}): ModelRow => ({
  slug: 'foto',
  name: 'Foto',
  kind: 'image',
  endpoint: 'fal-ai/nano-banana-2',
  image_input: null,
  requires_image: false,
  credits: 5,
  defaults: { num_images: 1 },
  ...overrides,
})

describe('buildProviderInput', () => {
  it('junta defaults e prompt', () => {
    expect(buildProviderInput(model(), 'um café', null)).toEqual({ num_images: 1, prompt: 'um café' })
  })

  it('manda a imagem como lista quando o modelo pede image_urls', () => {
    const input = buildProviderInput(model({ image_input: 'image_urls' }), 'na praia', 'https://x/a.png')
    expect(input.image_urls).toEqual(['https://x/a.png'])
  })

  it('manda a imagem no campo do modelo de vídeo', () => {
    const input = buildProviderInput(model({ kind: 'video', image_input: 'start_image_url' }), 'sorri', 'https://x/a.png')
    expect(input.start_image_url).toBe('https://x/a.png')
  })

  it('o prompt do usuário vence um prompt nos defaults', () => {
    expect(buildProviderInput(model({ defaults: { prompt: 'x' } }), 'meu', null).prompt).toBe('meu')
  })
})

describe('extractOutput', () => {
  it('lê a primeira imagem', () => {
    const result = { images: [{ url: 'https://v3.fal.media/a.jpeg', content_type: 'image/jpeg' }] }
    expect(extractOutput(result, 'image')).toEqual({ url: 'https://v3.fal.media/a.jpeg', contentType: 'image/jpeg' })
  })

  it('lê o vídeo e deduz o tipo pela extensão', () => {
    expect(extractOutput({ video: { url: 'https://v3.fal.media/b.mp4' } }, 'video')?.contentType).toBe('video/mp4')
  })

  it('recusa saída vazia ou URL sem https', () => {
    expect(extractOutput({ images: [] }, 'image')).toBeNull()
    expect(extractOutput({ video: { url: 'http://x/b.mp4' } }, 'video')).toBeNull()
    expect(extractOutput(null, 'image')).toBeNull()
  })

  it('ignora content_type desconhecido', () => {
    const result = { images: [{ url: 'https://x/a.webp', content_type: 'text/html' }] }
    expect(extractOutput(result, 'image')?.contentType).toBe('image/webp')
  })
})

describe('storagePathFor', () => {
  it('guarda na pasta da pessoa', () => {
    expect(storagePathFor('u1', 'g1', 'video/mp4')).toBe('u1/g1.mp4')
  })
})

describe('checkPrompt', () => {
  it('deixa passar prompt comum', () => {
    expect(checkPrompt('Mulher de 30 anos tomando café numa varanda, luz de fim de tarde').ok).toBe(true)
  })

  it.each(['foto dela pelada', 'uma criança brincando', 'rosto da famosa atriz', 'deepfake do presidente'])(
    'bloqueia "%s"',
    (prompt) => {
      expect(checkPrompt(prompt).ok).toBe(false)
    },
  )
})

describe('assinatura do webhook', () => {
  const secret = 'x'.repeat(40)

  it('aceita o token certo e recusa o de outra geração', async () => {
    const token = await signGenerationId(secret, 'g1')
    expect(await verifyGenerationId(secret, 'g1', token)).toBe(true)
    expect(await verifyGenerationId(secret, 'g2', token)).toBe(false)
  })

  it('recusa segredo curto', async () => {
    await expect(signGenerationId('curto', 'g1')).rejects.toThrow()
  })
})
