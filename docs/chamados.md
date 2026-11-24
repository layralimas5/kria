# Chamados de suporte (0042)

Pedido da Lay em 24/11/2026: além do contato do plano (e-mail ou WhatsApp), a pessoa abre um chamado
dentro do app e a operação atende pelo admin, no estilo GLPI (como no sistema do Jota).

## Onde fica

- **Usuário:** `/suporte`, aba **Chamados** (`?aba=chamados`). Lista os chamados dela, abre chamado novo
  (assunto, título e relato) e mostra a conversa (`?chamado=<id>`). Responder reabre o chamado; "Já resolveu"
  encerra. Vale para todo plano, inclusive o Grátis.
- **Admin:** `/admin/chamados` (menu Operação > Chamados). Indicadores por situação, busca (número, título,
  e-mail, nome), filtro de situação e prioridade, fila ordenada (não lidos, depois prioridade, depois quem espera
  há mais tempo) e o chamado aberto ao lado com situação, prioridade, resposta e **nota interna**.
  O número ao lado de "Chamados" no menu = novos + com mensagem não lida (atualiza a cada minuto).

## Regras (no banco)

- Tabelas `support_tickets` e `support_messages` fechadas: tudo passa por funções `security definer`.
- Pessoa: `open_support_ticket`, `my_support_tickets`, `my_support_ticket`, `reply_support_ticket`,
  `resolve_my_support_ticket`. Só enxerga os próprios chamados e nunca recebe nota interna.
- Admin: `admin_support_tickets`, `admin_support_attention`, `admin_support_ticket`, `admin_reply_support_ticket`,
  `admin_update_support_ticket`. Permissões novas `support.view` e `support.manage` (super_admin, admin e o papel
  support). Resposta, nota e mudança de situação vão para `admin_audit_logs`.
- Situações: Novo (`open`), Em atendimento, Aguardando usuário (padrão depois de responder), Resolvido.
- Plano com suporte prioritário (`whatsapp_priority`) abre em prioridade Alta; os demais em Normal.
- Freio: até 5 chamados abertos ao mesmo tempo e 10 por dia por conta.

## Ainda não tem

- Anexo (print ou vídeo). Se precisar, o caminho é o do Jota: bucket privado `support` + URL assinada.
- Aviso por e-mail quando a equipe responde (hoje a pessoa vê o ponto de "resposta nova" na aba).
