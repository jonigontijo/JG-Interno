# Integração JG Interno / Social Media

Banco e quatro Edge Functions publicados no projeto igmwcdeuqoudrwsmwgpl em 28/09/2026. Envios desativados e agendamentos pausados enquanto a outra equipe configura a chave compartilhada. A validação ponta a ponta ainda está pendente.

## Comportamento

A alteração de cliente, conclusão da tarefa 5 ou avanço do pipeline registra um evento durável na mesma transação do banco. Clientes que contratam social depois de entrar em Operação também são capturados. As quantidades são semanais. Alteração de plano, suspensão, reativação, retirada do serviço e exclusão geram versões ordenadas; exclusão preserva o histórico da integração. Cadastro incompleto aparece como pendência.

Clientes anteriores à migração exigem revisão de vínculo para evitar duplicação externa. Novos cadastros são liberados automaticamente. Confirmar que não existe só após verificar o outro sistema. A associação externa exige confirmação de ambos os IDs.

A fila só considera entregue após resposta autenticada por HTTPS com success=true, event_id correspondente e ambos os identificadores de cliente. O receptor externo deve manter idempotência pelo event_id, inclusive se uma confirmação se perder. Tentativas após 1min, 5min, 15min, 1h, 4h e 24h; depois permanece em atenção para reenvio administrativo. Uma versão pendente bloqueia as posteriores do mesmo cliente. Reservas abandonadas são recuperadas após 120s.

Publicações têm chave cliente+post_id e versão monotônica. Duplicatas são confirmadas sem nova contagem; conflito de conteúdo na mesma versão retorna erro. O prazo original permanece mesmo após reagendamento. Conteúdo em várias redes conta uma vez. Removidos/cancelados não entram no resumo. O painel mensal não converte a contratação semanal em cota mensal.

## Implantação e ativação

1. Revisar e aplicar as migrações 20260927000100, 00200 e 00300 no projeto correto, antes de publicar o frontend. A terceira adiciona a conclusão atômica dos grupos; o frontend depende dela.
2. Publicar jg-social-receive, jg-social-dispatch, jg-social-admin e jg-social-reconcile, com verify_jwt=false conforme config.toml. Cada endpoint faz sua própria autenticação: assinatura HMAC no recebimento, usuário administrador ativo ou segredo do agendador nas operações internas.
3. Configurar no servidor JG_INTERNO_WEBHOOK_SECRET (compartilhado com a outra equipe, aleatório, 32+ caracteres), JG_SOCIAL_CRON_SECRET (outro segredo aleatório), JG_SOCIAL_BASE_URL=https://jgsocialmedia.lovable.app e JG_SOCIAL_ENABLED=false. Nunca usar VITE_ para segredos.
4. Informar à outra equipe o receptor https://igmwcdeuqoudrwsmwgpl.supabase.co/functions/v1/jg-social-receive. Confirmar assinatura SHA256 de timestamp ISO + ponto + corpo JSON original, cabeçalhos X-JG-Timestamp, X-JG-Signature e X-JG-Event-ID. Janela de 5 minutos. Em GET a implementação assina corpo vazio; confirmar isso explicitamente.
5. Criar no Vault jg_social_project_url com a URL do Supabase e jg_social_cron_secret igual ao segredo do agendador. Executar scripts/social-schedule.sql: instala os dois agendamentos PAUSADOS. O padrão segue https://supabase.com/docs/guides/functions/schedule-functions.
6. Em ambiente de teste dos dois lados, ligar JG_SOCIAL_ENABLED e validar os cenários abaixo. Revisar os clientes legados antes de liberar sua fila. Somente depois habilitar os dois jobs no Cron e publicar o frontend. Em produção o mesmo segredo compartilhado precisa estar configurado nos dois sistemas.

## Aceitação com o sistema externo (pendente)

- Novo cliente sem social: nenhum envio. Com social: exatamente uma ativação ao concluir grupos.
- Cliente antigo em Operação contrata social: ativação; alterar quantidade: plano atualizado; suspender/reativar/remover: eventos correspondentes.
- Confirmar response.client.social_media_client_id e response.client.jg_interno_client_id tanto na entrega quanto no link-client. A confirmação de duplicata também precisa retornar o vínculo.
- Derrubar receptor, restaurar e verificar reenvio da MESMA identidade sem duplicar cliente; simular perda de confirmação. Falha após última tentativa deve permanecer visível.
- Enviar publicação, duplicata, versão antiga, reagendamento, publicação atrasada e tombstone completo. Conferir status, prazo original e contagem única entre redes.
- Omitir webhook e recuperar via reconcile paginado; conferir desde checkpoint com margem de 5min. Falha parcial não avança checkpoint. Cada execução tenta os 5 clientes menos recentemente tentados, evitando que um cliente com erro bloqueie todos os demais.
- Reconcile exige dados iguais ao webhook para a mesma versão e tombstones para exclusões. Limite operacional de 20 páginas por cliente: exceder gera falha visível, não conclusão falsa. Aumentar somente com prova do tempo de execução.
- Conferir permissões com administrador, usuário social e usuário sem acesso. Conferir pg_net HTTP e não apenas resultado SQL do Cron.

## Operação e pausa

Configurações mostra pendências de associação, últimos 200 envios e últimas 100 conferências. Detalhe do cliente mostra entregas externas e datas de atualização. Sem recebimento não significa ausência de postagem. A equipe precisa acompanhar pendências; não há promessa de entrega enquanto o destino estiver indisponível.

Pausar JG_SOCIAL_ENABLED e os dois jobs interrompe novos envios; eventos ficam preservados. O receptor pode continuar recebendo eventos assinados. Não apagar outbox/inbox ou recriar IDs para tentar novamente. Reenvio administrativo preserva evento e payload. Migrações são aditivas; para rollback do frontend mantenha tabelas e dados de auditoria.

## Verificação local

npm ci; npm test; npm run build; npm run test:social-db.
Deno: deno check supabase/functions/jg-social-{receive,dispatch,admin,reconcile}/index.ts (expandir os caminhos no PowerShell).
O teste PostgreSQL usa PGlite descartável e nunca conecta ao banco real. Não substitui teste de Cron/pg_net, concorrência real nem a homologação externa. A checagem TypeScript global já apresenta erros anteriores em DashboardSM e PostagensPlanilha, fora desta alteração.

## Verificacoes da publicacao de 28/09/2026

- Tres migracoes aplicadas atomicamente e registradas no historico.
- Quatro funcoes publicadas e testadas via HTTPS: acesso anonimo rejeitado, assinatura invalida rejeitada, assinatura correta aceita e cliente desconhecido rejeitado sem gravacao.
- Dispatch e reconcile autenticados confirmaram enabled=false.
- Chaves geradas em arquivo local ignorado pelo Git e configuradas no servidor; cron utiliza Vault. A chave compartilhada ainda precisa ser configurada no Social Media.
- 46 verificacoes PostgreSQL e 6 testes Vitest passaram; compilacao Vite passou.
- Revisar vinculos dos clientes existentes antes de liberar a fila; nao aprovar automaticamente.
