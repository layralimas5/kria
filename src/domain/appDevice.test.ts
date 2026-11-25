import { describe, expect, it } from 'vitest'
import { detectPlatform, deviceLabel, pushAvailability, toggleTopic, type DeviceInfo } from './appDevice'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0'

const device = (overrides: Partial<DeviceInfo>): DeviceInfo => ({
  platform: 'android',
  standalone: false,
  pushApi: true,
  permission: 'default',
  ...overrides,
})

describe('detectPlatform', () => {
  it('reconhece iPhone, iPad disfarçado de Mac, Android e computador', () => {
    expect(detectPlatform(IPHONE, 5)).toBe('ios')
    expect(detectPlatform(IPAD, 5)).toBe('ios')
    expect(detectPlatform(IPAD, 0)).toBe('desktop')
    expect(detectPlatform(ANDROID, 5)).toBe('android')
    expect(detectPlatform(WINDOWS_EDGE, 0)).toBe('desktop')
  })
})

describe('pushAvailability', () => {
  it('iPhone só recebe com o app na tela de início', () => {
    expect(pushAvailability(device({ platform: 'ios', pushApi: false }), true)).toBe('needs-install')
    expect(pushAvailability(device({ platform: 'ios', standalone: true }), true)).toBe('ready')
  })

  it('cobre navegador sem push, build sem chave e bloqueio', () => {
    expect(pushAvailability(device({ pushApi: false }), true)).toBe('unsupported')
    expect(pushAvailability(device({}), false)).toBe('not-configured')
    expect(pushAvailability(device({ permission: 'denied' }), true)).toBe('denied')
    expect(pushAvailability(device({ permission: 'granted' }), true)).toBe('ready')
  })
})

it('deviceLabel não expõe versão', () => {
  expect(deviceLabel(IPHONE, 'ios')).toBe('iPhone')
  expect(deviceLabel(ANDROID, 'android')).toBe('Android · Chrome')
  expect(deviceLabel(WINDOWS_EDGE, 'desktop')).toBe('Windows · Edge')
})

it('toggleTopic preserva os outros tópicos', () => {
  expect(toggleTopic(['sales'], 'generations', true)).toEqual(['generations', 'sales'])
  expect(toggleTopic(['generations', 'sales'], 'sales', false)).toEqual(['generations'])
  expect(toggleTopic([], 'sales', false)).toEqual([])
})
