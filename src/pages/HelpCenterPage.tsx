import { useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuthStore } from "@/store/useAuthStore";
import {
  BookOpen, Megaphone, Briefcase, Palette, Monitor, Rocket,
  DollarSign, Users, CheckCircle, Send, Wrench, RefreshCw,
  ChevronDown, ChevronRight, Play, Star, Shield, Phone,
  HelpCircle, Zap, BarChart3, ClipboardList
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: string[];
  tips?: string[];
  icon: React.ElementType;
  module: string;
  category: "getting-started" | "daily" | "advanced";
  roles?: string[]; // if empty, visible to all with module access
}

const tutorials: Tutorial[] = [
  // === GETTING STARTED ===
  {
    id: "gs-1", title: "Primeiros Passos no Sistema", icon: BookOpen, module: "dashboard", category: "getting-started",
    description: "Aprenda a navegar pelo sistema e entender as principais funcionalidades.",
    steps: [
      "Faça login com seu usuário e senha fornecidos pelo administrador",
      "O Dashboard principal mostra um resumo geral: tarefas pendentes, alertas e métricas",
      "Use o menu lateral para navegar entre os módulos disponíveis para você",
      "Clique no seu nome no canto inferior esquerdo para ver seu perfil ou sair"
    ],
    tips: ["Cada colaborador vê apenas os módulos autorizados pelo administrador", "Em caso de dúvida, clique no ícone '?' no menu para voltar aqui"]
  },
  {
    id: "gs-2", title: "Entendendo Suas Tarefas", icon: ClipboardList, module: "tasks", category: "getting-started",
    description: "Como visualizar, filtrar e gerenciar suas tarefas diárias.",
    steps: [
      "Acesse 'Tarefas' no menu lateral para ver todas as suas atribuições",
      "Use a aba 'Minhas Tarefas' para ver apenas o que está atribuído a você",
      "A aba 'Tarefas Gerais' mostra tarefas da equipe dos seus clientes",
      "Cada tarefa mostra: cliente, prazo, urgência e status atual",
      "Clique no botão ▶️ para iniciar uma tarefa e ⏹ para finalizá-la"
    ],
    tips: ["Tarefas com urgência 'Crítica' aparecem em vermelho e devem ser priorizadas", "Use 'Pedir Ajuda' se não conseguir completar uma tarefa no prazo"]
  },

  // === TRÁFEGO PAGO ===
  {
    id: "tr-1", title: "Página de Tráfego Pago", icon: Megaphone, module: "traffic", category: "daily",
    description: "Como usar a página de Tráfego Pago para gerenciar campanhas.",
    steps: [
      "Acesse 'Tráfego Pago' no menu Operação",
      "A aba 'Minhas Tarefas' mostra suas demandas de tráfego (otimizações, setups, campanhas)",
      "A aba 'Tarefas Gerais' mostra tarefas dos seus colegas nos mesmos clientes",
      "Clique em '+ Nova Tarefa' para criar uma demanda manual",
      "Use o ícone 🗑️ para excluir demandas incorretas ou duplicadas"
    ],
    tips: ["As demandas recorrentes são geradas automaticamente pelo gerente ao 'Espalhar Demandas'", "Tipos disponíveis: Otimização, Setup, Campanha, Criativo, Relatório, Ajuste"]
  },
  {
    id: "tr-2", title: "Pedir Ajuda e Escalação", icon: HelpCircle, module: "traffic", category: "daily",
    description: "O que fazer quando não consegue completar uma demanda no prazo.",
    steps: [
      "Na sua tarefa, clique no ícone '🤝 Pedir Ajuda'",
      "O sistema transfere automaticamente a tarefa para o Reserva do mesmo cargo",
      "O Reserva recebe a tarefa como 'Pendente' e deve clicar em 'Iniciar'",
      "Se o Reserva também não conseguir, ele pode escalar clicando no ícone '⚠️'",
      "A escalação envia a tarefa ao Gerente Operacional com urgência 'Crítica'"
    ],
    tips: ["Só peça ajuda quando realmente precisar — a tarefa sai de você", "O gerente será notificado de tarefas escaladas no Dashboard Ops"]
  },

  // === SOCIAL MEDIA ===
  {
    id: "sm-1", title: "Fluxo de Social Media", icon: Briefcase, module: "social", category: "daily",
    description: "Pipeline de produção de conteúdo: do roteiro à publicação.",
    steps: [
      "Acesse 'Social Media' no menu Operação",
      "O pipeline segue a ordem: Roteiro → Gravação → Edição (72h) → Aprovação → Publicação",
      "Designers recebem demandas de artes e carrosséis",
      "Videomakers recebem roteiros e devem entregar gravações prontas",
      "Editores recebem o material bruto e têm 72h para edição final"
    ],
    tips: ["Mantenha o calendário de gravações atualizado na página do cliente", "Posts prontos aparecem no Dashboard como 'Posts Prontos Esta Semana'"]
  },
  {
    id: "sm-2", title: "Criação de Artes e Design", icon: Palette, module: "social", category: "daily",
    description: "Como designers devem gerenciar suas demandas de criação.",
    roles: ["Social Media - Designer"],
    steps: [
      "Suas demandas aparecem automaticamente em 'Minhas Tarefas'",
      "Cada demanda indica: cliente, tipo (Arte, Carrossel, Story) e prazo",
      "Clique em ▶️ para iniciar e o timer começa a contar",
      "Ao finalizar, a tarefa vai para aprovação do coordenador",
      "Retrabalhos são marcados automaticamente e impactam suas métricas"
    ],
    tips: ["Sempre verifique o briefing e a identidade visual do cliente antes de começar", "Use a aba 'Tarefas Gerais' para ver o que colegas estão fazendo no mesmo cliente"]
  },

  // === PRODUÇÃO ===
  {
    id: "pd-1", title: "Gestão de Produção", icon: Palette, module: "production", category: "daily",
    description: "Como acompanhar e gerenciar tarefas de produção audiovisual.",
    steps: [
      "Acesse 'Produção' no menu Operação",
      "Visualize todas as gravações e edições pendentes",
      "Use 'Minhas Tarefas' para focar nas suas entregas",
      "Clique em ▶️ para iniciar o trabalho em uma edição",
      "Ao concluir, finalize a tarefa para ela ir para revisão"
    ]
  },

  // === TECH / SITES ===
  {
    id: "tc-1", title: "Demandas de Tecnologia", icon: Monitor, module: "tech", category: "daily",
    description: "Como receber e executar demandas de sites e tecnologia.",
    steps: [
      "Acesse 'Tech / Sites' no menu Operação",
      "Demandas incluem: criação de sites, landing pages, manutenção e integrações",
      "Use o filtro por status para priorizar tarefas urgentes",
      "Registre horas trabalhadas ao finalizar cada tarefa",
      "Demandas de clientes novos vêm do Onboarding automaticamente"
    ]
  },

  // === ONBOARDING ===
  {
    id: "ob-1", title: "Pipeline de Onboarding", icon: Rocket, module: "onboarding", category: "daily",
    description: "Como acompanhar a integração de novos clientes.",
    steps: [
      "Acesse 'Onboarding' no menu Operação",
      "Cada cliente novo passa por etapas: Briefing → Acessos → Setup → Primeira Entrega",
      "Complete cada etapa na ordem — o sistema rastreia o progresso",
      "O checklist de acessos deve ser preenchido com dados de login do cliente",
      "Ao concluir todas as etapas, o cliente é movido automaticamente para 'Operação'"
    ]
  },

  // === INSIDE SALES ===
  {
    id: "is-1", title: "Inside Sales - Prospecção Ativa", icon: Phone, module: "inside-sales", category: "daily",
    description: "Como gerenciar leads e agendar reuniões de vendas.",
    steps: [
      "Acesse 'Inside Sales' no menu Operação",
      "Visualize seus leads ativos e próximos follow-ups",
      "Registre cada contato realizado com notas e próximos passos",
      "Agende reuniões de apresentação diretamente no sistema",
      "Leads convertidos são encaminhados para Propostas"
    ]
  },

  // === FINANCEIRO ===
  {
    id: "fi-1", title: "Controle Financeiro", icon: DollarSign, module: "financial", category: "daily",
    description: "Como acompanhar pagamentos, inadimplências e faturamento.",
    roles: ["Financeiro", "Diretoria"],
    steps: [
      "Acesse 'Financeiro' no menu Comercial",
      "Visualize o status de pagamento de cada cliente",
      "Clientes inadimplentes aparecem destacados em vermelho",
      "Use os filtros para ver pagos, pendentes ou vencidos",
      "Marque pagamentos como recebidos clicando no status"
    ]
  },

  // === CLIENTES ===
  {
    id: "cl-1", title: "Gestão de Clientes", icon: Users, module: "clients", category: "daily",
    description: "Como acessar detalhes, equipe e demandas de cada cliente.",
    steps: [
      "Acesse 'Clientes' no menu Principal",
      "Clique em um cliente para ver seus detalhes completos",
      "Na aba 'Equipe', veja quem está atribuído e com qual designação (Titular/Reserva)",
      "Na aba 'Demandas', veja todas as tarefas ativas do cliente",
      "Use 'Espalhar Demandas' para gerar tarefas automáticas baseadas na equipe e serviços"
    ],
    tips: ["Apenas Admin e Gerente Operacional podem Espalhar Demandas", "O badge vermelho no menu indica clientes sem equipe completa"]
  },

  // === APROVAÇÕES ===
  {
    id: "ap-1", title: "Aprovações e Revisões", icon: CheckCircle, module: "approvals", category: "daily",
    description: "Como aprovar ou solicitar retrabalho em entregas.",
    steps: [
      "Acesse 'Aprovações' no menu Gestão",
      "Visualize todas as tarefas aguardando sua aprovação",
      "Clique em 'Aprovar' para aceitar a entrega",
      "Clique em 'Retrabalho' para devolver ao responsável com observações",
      "Tarefas aprovadas são automaticamente finalizadas"
    ]
  },

  // === REQUISIÇÕES ===
  {
    id: "rq-1", title: "Requisições Internas", icon: Send, module: "requests", category: "daily",
    description: "Como criar e responder requisições entre setores.",
    steps: [
      "Acesse 'Requisições' no menu Gestão",
      "Clique em '+ Nova Requisição' para solicitar algo a outro setor",
      "Preencha: título, descrição, departamento destino e prioridade",
      "O destinatário recebe a notificação no menu (badge vermelho)",
      "Acompanhe o status: Pendente → Em Andamento → Concluída"
    ]
  },

  // === DEMANDAS AVULSAS ===
  {
    id: "ah-1", title: "Demandas Avulsas", icon: Wrench, module: "ad-hoc", category: "daily",
    description: "Como solicitar trabalhos fora do escopo recorrente.",
    steps: [
      "Acesse 'Demandas Avulsas' no menu Gestão",
      "Crie uma demanda especificando cliente, tipo e prazo",
      "Demandas avulsas são cobradas separadamente e rastreadas à parte",
      "O valor é definido na proposta e acompanhado no Financeiro"
    ]
  },

  // === RECORRÊNCIAS ===
  {
    id: "rc-1", title: "Serviços Recorrentes", icon: RefreshCw, module: "recurrences", category: "daily",
    description: "Como gerenciar entregas recorrentes por cliente.",
    steps: [
      "Acesse 'Recorrências' no menu Gestão",
      "Visualize os serviços programados para cada cliente",
      "Cada recorrência mostra: frequência, responsável e próxima entrega",
      "Use para garantir que nenhuma entrega mensal seja esquecida"
    ]
  },

  // === ADMIN ===
  {
    id: "ad-1", title: "Administração de Usuários", icon: Shield, module: "admin", category: "advanced",
    description: "Como gerenciar colaboradores, permissões e acessos.",
    roles: ["Diretoria", "Gerente Operacional"],
    steps: [
      "Acesse 'Usuários' no menu Sistema",
      "Veja todos os colaboradores cadastrados e seus status",
      "Clique em um usuário para editar permissões de módulo",
      "Ative/desative módulos específicos usando os toggles",
      "Novos usuários são criados com username e senha padrão (username + 123)"
    ],
    tips: ["Nunca remova acesso ao módulo 'Dashboard' — é a página inicial", "Gerentes Operacionais precisam de acesso a todos os módulos operacionais"]
  },

  // === ESPALHAR DEMANDAS ===
  {
    id: "ad-2", title: "Espalhar Demandas (Admin/Gerente)", icon: Zap, module: "clients", category: "advanced",
    description: "Como gerar tarefas automáticas para a equipe de um cliente.",
    roles: ["Diretoria", "Gerente Operacional"],
    steps: [
      "Acesse a página de detalhes de um cliente",
      "Certifique-se de que a equipe está completa (Titular + Reserva para cada cargo)",
      "Clique em 'Espalhar Demandas' no topo da página",
      "O sistema cria automaticamente tarefas baseadas no cargo e serviços do cliente",
      "Tráfego → Otimizar Campanhas | Social → Roteiro, Arte, Edição | Produção → Gravação"
    ],
    tips: [
      "Membros marcados como 'Reserva' NÃO recebem demandas automáticas",
      "Se já existirem demandas espalhadas, o botão aparece como '✓ Demandas Espalhadas'",
      "Exclua demandas incorretas pelo ícone 🗑️ antes de re-espalhar"
    ]
  },

  // === DASHBOARD OPS ===
  {
    id: "do-1", title: "Dashboard Operacional", icon: BarChart3, module: "dashboard-ops", category: "advanced",
    description: "Métricas e indicadores de performance da operação.",
    roles: ["Diretoria", "Gerente Operacional"],
    steps: [
      "Acesse 'Dashboard Ops' no menu Principal",
      "Veja métricas de tarefas: concluídas, pendentes, atrasadas e bloqueadas",
      "Acompanhe o workload da equipe por setor",
      "Identifique gargalos e tarefas escaladas que precisam de atenção",
      "Use para tomar decisões de redistribuição de demandas"
    ]
  },
];

const categoryLabels = {
  "getting-started": { label: "Primeiros Passos", icon: Star, color: "text-amber-500" },
  "daily": { label: "Uso Diário", icon: Play, color: "text-emerald-500" },
  "advanced": { label: "Avançado", icon: Shield, color: "text-violet-500" },
};

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  const [open, setOpen] = useState(false);
  const Icon = tutorial.icon;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden transition-all hover:border-primary/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{tutorial.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tutorial.description}</p>
        </div>
        <div className="flex-shrink-0 mt-1">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Passo a passo</h4>
            <ol className="space-y-2">
              {tutorial.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {tutorial.tips && tutorial.tips.length > 0 && (
            <div className="bg-muted/50 rounded-md p-3">
              <h4 className="text-xs font-semibold text-foreground mb-1.5">💡 Dicas</h4>
              <ul className="space-y-1">
                {tutorial.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-primary">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpCenterPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [search, setSearch] = useState("");

  const visibleTutorials = useMemo(() => {
    const userModules = currentUser?.isAdmin
      ? tutorials.map(t => t.module)
      : (currentUser?.moduleAccess || ["dashboard", "clients", "tasks"]);

    return tutorials.filter(t => {
      // Check module access
      if (!userModules.includes(t.module)) return false;
      // Check role restriction
      if (t.roles && t.roles.length > 0) {
        const userRoles = currentUser?.roles || [];
        const hasRole = t.roles.some(r => userRoles.includes(r)) || currentUser?.isAdmin;
        if (!hasRole) return false;
      }
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [currentUser, search]);

  const grouped = {
    "getting-started": visibleTutorials.filter(t => t.category === "getting-started"),
    "daily": visibleTutorials.filter(t => t.category === "daily"),
    "advanced": visibleTutorials.filter(t => t.category === "advanced"),
  };

  return (
    <div>
      <PageHeader title="Central de Ajuda" description="Tutoriais e guias operacionais personalizados para você" />

      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar tutorial..."
          className="w-full max-w-md px-4 py-2.5 rounded-lg border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Mostrando {visibleTutorials.length} tutorial(is) disponíveis para o seu perfil ({currentUser?.role})
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos ({visibleTutorials.length})</TabsTrigger>
          {Object.entries(categoryLabels).map(([key, cat]) => {
            const count = grouped[key as keyof typeof grouped].length;
            if (count === 0) return null;
            return <TabsTrigger key={key} value={key}>{cat.label} ({count})</TabsTrigger>;
          })}
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-6">
            {Object.entries(categoryLabels).map(([key, cat]) => {
              const items = grouped[key as keyof typeof grouped];
              if (items.length === 0) return null;
              const CatIcon = cat.icon;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon className={`w-4 h-4 ${cat.color}`} />
                    <h2 className="text-sm font-semibold text-foreground">{cat.label}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(t => <TutorialCard key={t.id} tutorial={t} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {Object.entries(categoryLabels).map(([key, cat]) => {
          const items = grouped[key as keyof typeof grouped];
          if (items.length === 0) return null;
          return (
            <TabsContent key={key} value={key}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(t => <TutorialCard key={t.id} tutorial={t} />)}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
