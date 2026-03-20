import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppUser {
  id: string;
  authId?: string; // Supabase Auth UUID
  username: string;
  name: string;
  role: string;
  roles: string[];
  isAdmin: boolean;
  active: boolean;
  hireDate?: string;
  moduleAccess?: string[];
}

export const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "dashboard-ops", label: "Dashboard Ops", path: "/dashboard-ops" },
  { key: "dashboard-financial", label: "Dashboard Financeiro", path: "/dashboard-financial" },
  { key: "workload", label: "Workload", path: "/dashboard-workload" },
  { key: "clients", label: "Clientes", path: "/clients" },
  { key: "tasks", label: "Tarefas", path: "/tasks" },
  { key: "prospection", label: "Prospecção", path: "/prospection" },
  { key: "proposals", label: "Propostas", path: "/proposals" },
  { key: "quote-requests", label: "Orçamentos", path: "/quote-requests" },
  { key: "financial", label: "Financeiro", path: "/financial" },
  { key: "onboarding", label: "Onboarding", path: "/onboarding" },
  { key: "traffic", label: "Tráfego Pago", path: "/traffic" },
  { key: "social", label: "Social Media", path: "/social" },
  { key: "production", label: "Produção", path: "/production" },
  { key: "tech", label: "Tech / Sites", path: "/tech" },
  { key: "inside-sales", label: "Inside Sales", path: "/inside-sales" },
  { key: "approvals", label: "Aprovações", path: "/approvals" },
  { key: "requests", label: "Requisições", path: "/requests" },
  { key: "ad-hoc", label: "Demandas Avulsas", path: "/ad-hoc" },
  { key: "recurrences", label: "Recorrências", path: "/recurrences" },
  { key: "ai-alerts", label: "IA Campanhas", path: "/ai-alerts" },
  { key: "admin", label: "Usuários", path: "/admin" },
  { key: "audit", label: "Auditoria", path: "/audit" },
  { key: "settings", label: "Configurações", path: "/settings" },
] as const;

const DEFAULT_MODULES = ["dashboard", "clients", "tasks", "requests", "ad-hoc"];

function db(table: string) {
  return (supabase as any).from(table);
}

export interface RegistrationRequest {
  id: string;
  name: string;
  username: string;
  password_temp: string;
  desired_roles: string[];
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

interface AuthState {
  currentUser: AppUser | null;
  users: AppUser[];
  registrationRequests: RegistrationRequest[];
  isLoading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (user: AppUser & { password?: string }) => Promise<void>;
  updateUser: (id: string, data: Partial<AppUser> & { password?: string }) => void;
  removeUser: (id: string) => void;
  initAuth: () => Promise<void>;
  loadUsers: () => Promise<void>;
  submitRegistration: (data: { name: string; username: string; password: string; desiredRoles: string[]; message: string }) => Promise<boolean>;
  loadRegistrationRequests: () => Promise<void>;
  approveRegistration: (requestId: string) => Promise<void>;
  rejectRegistration: (requestId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: null,
  users: [],
  registrationRequests: [],
  isLoading: true,
  initialized: false,

  initAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (profile) {
          set({ currentUser: profile });
        }
      }
      await get().loadUsers();
    } finally {
      set({ isLoading: false, initialized: true });
    }
  },

  loadUsers: async () => {
    const { data } = await db('profiles').select('*');
    const dbUsers: AppUser[] = (data || []).map((p: any) => ({
      id: p.username || p.id,
      authId: p.id,
      username: p.username,
      name: p.name,
      role: p.role || '',
      roles: p.roles || [],
      isAdmin: p.is_admin || false,
      active: p.active !== false,
      hireDate: p.hire_date,
      moduleAccess: p.module_access || DEFAULT_MODULES,
    }));

    // Only show active users
    set({ users: dbUsers.filter(u => u.active) });
  },

  login: async (username, password) => {
    const email = `${username.toLowerCase()}@jg.internal`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('Login error:', error.message);
      return false;
    }

    if (data?.user) {
      const profile = await loadProfile(data.user.id);
      if (profile) {
        if (!profile.active) {
          await supabase.auth.signOut();
          toast.error("Conta desativada. Fale com o administrador.");
          return false;
        }
        window.location.replace('/');
        return true;
      }
    }
    return false;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null, initialized: true, isLoading: false });
  },

  addUser: async (user) => {
    const email = `${user.username.toLowerCase()}@jg.internal`;
    const password = user.password || `${user.username}123`;

    // Use admin edge function to create user (auto-confirms email)
    const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-update-user', {
      body: {
        action: 'create',
        email,
        password,
        userData: {
          username: user.username.toLowerCase(),
          name: user.name,
          role: user.role,
          roles: user.roles,
          is_admin: user.isAdmin,
          module_access: user.moduleAccess || DEFAULT_MODULES,
        },
      },
    });

    if (fnError || fnData?.error) {
      const errMsg = fnData?.error || fnError?.message || 'Erro desconhecido';
      console.error('Error creating user:', errMsg);
      toast.error(`Erro ao criar usuário: ${errMsg}`);
      return;
    }

    toast.success(`Usuário ${user.name} criado com sucesso!`);
    await get().loadUsers();
  },

  updateUser: (id, data) => {
    const user = get().users.find(u => u.id === id);

    // Optimistic update in local state
    const { password, ...dataWithoutPassword } = data as any;
    set((s) => ({
      users: s.users.map(u => u.id === id ? { ...u, ...dataWithoutPassword } : u),
      currentUser: s.currentUser?.id === id ? { ...s.currentUser, ...dataWithoutPassword } : s.currentUser,
    }));

    // Sync to profiles table
    if (user?.authId) {
      const profileUpdate: any = {
        name: data.name ?? user.name,
        role: data.role ?? user.role,
        roles: data.roles ?? user.roles,
        is_admin: data.isAdmin ?? user.isAdmin,
        active: data.active ?? user.active,
        module_access: data.moduleAccess ?? user.moduleAccess,
      };
      if (data.hireDate !== undefined) profileUpdate.hire_date = data.hireDate || null;
      if (data.username) profileUpdate.username = data.username.toLowerCase();

      db('profiles').update(profileUpdate).eq('id', user.authId).then(({ error }: any) => {
        if (error) {
          console.error('Error updating profile:', error);
          toast.error('Erro ao salvar perfil no banco');
        }
      });

      // Sync password and/or email changes to Supabase Auth
      const needsAuthUpdate = password || (data.username && data.username !== user.username);
      if (needsAuthUpdate) {
        const authUpdate: any = {};
        if (password) authUpdate.password = password;
        if (data.username && data.username !== user.username) {
          authUpdate.email = `${data.username.toLowerCase()}@jg.internal`;
        }

        supabase.functions.invoke('admin-update-user', {
          body: {
            action: 'update',
            userId: user.authId,
            ...authUpdate,
          },
        }).then(({ data: fnData, error: fnError }) => {
          if (fnError || fnData?.error) {
            console.error('Error updating auth credentials:', fnError || fnData?.error);
            toast.error('Erro ao atualizar credenciais');
          }
        });
      }
    }
  },

  removeUser: (id) => {
    const user = get().users.find(u => u.id === id);
    if (!user) return;

    // Optimistic: remove from local state
    set((s) => ({ users: s.users.filter(u => u.id !== id) }));

    if (user.authId) {
      // Mark profile as inactive
      db('profiles').update({ active: false }).eq('id', user.authId).then(({ error }: any) => {
        if (error) console.error('Error deactivating profile:', error);
      });

      // Delete from Supabase Auth so user can't login anymore
      supabase.functions.invoke('admin-update-user', {
        body: { action: 'delete', userId: user.authId },
      }).then(({ data: fnData, error: fnError }) => {
        if (fnError || fnData?.error) {
          console.error('Error deleting auth user:', fnError || fnData?.error);
          toast.error('Erro ao remover acesso do usuário');
        }
      });
    }

    // Also delete from team_members table
    db('team_members').delete().eq('id', id).then(({ error }: any) => {
      if (error) console.error('Error deleting team member:', error);
    });
  },

  submitRegistration: async ({ name, username, password, desiredRoles, message }) => {
    const { error } = await db('registration_requests').insert({
      name,
      username: username.toLowerCase(),
      password_temp: password,
      desired_roles: desiredRoles,
      message: message || '',
      status: 'pending',
    });
    if (error) {
      console.error('Registration submit error:', error);
      toast.error(`Erro ao enviar solicitação: ${error.message}`);
      return false;
    }
    return true;
  },

  loadRegistrationRequests: async () => {
    const { data, error } = await db('registration_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading registration requests:', error);
      return;
    }
    set({ registrationRequests: data || [] });
  },

  approveRegistration: async (requestId) => {
    const req = get().registrationRequests.find(r => r.id === requestId);
    if (!req) return;

    const adminName = get().currentUser?.name || 'Admin';
    const displayRole = req.desired_roles.join(', ');

    // Create the actual user via addUser
    await get().addUser({
      id: `u-${Date.now()}`,
      username: req.username,
      password: req.password_temp,
      name: req.name,
      role: displayRole,
      roles: req.desired_roles,
      isAdmin: false,
      active: true,
      moduleAccess: DEFAULT_MODULES,
    });

    // Mark request as approved and clear temp password
    await db('registration_requests')
      .update({
        status: 'approved',
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        password_temp: '***',
      })
      .eq('id', requestId);

    set((s) => ({
      registrationRequests: s.registrationRequests.map(r =>
        r.id === requestId ? { ...r, status: 'approved' as const, reviewed_by: adminName, password_temp: '***' } : r
      ),
    }));
  },

  rejectRegistration: async (requestId) => {
    const adminName = get().currentUser?.name || 'Admin';

    await db('registration_requests')
      .update({
        status: 'rejected',
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        password_temp: '***',
      })
      .eq('id', requestId);

    set((s) => ({
      registrationRequests: s.registrationRequests.map(r =>
        r.id === requestId ? { ...r, status: 'rejected' as const, reviewed_by: adminName, password_temp: '***' } : r
      ),
    }));
  },
}));

async function loadProfile(authId: string): Promise<AppUser | null> {
  const { data, error } = await db('profiles').select('*').eq('id', authId).single();
  if (error || !data) return null;
  return {
    id: data.username || data.id,
    authId: data.id,
    username: data.username,
    name: data.name,
    role: data.role || '',
    roles: data.roles || [],
    isAdmin: data.is_admin || false,
    active: data.active !== false,
    moduleAccess: data.module_access || DEFAULT_MODULES,
  };
}
