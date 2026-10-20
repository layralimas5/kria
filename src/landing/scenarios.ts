import type { ChatMessage } from './testimonials'

export interface AvatarPalette {
  readonly background: string
  readonly skin: string
  readonly hair: string
  readonly shirt: string
  readonly longHair: boolean
}

export interface Scenario {
  readonly id: string
  readonly author: string
  readonly avatar: AvatarPalette
  readonly messages: readonly ChatMessage[]
}

// Conversas ilustrativas com pessoas fictícias, mostradas com o selo "Exemplo ilustrativo"
// enquanto não há depoimento real em testimonials.json. Nada de número de venda ou de
// seguidor: o exemplo mostra como se usa, não promete resultado.
export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'afiliada',
    author: 'Camila · afiliada',
    avatar: { background: '#f2a7c3', skin: '#d79f7e', hair: '#1f1512', shirt: '#f7f1e8', longHair: true },
    messages: [
      { from: 'cliente', time: '19:12', text: 'Gente, fiz o vídeo do sérum sem nem ter o produto em casa 😅' },
      { from: 'cliente', time: '19:12', text: 'Escrevi em português mesmo, escolhi o Veo e saiu com fala e tudo' },
      { from: 'kria', time: '19:15', text: 'Que bom, Camila! Dá pra usar a mesma persona nos próximos vídeos, aí fica sempre o mesmo rosto no perfil' },
      { from: 'cliente', time: '19:16', text: 'Perfeito, já vou montar a semana inteira' },
    ],
  },
  {
    id: 'padaria',
    author: 'Seu Antônio · padaria',
    avatar: { background: '#e9d79a', skin: '#f0c7a7', hair: '#9a9a9a', shirt: '#8c3b2f', longHair: false },
    messages: [
      { from: 'cliente', time: '07:40', text: 'Bom dia. Pedi uma foto do pão de queijo saindo do forno e ficou bonita demais' },
      { from: 'cliente', time: '07:41', text: 'Meu neto que mexia nisso, agora eu faço sozinho' },
      { from: 'kria', time: '07:44', text: 'Bom dia, Seu Antônio! Se quiser, transforma essa foto num vídeo curto pro anúncio, é só escolher o Kling' },
      { from: 'cliente', time: '07:45', text: 'Vou testar hoje no story' },
    ],
  },
  {
    id: 'perfil-ia',
    author: 'Rafa · perfil de IA',
    avatar: { background: '#b9b4f2', skin: '#a86f50', hair: '#120c0a', shirt: '#e86f4c', longHair: false },
    messages: [
      { from: 'cliente', time: '22:03', text: 'Criei a Luna, minha influenciadora virtual' },
      { from: 'cliente', time: '22:03', text: 'Coloquei ela na praia, no café e na academia e é a mesma pessoa em todas' },
      { from: 'kria', time: '22:06', text: 'Ficou incrível! Lembra de marcar como conteúdo gerado por IA quando a rede pedir' },
      { from: 'cliente', time: '22:07', text: 'Pode deixar 🙌' },
    ],
  },
]
