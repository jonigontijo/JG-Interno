// Onboarding pipeline: sequential tasks auto-created when a new client is registered.
// Each step unlocks only after the previous one is completed.

export interface PipelineStep {
  id: string;
  order: number;
  title: string;
  description: string;
  /** Role-based auto-assignment: matches TeamMember.roles or role */
  assignRole: string;
  /** Roles allowed to complete this step */
  allowedRoles: string[];
  /** Module the task belongs to */
  module: string;
  /** Estimated hours */
  estimatedHours: number;
  /** Days from client creation to deadline */
  deadlineDays: number;
  /** Client status while this step is active */
  clientStatus: string;
}

export const ONBOARDING_PIPELINE: PipelineStep[] = [
  {
    id: "pipe-1",
    order: 1,
    title: "Envio do contrato",
    description: "Preparar e enviar contrato para o cliente",
    assignRole: "Financeiro",
    allowedRoles: ["Financeiro", "Diretoria"],
    module: "Financeiro",
    estimatedHours: 2,
    deadlineDays: 1,
    clientStatus: "Financeiro",
  },
  {
    id: "pipe-2",
    order: 2,
    title: "Assinatura do contrato",
    description: "Acompanhar e confirmar assinatura do contrato pelo cliente",
    assignRole: "Financeiro",
    allowedRoles: ["Financeiro", "Diretoria"],
    module: "Financeiro",
    estimatedHours: 1,
    deadlineDays: 2,
    clientStatus: "Financeiro",
  },
  {
    id: "pipe-3",
    order: 3,
    title: "Confirmar pagamento do cliente",
    description: "Verificar se o pagamento do setup/primeira mensalidade foi recebido",
    assignRole: "Financeiro",
    allowedRoles: ["Financeiro", "Diretoria"],
    module: "Financeiro",
    estimatedHours: 0.5,
    deadlineDays: 3,
    clientStatus: "Financeiro",
  },
  {
    id: "pipe-4",
    order: 4,
    title: "Emitir Nota Fiscal (NF)",
    description: "Emitir NF referente ao pagamento recebido",
    assignRole: "Financeiro",
    allowedRoles: ["Financeiro", "Diretoria"],
    module: "Financeiro",
    estimatedHours: 1,
    deadlineDays: 4,
    clientStatus: "Financeiro",
  },
  {
    id: "pipe-5",
    order: 5,
    title: "Criar grupos do cliente",
    description: "Criar grupo de WhatsApp e demais grupos de comunicação do cliente",
    assignRole: "Financeiro",
    allowedRoles: ["Financeiro", "Diretoria"],
    module: "Financeiro",
    estimatedHours: 0.5,
    deadlineDays: 4,
    clientStatus: "Financeiro",
  },
  {
    id: "pipe-6",
    order: 6,
    title: "Kickoff - Reunião de alinhamento",
    description: "Agendar e realizar reunião de kickoff com o cliente",
    assignRole: "Gerente Operacional",
    allowedRoles: ["Financeiro", "Gerente Operacional", "Diretoria"],
    module: "Onboarding",
    estimatedHours: 2,
    deadlineDays: 5,
    clientStatus: "Onboarding",
  },
  {
    id: "pipe-7",
    order: 7,
    title: "Coletar acessos e briefing",
    description: "Obter todos os acessos (Meta, Google, Site, CRM) e preencher briefing",
    assignRole: "Gerente Operacional",
    allowedRoles: ["Gerente Operacional", "Diretoria"],
    module: "Onboarding",
    estimatedHours: 3,
    deadlineDays: 7,
    clientStatus: "Onboarding",
  },
  {
    id: "pipe-8",
    order: 8,
    title: "Configurar conta de anúncios",
    description: "Criar BM, configurar pixel, GTM e contas de anúncio",
    assignRole: "Gestor de Tráfego",
    allowedRoles: ["Gestor de Tráfego", "Gerente Operacional", "Diretoria"],
    module: "Tráfego",
    estimatedHours: 3,
    deadlineDays: 8,
    clientStatus: "Onboarding",
  },
  {
    id: "pipe-9",
    order: 9,
    title: "Criar briefing criativo inicial",
    description: "Desenvolver briefing para primeiras peças e criativos",
    assignRole: "Social Media - Coordenação",
    allowedRoles: ["Social Media - Coordenação", "Social Media - Designer", "Gerente Operacional", "Diretoria"],
    module: "Social Media",
    estimatedHours: 2,
    deadlineDays: 9,
    clientStatus: "Onboarding",
  },
  {
    id: "pipe-10",
    order: 10,
    title: "Produzir primeiros criativos",
    description: "Criar as primeiras artes/vídeos para campanhas e redes sociais",
    assignRole: "Social Media - Designer",
    allowedRoles: ["Social Media - Designer", "Social Media - Videomaker", "Social Media - Editor", "Social Media - Coordenação", "Gerente Operacional", "Diretoria"],
    module: "Produção",
    estimatedHours: 4,
    deadlineDays: 11,
    clientStatus: "Onboarding",
  },
  {
    id: "pipe-11",
    order: 11,
    title: "Lançar primeiras campanhas",
    description: "Subir e ativar as primeiras campanhas de tráfego pago",
    assignRole: "Gestor de Tráfego",
    allowedRoles: ["Gestor de Tráfego", "Gerente Operacional", "Diretoria"],
    module: "Tráfego",
    estimatedHours: 3,
    deadlineDays: 12,
    clientStatus: "Onboarding",
  },
  {
    id: "pipe-12",
    order: 12,
    title: "Primeiro relatório e passagem para operação",
    description: "Entregar primeiro relatório ao cliente e passar para fluxo normal de operação",
    assignRole: "Gerente Operacional",
    allowedRoles: ["Gerente Operacional", "Diretoria"],
    module: "Geral",
    estimatedHours: 2,
    deadlineDays: 16,
    clientStatus: "Operação",
  },
];
