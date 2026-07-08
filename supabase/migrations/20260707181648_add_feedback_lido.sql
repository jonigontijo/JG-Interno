-- Adiciona controle de leitura para feedbacks de clientes (department = 'Feedback do Cliente')
-- na tabela internal_requests, usada pela nova aba "Feedbacks".
alter table internal_requests add column if not exists lido boolean not null default false;
alter table internal_requests add column if not exists lido_em timestamptz;
