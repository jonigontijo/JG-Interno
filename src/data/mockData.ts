export interface ClientTeamAssignment {
  memberId: string;
  memberName: string;
  role: string; // e.g. "Gestor de Tráfego", "Designer", etc.
  designation?: "titular" | "reserva"; // titular = primary, reserva = backup
}

export interface RecurringService {
  id: string;
  name: string;
  assigneeId: string;
  assigneeName: string;
  frequency: "diario" | "semanal" | "quinzenal" | "mensal" | "por_demanda";
  quantityPerCycle?: number; // e.g. 5 posts per week
  description?: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  services: string[];
  status: string;
  substatus: string;
  monthlyValue: number;
  setupValue: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  trafficManager?: string;
  socialManager?: string;
  accountManager: string;
  pendingTasks: number;
  overdueTasks: number;
  lastApproval?: string;
  nextRecording?: string;
  paymentStatus?: "em_dia" | "atrasado";
  paymentDueDate?: string;
  paymentDueDay?: number;
  socialMediaPosts?: number;
  postsReadyThisWeek?: number;
  postsReadyNextWeek?: number;
  isPaid?: boolean;
  paidDate?: string;
  daysOverdue?: number;
  isBarter?: boolean;
  barterDetails?: {
    description: string;
    agreedValue: number;
    startDate: string;
    endDate: string;
    notes: string;
  };
  // New: team & recurring services
  assignedTeam?: ClientTeamAssignment[];
  recurringServices?: RecurringService[];
}

export interface Task {
  id: string;
  title: string;
  client: string;
  clientId: string;
  module: string;
  sector: string;
  type: string;
  assignee: string;
  reviewer?: string;
  deadline: string;
  urgency: "normal" | "priority" | "urgent" | "critical";
  status: string;
  weight: number;
  estimatedHours: number;
  actualHours?: number;
  hasRework: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  timeSpentMinutes?: number;
  pausedAt?: string;
  accumulatedMinutes?: number;
  description?: string;
  recurUntil?: string;
  recurType?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  recurDaysInterval?: number;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  responsible: string;
  meetingDate: string;
  origin: string;
  stage: string;
  potentialValue: number;
  nextFollowUp: string;
  notes: string;
  services?: string[];
  discount?: number;
  finalValue?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  roles: string[];
  avatar: string;
  currentLoad: number;
  capacity: number;
  tasksActive: number;
  specialty: string[];
  salary?: number;
  company?: string;
  hireDate?: string;
  totalCost?: number;
  salaryBreakdown?: {
    base: number;
    bonus: number;
    vt: number;
    comTrafego: number;
    comGoogle: number;
    comSite: number;
    comIdVis: number;
    mensIA: number;
  };
}

function c(id: string, company: string, monthlyValue: number, paymentDueDay?: number, socialMediaPosts?: number): Client {
  const services: string[] = [];
  if (monthlyValue > 0) services.push("Tráfego");
  if (socialMediaPosts && socialMediaPosts > 0) services.push("Social Media");
  return {
    id, name: "", company, services, status: "Operação", substatus: "Ativo",
    monthlyValue, setupValue: 0, riskLevel: "low", accountManager: "Joni",
    pendingTasks: 0, overdueTasks: 0,
    paymentStatus: "em_dia", paymentDueDay,
    socialMediaPosts: socialMediaPosts || 0,
    postsReadyThisWeek: 0, postsReadyNextWeek: 0,
  };
}

export const mockClients: Client[] = [
  c("c1","TAPETES MASTER PERSONALIZADOS LTDA",800,3,5),
  c("c2","BRIER DESIGN - MARIANA ALMEIDA",2600,25),
  c("c3","TALENTOS",0,undefined,3),
  c("c4","RAFA MADEIRA",0,undefined,3),
  c("c5","FLAVIA BOARI PIJAMAS",1400,6),
  c("c6","BRAVATI - FEHEROS SHOP",4000,10),
  c("c7","MINAS WIND BANNERS PERSONALIZADOS LTDA",0,2,3),
  c("c8","PAXCOMP",1100,1),
  c("c9","MESTRE DAS IMPORTAÇÕES - THIAGO MENEZES",1500,1,3),
  c("c10","DR CHARLES",4200,2,3),
  c("c11","INSTITUTO VEZZA",0,2),
  c("c12","MARIANA FRANCISCHETTO",1000,2),
  c("c13","MANATA",0,2),
  c("c14","DRA JESSICA BRASIL",2000,4),
  c("c15","DIVI JEANS",2000,3),
  c("c16","FORMULA BIKE - AMARAL & AMARAL",1500,3),
  c("c17","FLOR DECOR - LUISA DE OLIVEIRA GARCIA",3621,3),
  c("c18","AURELIO IMPORTS",0,4),
  c("c19","SL SIMBA LELE KIDS LTDA",2000,4),
  c("c20","PANELAS CAROLA - METALURGICA CAROLA LTDA",3200,4),
  c("c21","UZEGAS DISTRIBUIDORA LTDA - ALEXANDRE",4500,4,3),
  c("c22","A E R DISTRIBUIDORA LTDA",0,5),
  c("c23","JULIA GONTIJO PIJAMAS LTDA",2000,5),
  c("c24","PRIME ODONTOLOGIA",2500,5),
  c("c25","PROVIDENCE IMOVEIS - MARIANA CAROLINE",2000,5),
  c("c26","VELOCITA ACADEMIA LTDA",3100,5,3),
  c("c27","SIS STORE",0,6),
  c("c28","MARFIM - LARISSA FONSECA COIMBRA",1500,6),
  c("c29","LEGATTA AUTOMOBILI COMERCIAL LTDA",2300,7),
  c("c30","K&E FITNESS LTDA",2000,7,3),
  c("c31","ROSSO AUTOMOBILI",2000,7),
  c("c32","MINAS SPORTS",1500,8),
  c("c33","ANIL PISCINA",3150,8,3),
  c("c34","GEX IMOBILIARIA LTDA",2500,8),
  c("c35","PEIXE IN LTDA",5700,9,3),
  c("c36","ED DESIGN INTERIORES LTDA",1500,14,3),
  c("c37","DEPOSITO BELVEDERE MATERIAIS DE CONSTRUCOES LTDA",3200,14),
  c("c38","REBECA GARCIA BARRETO",2000,9),
  c("c39","ACID - ASSOCIACAO COMERCIAL INDUSTRIAL",0,9),
  c("c40","JOSAFA ANDERSON DE OLIVEIRA",0,9),
  c("c41","LOHANA",0,10),
  c("c42","ZEEWAY SOLUCOES TECNOLOGICAS LTDA",0,10,3),
  c("c43","DR GUILHERME - SERVICO MEDICO ALZIRA LTDA",1200,10,3),
  c("c44","NOBRE CASA FESTAS LTDA",0,10,3),
  c("c45","CASA DAS CORREIAS / ELITE",3000,10,3),
  c("c46","PORTO SUL",2500,10),
  c("c47","ALPHA STYLE",2450,10,3),
  c("c48","LAVIRR ACESSORIOS",0,11),
  c("c49","CLUBE DE TIROS CONARMAS LTDA",1300,12,5),
  c("c50","LAIS RABELO BIOMEDICINA ESTETICA LTDA",2000,12),
  c("c51","REBOQUE R.G LTDA",2450,12,3),
  c("c52","VIENNA - THALES AUGUSTO DA CRUZ GUIMARAES",3000,12,5),
  c("c53","ELITE SHOES STORE LTDA",2000,13),
  c("c54","SABRINA DE OLIVEIRA SILVA",3000,13),
  c("c55","RICARDO RODRIGUES FERREIRA SOCIEDADE DE ADVOGADOS",700,13),
  c("c56","SKIK COURO",1200,14),
  c("c57","JEP CAR",3000,14),
  c("c58","CODIL",4000,25),
  c("c59","BOTANICALS - TAVARES MANIPULACAO LTDA",2000,15),
  c("c60","INLAZO - INNOVE - TULIO FRANCA",1100,15,3),
  c("c61","BERNARDES E AZEVEDO",600,15,3),
  c("c62","DISK ENTULHO - TROMAQ",1100,16),
  c("c63","VIA AL MART",3000,17,3),
  c("c64","BELL MAQUINAS",2450,18,3),
  c("c65","LUIS GUSTAVO LA GUARDIA CUSTODIO",2000,18),
  c("c66","BERRIES FITNESS - ANA CLARA DALDEGAN",0,18),
  c("c67","COFER IMPORTADORA E DISTRIBUIDORA LTDA",4000,26,5),
  c("c68","FERIAS NO BOLETO JC LTDA",3000,19,3),
  c("c69","CONEXAO",1500,19),
  c("c70","RODOVIAS ENGENHARIA LTDA",2800,20,3),
  c("c71","DELTA FUNDIDOS",1500,20),
  c("c72","BRUNA BATISTA",1500,20),
  c("c73","PANELA SNEAKER",2100,20,3),
  c("c74","MG LOGISTICA - TROMAQ",2450,22,3),
  c("c75","MARCELA CABRAL ODONTOLOGIA E HARMONIZACAO FACIAL LTDA",1200,22),
  c("c76","3D INK RESINAS E SOLUCOES LTDA",850,23,3),
  c("c77","LOJAS SANTO ANTONIO",2450,24,3),
  c("c78","MATIDONE SOLUCOES FINANCEIRAS LTDA",3000,24,3),
  c("c79","BARBARA LUIZA DA SILVA",3000,24,3),
  c("c80","CAMILA OLIVEIRA BATISTA",2000,24),
  c("c81","METRO BRAND",0,24),
  c("c82","LUISA GALVAO - MAGNIFIC",1500,25),
  c("c83","COLEGIO E PRE-VESTIBULAR ALFA",0,25),
  c("c84","TRICOSTURA",4500,29),
  c("c85","ZEUS MULTIMARCAS",3300,26,3),
  c("c86","GOEN JOALHERIA",0,27),
  c("c87","VIRTUAL PERSONALIZADOS LTDA",2000,27),
  c("c88","DIPLAPEL",2350,28,3),
  c("c89","MK STORE",1500,28),
  c("c90","Z-NINE",2000,29),
  c("c91","ESTUDIO AME LTDA",2000,29),
  c("c92","ETIPRISMA ETIQUETAS LTDA",3700,30,3),
  c("c93","EM JOIAS - FM JOIAS",3450,30,5),
  c("c94","COLCCI DIVINOPOLIS - ARR MODAS LTDA",2000,31),
];

function emp(id: string, name: string, hireDate: string, base: number, bonus: number, vt: number, comTrafego = 0, comGoogle = 0, comSite = 0, comIdVis = 0, mensIA = 0, company = "JG"): TeamMember {
  const total = base + bonus + vt + comTrafego + comGoogle + comSite + comIdVis + mensIA;
  return {
    id, name, role: "", roles: [],
    avatar: name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase(),
    currentLoad: 0, capacity: 40, tasksActive: 0, specialty: [],
    salary: total, hireDate, totalCost: total, company,
    salaryBreakdown: { base, bonus, vt, comTrafego, comGoogle, comSite, comIdVis, mensIA },
  };
}

function withRoles(member: TeamMember, role: string, roles: string[]): TeamMember {
  return { ...member, role, roles };
}

export const mockTeam: TeamMember[] = [
  withRoles(emp("e1", "Tayna", "2025-01-21", 1621, 0, 160.60, 0, 0, 0, 0, 0, "Prime"), "Sites", ["Sites"]),
  withRoles(emp("e3", "Yuri", "2025-09-15", 1621, 0, 160.60, 220, 0, 0, 0, 0, "Prime"), "Sites", ["Sites"]),
  withRoles(emp("e4", "Lucas JG TECH", "2025-10-09", 1621, 482, 160.60, 0, 0, 900, 0, 0, "JG Tech"), "Tecnologia", ["Tecnologia"]),
  withRoles(emp("e5", "Júlia", "2023-08-01", 2409, 250, 0), "Social Media - Videomaker", ["Social Media - Videomaker", "Social Media - Editor"]),
  withRoles(emp("e6", "Otávio", "2024-08-02", 1621, 688, 160.60, 350, 0, 0, 850), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e7", "Fabíola", "2024-05-07", 3033, 550, 160.60, 1050), "Financeiro", ["Financeiro"]),
  withRoles(emp("e8", "Gustavo Riosh", "2024-05-27", 1621, 1388, 160.60), "Social Media - Videomaker", ["Social Media - Videomaker", "Social Media - Editor"]),
  withRoles(emp("e9", "Rafael", "2025-01-07", 1621, 800, 160.60, 350), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e10", "Brener", "2025-01-30", 1621, 1879, 160.60, 700), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e11", "João Paulo Campos", "2025-02-18", 1621, 300, 160.60), "Social Media - Designer", ["Social Media - Designer"]),
  withRoles(emp("e12", "Iaskara", "2025-05-26", 1621, 432, 160.60, 700), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e13", "Elaine", "2025-06-02", 1621, 879, 160.60), "Organização", ["Organização"]),
  withRoles(emp("e14", "Lucas Abimael", "2025-07-02", 1621, 350, 160.60), "Social Media - Designer", ["Social Media - Designer"]),
  withRoles(emp("e15", "Flávio", "2025-07-16", 1621, 1982, 160.60), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e16", "Patrick", "2025-08-05", 1621, 150, 160.60), "Social Media - Designer", ["Social Media - Designer"]),
  withRoles(emp("e17", "Paulo", "2025-08-21", 1621, 200, 160.60, 350), "Social Media - Videomaker", ["Social Media - Videomaker", "Social Media - Editor"]),
  withRoles(emp("e20", "Mascarenhas", "2025-08-27", 1621, 0, 160.60), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e21", "Karen", "2025-10-13", 1621, 482, 275), "Social Media - Coordenação", ["Social Media - Coordenação"]),
  withRoles(emp("e22", "Ronald", "2025-12-01", 1621, 1379, 0), "Social Media - Designer", ["Social Media - Designer"]),
  withRoles(emp("e23", "Cristian", "2026-01-26", 1621, 0, 160.60, 350), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e24", "Denildo", "", 17000, 0, 0), "Gerente Operacional", ["Gerente Operacional"]),
  withRoles(emp("e26", "Maria Luisa", "2026-03-05", 1621, 0, 0), "Gestor de Tráfego", ["Gestor de Tráfego"]),
  withRoles(emp("e27", "Laura", "2026-03-01", 1621, 0, 0), "Inside Sales", ["Inside Sales"]),
  withRoles(emp("e28", "Gustavo", "2026-03-03", 1621, 0, 0), "Gestor de Tráfego", ["Gestor de Tráfego"]),
];

export const mockTasks: Task[] = [];
export const mockLeads: Lead[] = [];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}
