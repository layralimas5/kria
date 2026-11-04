# Vynkio OS: de ferramenta de criação a sistema que decide o conteúdo

**Criado em:** 04/11/2026
**Parte de:** `feat/vynkio-formatos` (tudo de `vynkio-evolucao.md`, `admin.md` e `formatos.md` já está aqui)
**Estado:** proposta de produto. Nada implementado ainda.

---

## 1. A virada

Hoje o Vynkio se apresenta como **"crie imagem e vídeo com IA"**. É o terreno de Higgsfield,
Arcads, Creatify e CapCut: concorrente com mais dinheiro, margem apertada (31 a 45% no pior
caso) e ferramenta que envelhece a cada modelo novo.

O Vynkio OS muda a promessa:

> **"O Vynkio sabe quem é a sua marca, diz o que postar e monta a semana com você."**

Gerar imagem e vídeo continua existindo, mas vira **recurso para quem quer**, não o produto.
O produto é a decisão e a rotina. É a mesma lógica do MazyOS (memória, ferramentas prontas e
rotina), entregue como app, sem instalar nada.

**Frase-mestra (a da Lay):** construir ficou fácil, decidir o que construir não. Aqui: criar
ficou fácil, decidir o que postar não.

### Para quem

| Público | O que compra |
|---|---|
| Criador e infoprodutor solo | "Não sei o que postar essa semana" resolvido toda segunda |
| Social media e agência pequena | Uma marca por cliente, cada uma com memória própria (plano Studio, até 10 marcas) |

---

## 2. O que já existe e só muda de lugar

| Lógica do MazyOS | No Vynkio hoje | O que muda |
|---|---|---|
| `empresa.md`, `preferencias.md` | Perfil completo da marca e marca ativa | Passa a ser preenchido por entrevista, não por formulário |
| Skills | Inteligência: ideias, roteiro, 9 tipos de copy, UGC, planejamento editorial | Vira o centro do produto |
| Calendário e pauta | Conteúdos com status, quadro e calendário | Recebe a semana pronta |
| Templates por nicho | Formatos (vídeos prontos por nicho) | Vira "receita" de conteúdo, não só de vídeo |
| Pastas de cliente | Marcas por plano (1/1/3/10) | Argumento de venda do Studio para agência |
| Aprender com o resultado | Resultados por CSV | Passa a alimentar as próximas sugestões |
| Criar | Studio, personagens, UGC | **Desce no menu.** Continua igual, só deixa de ser a porta de entrada |

---

## 3. O que é novo (a camada OS)

Em ordem de prioridade. Cada item fecha sozinho e pode ir ao ar sem o seguinte.

### 3.1 Onboarding em entrevista ("instalar a marca")

Troca a pergunta "qual seu objetivo?" por uma conversa de 6 a 8 perguntas que preenche o perfil
da marca: o que vende, para quem, como fala, o que nunca diria, onde posta, o que já deu certo,
meta do mês. No fim, a pessoa **vê o perfil montado e corrige**.

- Reaproveita `brands` (campos de perfil já existem) e a function `assistant` (saída estruturada).
- Custo: um pedido de texto por pergunta de aprofundamento. Grátis no primeiro uso.
- **Por que primeiro:** sem memória boa, todo o resto sai genérico.

### 3.2 Minha semana

Botão principal do Início. Gera, para a marca ativa: 3 a 5 pautas com o porquê de cada uma,
roteiro ou texto de cada, legenda e ganchos. Tudo cai em Conteúdos com status "ideia" e data
sugerida no calendário.

- Reaproveita o planejamento editorial (que já manda tudo para o calendário).
- O "porquê" é obrigatório: é o que separa decisão de gerador de texto.

### 3.3 Memória que aprende com a correção

Quando a pessoa edita um texto gerado ou descarta uma pauta, o Vynkio pergunta em uma linha:
"guardo isso como regra da marca?" (ex.: "não usar gíria", "sempre citar o preço").

- Nova coluna `brands.learned_rules` (lista curta, com teto de tamanho, editável pela pessoa).
- Entra no contexto de todo pedido daquela marca.
- **É o que faz o produto melhorar com o uso** e dificulta trocar por concorrente.

### 3.4 Resultado que vira próxima pauta

Com métricas importadas (CSV já existe), o Minha semana passa a dizer "esse formato teve o dobro
de salvamentos, repeti o ângulo". Regra que já está em `vynkio-evolucao.md`: separar fato,
inferência e hipótese, e nunca sugerir com base em palpite. Só entra quando houver dado.

### 3.5 Receitas por nicho

Os Formatos ganham versão de conteúdo inteiro: "semana de lançamento", "infoproduto em
escala", "comércio local", "perfil pessoal". Cada receita é dado (tabela), não código.

---

## 4. Menu e Início

| Hoje | Vynkio OS |
|---|---|
| Início com "O que vamos criar hoje?" e 8 ações de criação | Início com **"Sua semana"**: pautas da semana, o que falta aprovar, o que publica hoje |
| Criar vem logo depois do Início | Ordem: Início, Minha marca, Conteúdo, Inteligência, Resultados, Criar, Gerenciamento |
| Onboarding pergunta objetivo de criação | Onboarding é a entrevista da marca |

A pessoa que só quer gerar imagem continua achando Criar em um clique. Ela só deixa de ser o
centro.

---

## 5. Preço (a decidir)

Hoje o plano é vendido por créditos (300/450/1.000), o que amarra o valor ao custo do fal.

**Recomendação:** plano vendido pelo que o OS entrega (marcas, Minha semana, memória) com texto
incluído em uso justo, e **créditos só para imagem e vídeo**. Quem não gera mídia paga o plano e
custa pouco. Quem gera, compra ou consome crédito como hoje.

Antes de mudar: medir o custo real de texto por marca na primeira semana com usuários
(o Minha semana gera vários pedidos de uma vez) e só então fixar o limite de uso justo.

---

## 6. Ordem de execução

| Etapa | Entrega | Depende de |
|---|---|---|
| 0 | **Publicar o V1** (ordem em `vynkio-evolucao.md` seção 9 + deploy do front em vynkio-ia.com.br) | Chaves do fal, Asaas e Anthropic |
| 1 | Validar com 10 criadores/social medias: "o que trava mais, fazer o conteúdo ou saber o que fazer?" | Nada. Pode começar hoje |
| 2 | Onboarding em entrevista (3.1) | Resposta da etapa 1 apontando "saber o que fazer" |
| 3 | Minha semana + novo Início (3.2 e seção 4) | Etapa 2 |
| 4 | Memória por correção (3.3) | Etapa 3 |
| 5 | Landing reescrita com a promessa nova | Etapa 3 rodando com gente real (print real, sem depoimento inventado) |
| 6 | Resultados na pauta (3.4) e receitas (3.5) | Dados de uso |

**Se a etapa 1 responder "fazer o conteúdo":** o Vynkio OS não é a aposta. Reavaliar antes de
construir.

---

## 7. O que não entra

- Publicação automática nas redes (continua aguardando OAuth e aprovação de cada plataforma).
- Depoimento gerado por IA se passando por cliente, em qualquer formato.
- Promessa de resultado em dinheiro na landing antes de existir caso real medido.
