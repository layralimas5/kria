-- Motivos novos do extrato para os créditos de assinatura. Ficam numa
-- migration separada porque um valor novo de enum só pode ser usado depois
-- que a transação que o criou termina (a 0004 já usa estes dois).

alter type public.ledger_reason add value if not exists 'subscription_grant';
alter type public.ledger_reason add value if not exists 'subscription_expire';
