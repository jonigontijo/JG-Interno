export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_tokens: {
        Row: {
          active: boolean
          client_id: string
          client_name: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          active?: boolean
          client_id: string
          client_name: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          token?: string
        }
        Update: {
          active?: boolean
          client_id?: string
          client_name?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      change_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      client_pipelines: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_steps: number[]
          current_step_order: number
          started_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_steps?: number[]
          current_step_order?: number
          started_at: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_steps?: number[]
          current_step_order?: number
          started_at?: string
        }
        Relationships: []
      }
      client_posts: {
        Row: {
          approval_status: string
          approved_at: string | null
          client_id: string
          client_name: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          notes: string | null
          posted: boolean
          posted_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          client_id: string
          client_name: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          notes?: string | null
          posted?: boolean
          posted_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          client_id?: string
          client_name?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          posted?: boolean
          posted_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      client_recurring_services: {
        Row: {
          active: boolean
          assignee_id: string
          assignee_name: string
          client_id: string
          created_at: string
          description: string | null
          frequency: string
          id: string
          name: string
          quantity_per_cycle: number | null
        }
        Insert: {
          active?: boolean
          assignee_id: string
          assignee_name: string
          client_id: string
          created_at?: string
          description?: string | null
          frequency?: string
          id: string
          name: string
          quantity_per_cycle?: number | null
        }
        Update: {
          active?: boolean
          assignee_id?: string
          assignee_name?: string
          client_id?: string
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          name?: string
          quantity_per_cycle?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_recurring_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_team_assignments: {
        Row: {
          client_id: string
          created_at: string
          designation: string
          id: string
          member_id: string
          member_name: string
          role: string
        }
        Insert: {
          client_id: string
          created_at?: string
          designation?: string
          id?: string
          member_id: string
          member_name: string
          role: string
        }
        Update: {
          client_id?: string
          created_at?: string
          designation?: string
          id?: string
          member_id?: string
          member_name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_team_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager: string
          barter_agreed_value: number | null
          barter_description: string | null
          barter_end_date: string | null
          barter_notes: string | null
          barter_start_date: string | null
          company: string
          created_at: string
          days_overdue: number | null
          id: string
          is_barter: boolean | null
          is_paid: boolean | null
          last_approval: string | null
          monthly_value: number
          name: string
          next_recording: string | null
          overdue_tasks: number
          paid_date: string | null
          payment_due_date: string | null
          payment_due_day: number | null
          payment_status: string | null
          pending_tasks: number
          posts_ready_next_week: number | null
          posts_ready_this_week: number | null
          risk_level: string
          services: string[]
          setup_value: number
          social_manager: string | null
          social_media_posts: number | null
          status: string
          substatus: string
          traffic_manager: string | null
        }
        Insert: {
          account_manager?: string
          barter_agreed_value?: number | null
          barter_description?: string | null
          barter_end_date?: string | null
          barter_notes?: string | null
          barter_start_date?: string | null
          company: string
          created_at?: string
          days_overdue?: number | null
          id: string
          is_barter?: boolean | null
          is_paid?: boolean | null
          last_approval?: string | null
          monthly_value?: number
          name?: string
          next_recording?: string | null
          overdue_tasks?: number
          paid_date?: string | null
          payment_due_date?: string | null
          payment_due_day?: number | null
          payment_status?: string | null
          pending_tasks?: number
          posts_ready_next_week?: number | null
          posts_ready_this_week?: number | null
          risk_level?: string
          services?: string[]
          setup_value?: number
          social_manager?: string | null
          social_media_posts?: number | null
          status?: string
          substatus?: string
          traffic_manager?: string | null
        }
        Update: {
          account_manager?: string
          barter_agreed_value?: number | null
          barter_description?: string | null
          barter_end_date?: string | null
          barter_notes?: string | null
          barter_start_date?: string | null
          company?: string
          created_at?: string
          days_overdue?: number | null
          id?: string
          is_barter?: boolean | null
          is_paid?: boolean | null
          last_approval?: string | null
          monthly_value?: number
          name?: string
          next_recording?: string | null
          overdue_tasks?: number
          paid_date?: string | null
          payment_due_date?: string | null
          payment_due_day?: number | null
          payment_status?: string | null
          pending_tasks?: number
          posts_ready_next_week?: number | null
          posts_ready_this_week?: number | null
          risk_level?: string
          services?: string[]
          setup_value?: number
          social_manager?: string | null
          social_media_posts?: number | null
          status?: string
          substatus?: string
          traffic_manager?: string | null
        }
        Relationships: []
      }
      internal_requests: {
        Row: {
          assigned_to_id: string
          assigned_to_name: string
          client_id: string | null
          client_name: string | null
          created_at: string
          department: string
          description: string
          due_date: string | null
          id: string
          priority: string
          redistributed_by: string | null
          redistributed_to: string | null
          requester_id: string
          requester_name: string
          status: string
          task_id: string | null
          title: string
        }
        Insert: {
          assigned_to_id: string
          assigned_to_name: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          department?: string
          description?: string
          due_date?: string | null
          id: string
          priority?: string
          redistributed_by?: string | null
          redistributed_to?: string | null
          requester_id: string
          requester_name: string
          status?: string
          task_id?: string | null
          title: string
        }
        Update: {
          assigned_to_id?: string
          assigned_to_name?: string
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          department?: string
          description?: string
          due_date?: string | null
          id?: string
          priority?: string
          redistributed_by?: string | null
          redistributed_to?: string | null
          requester_id?: string
          requester_name?: string
          status?: string
          task_id?: string | null
          title?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company: string
          created_at: string
          discount: number | null
          final_value: number | null
          id: string
          meeting_date: string
          name: string
          next_follow_up: string
          notes: string
          origin: string
          potential_value: number
          responsible: string
          services: string[] | null
          stage: string
        }
        Insert: {
          company: string
          created_at?: string
          discount?: number | null
          final_value?: number | null
          id: string
          meeting_date?: string
          name: string
          next_follow_up?: string
          notes?: string
          origin?: string
          potential_value?: number
          responsible?: string
          services?: string[] | null
          stage?: string
        }
        Update: {
          company?: string
          created_at?: string
          discount?: number | null
          final_value?: number | null
          id?: string
          meeting_date?: string
          name?: string
          next_follow_up?: string
          notes?: string
          origin?: string
          potential_value?: number
          responsible?: string
          services?: string[] | null
          stage?: string
        }
        Relationships: []
      }
      onboarding_data: {
        Row: {
          access_data: Json
          checklist: Json
          client_id: string
        }
        Insert: {
          access_data?: Json
          checklist?: Json
          client_id: string
        }
        Update: {
          access_data?: Json
          checklist?: Json
          client_id?: string
        }
        Relationships: []
      }
      productivity: {
        Row: {
          avg_tasks_per_day: number
          last_updated: string
          tasks_completed_today: number
          total_days_worked: number
          total_tasks_completed: number
          user_id: string
          user_name: string
        }
        Insert: {
          avg_tasks_per_day?: number
          last_updated?: string
          tasks_completed_today?: number
          total_days_worked?: number
          total_tasks_completed?: number
          user_id: string
          user_name: string
        }
        Update: {
          avg_tasks_per_day?: number
          last_updated?: string
          tasks_completed_today?: number
          total_days_worked?: number
          total_tasks_completed?: number
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          hire_date: string | null
          id: string
          is_admin: boolean
          module_access: string[]
          name: string
          role: string
          roles: string[]
          username: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hire_date?: string | null
          id: string
          is_admin?: boolean
          module_access?: string[]
          name: string
          role?: string
          roles?: string[]
          username: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hire_date?: string | null
          id?: string
          is_admin?: boolean
          module_access?: string[]
          name?: string
          role?: string
          roles?: string[]
          username?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          approved_at: string | null
          client_id: string
          client_name: string
          created_at: string
          id: string
          notes: string
          paid_at: string | null
          proposal_sent_at: string | null
          proposal_value: number | null
          requested_at: string
          requested_by: string
          service: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          client_id: string
          client_name: string
          created_at?: string
          id: string
          notes?: string
          paid_at?: string | null
          proposal_sent_at?: string | null
          proposal_value?: number | null
          requested_at: string
          requested_by: string
          service: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          client_id?: string
          client_name?: string
          created_at?: string
          id?: string
          notes?: string
          paid_at?: string | null
          proposal_sent_at?: string | null
          proposal_value?: number | null
          requested_at?: string
          requested_by?: string
          service?: string
          status?: string
        }
        Relationships: []
      }
      salary_projections: {
        Row: {
          member_id: string
          projected_salary: number
          updated_at: string
        }
        Insert: {
          member_id: string
          projected_salary?: number
          updated_at?: string
        }
        Update: {
          member_id?: string
          projected_salary?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          options: string[] | null
          type: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          id: string
          label: string
          options?: string[] | null
          type?: string
          value?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          options?: string[] | null
          type?: string
          value?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          accumulated_minutes: number
          actual_hours: number | null
          assignee: string
          client: string
          client_id: string
          completed_at: string | null
          created_at: string
          deadline: string
          description: string | null
          estimated_hours: number
          has_rework: boolean
          id: string
          module: string
          paused_at: string | null
          recur_until: string | null
          reviewer: string | null
          sector: string
          started_at: string | null
          status: string
          time_spent_minutes: number | null
          title: string
          type: string
          urgency: string
          weight: number
        }
        Insert: {
          accumulated_minutes?: number
          actual_hours?: number | null
          assignee?: string
          client?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          deadline: string
          description?: string | null
          estimated_hours?: number
          has_rework?: boolean
          id: string
          module?: string
          paused_at?: string | null
          recur_until?: string | null
          reviewer?: string | null
          sector?: string
          started_at?: string | null
          status?: string
          time_spent_minutes?: number | null
          title: string
          type?: string
          urgency?: string
          weight?: number
        }
        Update: {
          accumulated_minutes?: number
          actual_hours?: number | null
          assignee?: string
          client?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          deadline?: string
          description?: string | null
          estimated_hours?: number
          has_rework?: boolean
          id?: string
          module?: string
          paused_at?: string | null
          recur_until?: string | null
          reviewer?: string | null
          sector?: string
          started_at?: string | null
          status?: string
          time_spent_minutes?: number | null
          title?: string
          type?: string
          urgency?: string
          weight?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          avatar: string
          capacity: number
          company: string | null
          created_at: string
          current_load: number
          hire_date: string | null
          id: string
          name: string
          role: string
          roles: string[]
          salary: number | null
          salary_base: number | null
          salary_bonus: number | null
          salary_com_google: number | null
          salary_com_id_vis: number | null
          salary_com_site: number | null
          salary_com_trafego: number | null
          salary_mens_ia: number | null
          salary_vt: number | null
          specialty: string[]
          tasks_active: number
          total_cost: number | null
        }
        Insert: {
          avatar?: string
          capacity?: number
          company?: string | null
          created_at?: string
          current_load?: number
          hire_date?: string | null
          id: string
          name: string
          role?: string
          roles?: string[]
          salary?: number | null
          salary_base?: number | null
          salary_bonus?: number | null
          salary_com_google?: number | null
          salary_com_id_vis?: number | null
          salary_com_site?: number | null
          salary_com_trafego?: number | null
          salary_mens_ia?: number | null
          salary_vt?: number | null
          specialty?: string[]
          tasks_active?: number
          total_cost?: number | null
        }
        Update: {
          avatar?: string
          capacity?: number
          company?: string | null
          created_at?: string
          current_load?: number
          hire_date?: string | null
          id?: string
          name?: string
          role?: string
          roles?: string[]
          salary?: number | null
          salary_base?: number | null
          salary_bonus?: number | null
          salary_com_google?: number | null
          salary_com_id_vis?: number | null
          salary_com_site?: number | null
          salary_com_trafego?: number | null
          salary_mens_ia?: number | null
          salary_vt?: number | null
          specialty?: string[]
          tasks_active?: number
          total_cost?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
