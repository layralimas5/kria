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
    case 'planejamento':
      return {
        title: `Exemplo do demo: 7 dias de posts para ${brand}`,
        items: [
          plain('Dia 1, Reels', 'Tema: rotina de 3 passos. Gancho: "Sua pele não precisa de 10 produtos." Objetivo: alcance.'),
          plain('Dia 2, Carrossel', 'Tema: vitamina C de manhã ou à noite. Gancho: "Você pode estar usando na hora errada." Objetivo: salvamentos.'),
          plain('Dia 3, Stories', 'Tema: bastidor da produção. Enquete: "Você passa protetor todo dia?" Objetivo: conversa.'),
          plain('Dia 4, Reels', 'Tema: mito ou verdade sobre sérum. Gancho: três frases em 5 segundos cada. Objetivo: alcance.'),
          plain('Dia 5, Carrossel', 'Tema: como escolher o primeiro sérum. Checklist simples. Objetivo: autoridade.'),
          plain('Dia 6, Reels', 'Tema: demonstração da textura. Gancho: "Olha como absorve." Objetivo: desejo pelo produto.'),
          plain('Dia 7, Post', 'Tema: oferta do kit da semana com CTA para o WhatsApp. Objetivo: vendas.'),
        ],
      }
    case 'ugc-roteiro':
      return {
        title: `Exemplo do demo: UGC sobre ${topic}`,
        items: [
          scene('Cena 1, 0s a 4s', 'Fala: "Skincare parece complicado? Te mostro o jeito mais simples em 30 segundos."', 'mulher de 30 anos gravando selfie no banheiro de casa, luz do dia entrando pela janela, segurando um frasco de sérum'),
          scene('Cena 2, 4s a 15s', 'Fala: "Esse é o sérum de vitamina C. Olha a textura: leve, absorve rápido."', 'close das mãos pingando o sérum no dorso da mão, celular apoiado na pia, luz natural'),
          scene('Cena 3, 15s a 28s', 'Fala: "O passo a passo é esse: duas gotas de manhã, depois hidratante e protetor."', 'close do rosto aplicando o sérum, ângulo de selfie, fundo de azulejo claro'),
          scene('Cena 4, 28s a 35s', `Fala: "Quer saber mais? O link da ${brand} está na bio." Em anúncio, identifique como publicidade e conteúdo gerado por IA.`, 'mulher sorrindo para a câmera segurando o frasco perto do rosto, luz de janela'),
        ],
      }
  }
}
