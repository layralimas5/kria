// Respostas prontas do Vynkio AI no modo demo. Não chamam o Claude: servem para
// mostrar a tela e o fluxo ideia → roteiro → Studio. O título deixa claro que é exemplo.

import type { AssistantOutput, AssistantTool } from '@/domain/types'

const scene = (label: string, text: string, visual_prompt: string) => ({ label, text, visual_prompt })
const plain = (label: string, text: string) => ({ label, text, visual_prompt: '' })

export function demoAssistantOutput(tool: AssistantTool, brief: string, brandName: string | null): AssistantOutput {
  const brand = brandName ?? 'sua marca'
  const topic = brief.split('\n')[0]?.slice(0, 60) || 'o tema pedido'

  switch (tool) {
    case 'ideias':
      return {
        title: `Exemplo do demo: 6 ideias para ${brand}`,
        items: [
          plain('Rotina de 3 passos em 30 segundos', 'Reels. Gancho: "Minha rotina inteira cabe num café da manhã." Mostra que cuidar da pele não precisa de 10 produtos.'),
          plain('O que ninguém conta sobre vitamina C', 'Carrossel. Gancho: "Você pode estar usando na hora errada." Educa sem prometer resultado.'),
          plain('Antes do trabalho, no espelho do banheiro', 'Story. Bastidor real da rotina, com enquete: "Você passa protetor todo dia?"'),
          plain('Mito ou verdade', 'Reels. Três frases que o público já ouviu, respondidas em 5 segundos cada.'),
          plain('Pergunta da seguidora', 'Vídeo curto respondendo uma dúvida real que chegou no direct (use uma de verdade).'),
          plain('Como escolher o primeiro sérum', 'Carrossel. Checklist simples para quem nunca usou e tem medo de errar.'),
        ],
      }
    case 'roteiro':
      return {
        title: `Exemplo do demo: roteiro sobre ${topic}`,
        items: [
          scene('Cena 1, 0s a 3s', 'Fala: "Minha rotina de pele inteira cabe nesse copo de café." Na tela: "rotina de 3 passos".', 'mulher de 28 anos em frente ao espelho do banheiro segurando uma xícara de café, luz natural da manhã, enquadramento vertical de celular'),
          scene('Cena 2, 3s a 12s', 'Fala: "Primeiro, lavo o rosto com água fria. Depois, duas gotas de sérum."', 'close nas mãos aplicando duas gotas de sérum no rosto, bancada clara com plantas, luz suave'),
          scene('Cena 3, 12s a 22s', 'Fala: "Por último, hidratante e protetor. Pronto, saí de casa."', 'mulher sorrindo pegando a bolsa na porta de casa, manhã ensolarada, foto de celular'),
          scene('Cena 4, 22s a 30s', `CTA: "Quer saber qual sérum eu uso? Me chama no direct e eu te conto." Marca: ${brand}.`, 'frasco de sérum sobre a penteadeira com luz da janela, fundo desfocado'),
        ],
      }
    case 'copy':
      return {
        title: `Exemplo do demo: 3 legendas para ${brand}`,
        items: [
          plain('Dor', 'Sua pele não precisa de 10 passos. Precisa de constância.\n\nA rotina que eu uso cabe em 3 minutos antes do café. Quer o passo a passo? Comenta "rotina" que eu te mando.'),
          plain('Curiosidade', 'Você passa vitamina C de manhã ou à noite?\n\nTem diferença, e eu explico no carrossel. Salva para lembrar amanhã cedo.'),
          plain('Prova', 'Coloque aqui um depoimento real de cliente, com autorização dela.\n\nDepois: "É por mensagens assim que eu faço o que faço. Quer conhecer o sérum? O link está na bio."'),
        ],
      }
    case 'ugc-roteiro':
      return {
        title: `Exemplo do demo: UGC sobre ${topic}`,
        items: [
          scene('Cena 1, 0s a 4s', 'Fala: "Gente, eu precisava contar isso no carro mesmo."', 'mulher de 30 anos gravando selfie dentro do carro estacionado, luz do dia entrando pela janela, segurando um frasco de sérum'),
          scene('Cena 2, 4s a 15s', 'Fala: "Eu tinha desistido de skincare, achava tudo complicado. Aí uma amiga me falou desse sérum."', 'mesma mulher no banheiro de casa mostrando o frasco para a câmera, celular apoiado na pia, luz natural'),
          scene('Cena 3, 15s a 28s', 'Fala: "É só isso: duas gotas de manhã. Faz parte da minha rotina agora."', 'close do rosto aplicando o sérum, ângulo de selfie, fundo de azulejo claro'),
          scene('Cena 4, 28s a 35s', `Fala: "Se você também acha skincare difícil, dá uma olhada na ${brand}."`, 'mulher sorrindo para a câmera segurando o frasco perto do rosto, luz de janela'),
        ],
      }
  }
}
