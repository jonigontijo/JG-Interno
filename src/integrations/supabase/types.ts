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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          whatsapp_api_token: string | null
          whatsapp_api_url: string | null
          whatsapp_default_instance: string | null
          whatsapp_default_template: string | null
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_api_token?: string | null
          whatsapp_api_url?: string | null
          whatsapp_default_instance?: string | null
          whatsapp_default_template?: string | null
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_api_token?: string | null
          whatsapp_api_url?: string | null
          whatsapp_default_instance?: string | null
          whatsapp_default_template?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity: string
          entity_id: string | null
          id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_name?: string
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
      client_briefings: {
        Row: {
          acao_desejada: string | null
          cliente_ideal: string | null
          comunicacao_videos: string | null
          created_at: string
          diferenciais: string | null
          disponibilidade_gravacao: string | null
          dores_resultados: string | null
          duvida_cliente: string | null
          escopo_entrega: string | null
          estilo_nao_gosta: string | null
          estilo_video: string | null
          foco_15dias: string | null
          fotos_link: string | null
          historia_marca: string | null
          id: string
          links_videos_referencia: string | null
          meta_principal: string | null
          metrica_36meses: string | null
          nome_marca: string
          objetivo_cliente: string | null
          objetivo_mes: string | null
          percepcao_marca: string | null
          perfil_cliente_atual: string | null
          produtos_servicos: string | null
          referencia_conteudo: string | null
          restricoes: string | null
          site_link: string | null
          status: string
          tom_de_voz: string | null
          videos_link: string | null
        }
        Insert: {
          acao_desejada?: string | null
          cliente_ideal?: string | null
          comunicacao_videos?: string | null
          created_at?: string
          diferenciais?: string | null
          disponibilidade_gravacao?: string | null
          dores_resultados?: string | null
          duvida_cliente?: string | null
          escopo_entrega?: string | null
          estilo_nao_gosta?: string | null
          estilo_video?: string | null
          foco_15dias?: string | null
          fotos_link?: string | null
          historia_marca?: string | null
          id?: string
          links_videos_referencia?: string | null
          meta_principal?: string | null
          metrica_36meses?: string | null
          nome_marca: string
          objetivo_cliente?: string | null
          objetivo_mes?: string | null
          percepcao_marca?: string | null
          perfil_cliente_atual?: string | null
          produtos_servicos?: string | null
          referencia_conteudo?: string | null
          restricoes?: string | null
          site_link?: string | null
          status?: string
          tom_de_voz?: string | null
          videos_link?: string | null
        }
        Update: {
          acao_desejada?: string | null
          cliente_ideal?: string | null
          comunicacao_videos?: string | null
          created_at?: string
          diferenciais?: string | null
          disponibilidade_gravacao?: string | null
          dores_resultados?: string | null
          duvida_cliente?: string | null
          escopo_entrega?: string | null
          estilo_nao_gosta?: string | null
          estilo_video?: string | null
          foco_15dias?: string | null
          fotos_link?: string | null
          historia_marca?: string | null
          id?: string
          links_videos_referencia?: string | null
          meta_principal?: string | null
          metrica_36meses?: string | null
          nome_marca?: string
          objetivo_cliente?: string | null
          objetivo_mes?: string | null
          percepcao_marca?: string | null
          perfil_cliente_atual?: string | null
          produtos_servicos?: string | null
          referencia_conteudo?: string | null
          restricoes?: string | null
          site_link?: string | null
          status?: string
          tom_de_voz?: string | null
          videos_link?: string | null
        }
        Relationships: []
      }
      client_dna: {
        Row: {
          client_id: string
          credentials: Json | null
          files: Json
          important_dates: Json | null
          links: Json | null
          notes: Json | null
        }
        Insert: {
          client_id: string
          credentials?: Json | null
          files?: Json
          important_dates?: Json | null
          links?: Json | null
          notes?: Json | null
        }
        Update: {
          client_id?: string
          credentials?: Json | null
          files?: Json
          important_dates?: Json | null
          links?: Json | null
          notes?: Json | null
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
          client_id: string
          client_name: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          notes: string | null
          status: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          client_id: string
          client_name: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          notes?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          client_id?: string
          client_name?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          notes?: string | null
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
          data_studio_urls: Json
          days_overdue: number | null
          hidden_in_reports: boolean
          id: string
          is_barter: boolean | null
          is_paid: boolean | null
          last_approval: string | null
          meta_ads_account_id: string | null
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
          reports_enabled: boolean
          risk_level: string
          services: string[]
          setup_value: number
          social_manager: string | null
          social_media_posts: number | null
          status: string
          substatus: string
          traffic_manager: string | null
          whatsapp: string | null
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
          data_studio_urls?: Json
          days_overdue?: number | null
          hidden_in_reports?: boolean
          id: string
          is_barter?: boolean | null
          is_paid?: boolean | null
          last_approval?: string | null
          meta_ads_account_id?: string | null
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
          reports_enabled?: boolean
          risk_level?: string
          services?: string[]
          setup_value?: number
          social_manager?: string | null
          social_media_posts?: number | null
          status?: string
          substatus?: string
          traffic_manager?: string | null
          whatsapp?: string | null
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
          data_studio_urls?: Json
          days_overdue?: number | null
          hidden_in_reports?: boolean
          id?: string
          is_barter?: boolean | null
          is_paid?: boolean | null
          last_approval?: string | null
          meta_ads_account_id?: string | null
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
          reports_enabled?: boolean
          risk_level?: string
          services?: string[]
          setup_value?: number
          social_manager?: string | null
          social_media_posts?: number | null
          status?: string
          substatus?: string
          traffic_manager?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      dingy_help_requests: {
        Row: {
          accepted_at: string | null
          created_at: string
          helper_name: string | null
          id: string
          message: string | null
          requester_name: string
          status: string
          task_client: string | null
          task_id: string
          task_title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          helper_name?: string | null
          id?: string
          message?: string | null
          requester_name: string
          status?: string
          task_client?: string | null
          task_id: string
          task_title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          helper_name?: string | null
          id?: string
          message?: string | null
          requester_name?: string
          status?: string
          task_client?: string | null
          task_id?: string
          task_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dingy_task_checklist: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          task_id: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      dingy_task_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: []
      }
      google_calendar_connection: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          channel_expires_at: string | null
          channel_id: string | null
          connected_at: string | null
          connected_by: string | null
          expires_at: string | null
          google_email: string | null
          id: number
          refresh_token: string | null
          resource_id: string | null
          sync_token: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          channel_expires_at?: string | null
          channel_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: number
          refresh_token?: string | null
          resource_id?: string | null
          sync_token?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          channel_expires_at?: string | null
          channel_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: number
          refresh_token?: string | null
          resource_id?: string | null
          sync_token?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      internal_requests: {
        Row: {
          assigned_to_id: string
          assigned_to_name: string
          attachments: Json | null
          client_id: string | null
          client_name: string | null
          created_at: string
          delivery_links: Json | null
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
          attachments?: Json | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          delivery_links?: Json | null
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
          attachments?: Json | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          delivery_links?: Json | null
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
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number | null
          client_id: string
          created_at: string | null
          id: string
          paid_date: string | null
          year_month: string
        }
        Insert: {
          amount?: number | null
          client_id: string
          created_at?: string | null
          id?: string
          paid_date?: string | null
          year_month: string
        }
        Update: {
          amount?: number | null
          client_id?: string
          created_at?: string | null
          id?: string
          paid_date?: string | null
          year_month?: string
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
          recovery_email: string | null
          role: string
          roles: string[]
          sector_visibility: string[] | null
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
          recovery_email?: string | null
          role?: string
          roles?: string[]
          sector_visibility?: string[] | null
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
          recovery_email?: string | null
          role?: string
          roles?: string[]
          sector_visibility?: string[] | null
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
      recordings: {
        Row: {
          client_id: string | null
          client_name: string | null
          color: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          end_time: string | null
          google_event_id: string | null
          google_synced_at: string | null
          id: string
          location: string | null
          notes: string | null
          participants: string[] | null
          responsible_name: string | null
          roteiro: string | null
          roteiro_sent: boolean
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          color?: string
          created_at?: string
          created_by: string
          date: string
          description?: string | null
          end_time?: string | null
          google_event_id?: string | null
          google_synced_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          participants?: string[] | null
          responsible_name?: string | null
          roteiro?: string | null
          roteiro_sent?: boolean
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          color?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          end_time?: string | null
          google_event_id?: string | null
          google_synced_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          participants?: string[] | null
          responsible_name?: string | null
          roteiro?: string | null
          roteiro_sent?: boolean
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          created_at: string | null
          desired_roles: string[] | null
          id: string
          message: string | null
          name: string
          password_temp: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          desired_roles?: string[] | null
          id?: string
          message?: string | null
          name: string
          password_temp: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          desired_roles?: string[] | null
          id?: string
          message?: string | null
          name?: string
          password_temp?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          username?: string
        }
        Relationships: []
      }
      report_campaigns: {
        Row: {
          cost_per_result: number | null
          cost_per_result_label: string | null
          created_at: string
          followers_current: number | null
          followers_gained: number | null
          id: string
          investment: number
          name: string
          notes: string | null
          objective: string
          platform: string
          position: number
          report_id: string
          sub_division: string | null
          volume: number
          volume_label: string | null
        }
        Insert: {
          cost_per_result?: number | null
          cost_per_result_label?: string | null
          created_at?: string
          followers_current?: number | null
          followers_gained?: number | null
          id?: string
          investment?: number
          name: string
          notes?: string | null
          objective: string
          platform?: string
          position?: number
          report_id: string
          sub_division?: string | null
          volume?: number
          volume_label?: string | null
        }
        Update: {
          cost_per_result?: number | null
          cost_per_result_label?: string | null
          created_at?: string
          followers_current?: number | null
          followers_gained?: number | null
          id?: string
          investment?: number
          name?: string
          notes?: string | null
          objective?: string
          platform?: string
          position?: number
          report_id?: string
          sub_division?: string | null
          volume?: number
          volume_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_campaigns_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_dispatches: {
        Row: {
          attempts: number
          channel: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          message: string
          phone: string
          provider_response: Json | null
          report_id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          channel?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          message: string
          phone: string
          provider_response?: Json | null
          report_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          channel?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          message?: string
          phone?: string
          provider_response?: Json | null
          report_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_dispatches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dispatches_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_purge_log: {
        Row: {
          cutoff_date: string
          deleted_campaigns_count: number
          deleted_dispatches_count: number
          deleted_reports_count: number
          deleted_tasks_count: number
          details: Json
          dry_run: boolean
          id: string
          kept_interval: string
          ran_at: string
        }
        Insert: {
          cutoff_date: string
          deleted_campaigns_count?: number
          deleted_dispatches_count?: number
          deleted_reports_count?: number
          deleted_tasks_count?: number
          details?: Json
          dry_run?: boolean
          id?: string
          kept_interval: string
          ran_at?: string
        }
        Update: {
          cutoff_date?: string
          deleted_campaigns_count?: number
          deleted_dispatches_count?: number
          deleted_reports_count?: number
          deleted_tasks_count?: number
          details?: Json
          dry_run?: boolean
          id?: string
          kept_interval?: string
          ran_at?: string
        }
        Relationships: []
      }
      report_tasks: {
        Row: {
          created_at: string
          description: string
          id: string
          owner: string
          position: number
          report_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          owner: string
          position?: number
          report_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          owner?: string
          position?: number
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_tasks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
        ]
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
      sm_ai_api_keys: {
        Row: {
          api_key: string
          base_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          model: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          model?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          model?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_ai_api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_ai_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["sm_ai_action_type"] | null
          approval_id: string | null
          client_id: string | null
          command: string
          created_at: string
          error_message: string | null
          id: string
          post_id: string | null
          result: string | null
          result_data: Json | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          action_type?: Database["public"]["Enums"]["sm_ai_action_type"] | null
          approval_id?: string | null
          client_id?: string | null
          command: string
          created_at?: string
          error_message?: string | null
          id?: string
          post_id?: string | null
          result?: string | null
          result_data?: Json | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["sm_ai_action_type"] | null
          approval_id?: string | null
          client_id?: string | null
          command?: string
          created_at?: string
          error_message?: string | null
          id?: string
          post_id?: string | null
          result?: string | null
          result_data?: Json | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_ai_logs_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "sm_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_ai_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_ai_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_ai_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_approval_notifications: {
        Row: {
          approval_id: string
          created_at: string
          id: string
          message: string | null
          read: boolean
          read_at: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          approval_id: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          approval_id?: string
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          read_at?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_approval_notifications_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "sm_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_approval_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_approvals: {
        Row: {
          client_feedback: string | null
          client_id: string
          client_responded_at: string | null
          created_at: string
          created_by: string | null
          id: string
          piece_file_path: string | null
          piece_type: string
          piece_url: string | null
          post_id: string
          status: Database["public"]["Enums"]["sm_approval_status"]
          updated_at: string
          webhook_response: Json | null
          webhook_sent_at: string | null
        }
        Insert: {
          client_feedback?: string | null
          client_id: string
          client_responded_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          piece_file_path?: string | null
          piece_type?: string
          piece_url?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["sm_approval_status"]
          updated_at?: string
          webhook_response?: Json | null
          webhook_sent_at?: string | null
        }
        Update: {
          client_feedback?: string | null
          client_id?: string
          client_responded_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          piece_file_path?: string | null
          piece_type?: string
          piece_url?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["sm_approval_status"]
          updated_at?: string
          webhook_response?: Json | null
          webhook_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_approvals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_calendar_events: {
        Row: {
          calendar_connection_id: number | null
          client_id: string
          created_at: string
          event_description: string | null
          event_end: string | null
          event_start: string | null
          event_title: string | null
          event_url: string | null
          google_calendar_id: string
          google_event_id: string
          id: string
          last_synced_at: string
          post_id: string | null
          updated_at: string
        }
        Insert: {
          calendar_connection_id?: number | null
          client_id: string
          created_at?: string
          event_description?: string | null
          event_end?: string | null
          event_start?: string | null
          event_title?: string | null
          event_url?: string | null
          google_calendar_id: string
          google_event_id: string
          id?: string
          last_synced_at?: string
          post_id?: string | null
          updated_at?: string
        }
        Update: {
          calendar_connection_id?: number | null
          client_id?: string
          created_at?: string
          event_description?: string | null
          event_end?: string | null
          event_start?: string | null
          event_title?: string | null
          event_url?: string | null
          google_calendar_id?: string
          google_event_id?: string
          id?: string
          last_synced_at?: string
          post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_calendar_events_calendar_connection_id_fkey"
            columns: ["calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_connection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_calendar_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_client_configs: {
        Row: {
          active_platforms: string[]
          client_id: string
          client_webhook_url: string | null
          contract_end: string | null
          contract_notes: string | null
          contract_start: string | null
          created_at: string
          id: string
          is_active: boolean
          post_frequency: Json
          responsible_id: string | null
          updated_at: string
        }
        Insert: {
          active_platforms?: string[]
          client_id: string
          client_webhook_url?: string | null
          contract_end?: string | null
          contract_notes?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          post_frequency?: Json
          responsible_id?: string | null
          updated_at?: string
        }
        Update: {
          active_platforms?: string[]
          client_id?: string
          client_webhook_url?: string | null
          contract_end?: string | null
          contract_notes?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          post_frequency?: Json
          responsible_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_client_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_client_configs_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_integration_settings: {
        Row: {
          ai_command_webhook_url: string | null
          approval_webhook_url: string
          callback_secret: string
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_command_webhook_url?: string | null
          approval_webhook_url?: string
          callback_secret?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_command_webhook_url?: string | null
          approval_webhook_url?: string
          callback_secret?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_integration_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_monthly_reports: {
        Row: {
          ai_suggestions: string | null
          ai_summary: string | null
          by_platform: Json
          client_id: string
          created_at: string
          generated_at: string
          generated_by: string
          id: string
          posts_late: number
          posts_pending: number
          posts_published: number
          posts_scheduled: number
          reference_month: string
          total_posts: number
        }
        Insert: {
          ai_suggestions?: string | null
          ai_summary?: string | null
          by_platform?: Json
          client_id: string
          created_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          posts_late?: number
          posts_pending?: number
          posts_published?: number
          posts_scheduled?: number
          reference_month: string
          total_posts?: number
        }
        Update: {
          ai_suggestions?: string | null
          ai_summary?: string | null
          by_platform?: Json
          client_id?: string
          created_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          posts_late?: number
          posts_pending?: number
          posts_published?: number
          posts_scheduled?: number
          reference_month?: string
          total_posts?: number
        }
        Relationships: [
          {
            foreignKeyName: "sm_monthly_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_posts: {
        Row: {
          approval_id: string | null
          caption: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          hashtags: string | null
          id: string
          media_type: string | null
          media_url: string | null
          notes: string | null
          platform: Database["public"]["Enums"]["sm_platform"]
          post_type: Database["public"]["Enums"]["sm_post_type"]
          published_at: string | null
          responsible_id: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["sm_post_status"]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          caption?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          hashtags?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          notes?: string | null
          platform: Database["public"]["Enums"]["sm_platform"]
          post_type?: Database["public"]["Enums"]["sm_post_type"]
          published_at?: string | null
          responsible_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["sm_post_status"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          caption?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          hashtags?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          notes?: string | null
          platform?: Database["public"]["Enums"]["sm_platform"]
          post_type?: Database["public"]["Enums"]["sm_post_type"]
          published_at?: string | null
          responsible_id?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["sm_post_status"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sm_posts_approval"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "sm_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_posts_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_sheet_clients: {
        Row: {
          cliente: string | null
          created_at: string
          id: string
          instagram: string | null
          last_synced_at: string
          quantidade_post: string | null
          row_index: number
          segmento: string | null
          senhas: string | null
          source_hash: string | null
          updated_at: string
          updated_in_app_at: string | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          last_synced_at?: string
          quantidade_post?: string | null
          row_index: number
          segmento?: string | null
          senhas?: string | null
          source_hash?: string | null
          updated_at?: string
          updated_in_app_at?: string | null
        }
        Update: {
          cliente?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          last_synced_at?: string
          quantidade_post?: string | null
          row_index?: number
          segmento?: string | null
          senhas?: string | null
          source_hash?: string | null
          updated_at?: string
          updated_in_app_at?: string | null
        }
        Relationships: []
      }
      sm_sheet_data: {
        Row: {
          cells: Json
          created_at: string
          id: string
          row_index: number
          source_hash: string | null
          tab_id: string
          updated_at: string
          updated_in_app_at: string | null
        }
        Insert: {
          cells?: Json
          created_at?: string
          id?: string
          row_index: number
          source_hash?: string | null
          tab_id: string
          updated_at?: string
          updated_in_app_at?: string | null
        }
        Update: {
          cells?: Json
          created_at?: string
          id?: string
          row_index?: number
          source_hash?: string | null
          tab_id?: string
          updated_at?: string
          updated_in_app_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_sheet_data_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "sm_sheet_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_sheet_tabs: {
        Row: {
          col_count: number
          created_at: string
          gid: number | null
          id: string
          last_synced_at: string
          position: number
          row_count: number
          title: string
          updated_at: string
        }
        Insert: {
          col_count?: number
          created_at?: string
          gid?: number | null
          id?: string
          last_synced_at?: string
          position?: number
          row_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          col_count?: number
          created_at?: string
          gid?: number | null
          id?: string
          last_synced_at?: string
          position?: number
          row_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sm_sheets_connection: {
        Row: {
          access_token: string | null
          channel_expires_at: string | null
          channel_id: string | null
          connected_at: string | null
          connected_by: string | null
          expires_at: string | null
          google_email: string | null
          id: number
          last_synced_at: string | null
          refresh_token: string | null
          resource_id: string | null
          sheet_name: string | null
          sheet_range: string | null
          spreadsheet_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          channel_expires_at?: string | null
          channel_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: number
          last_synced_at?: string | null
          refresh_token?: string | null
          resource_id?: string | null
          sheet_name?: string | null
          sheet_range?: string | null
          spreadsheet_id?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          channel_expires_at?: string | null
          channel_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: number
          last_synced_at?: string | null
          refresh_token?: string | null
          resource_id?: string | null
          sheet_name?: string | null
          sheet_range?: string | null
          spreadsheet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_sheets_connection_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          fire_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_fired_at: string | null
          last_status: number | null
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          fire_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fired_at?: string | null
          last_status?: number | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          fire_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_fired_at?: string | null
          last_status?: number | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          accumulated_minutes: number | null
          actual_hours: number | null
          assignee: string
          client: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deadline: string
          description: string | null
          estimated_hours: number
          has_rework: boolean
          id: string
          module: string
          paused_at: string | null
          recur_days_interval: number | null
          recur_type: string | null
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
          accumulated_minutes?: number | null
          actual_hours?: number | null
          assignee?: string
          client?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline: string
          description?: string | null
          estimated_hours?: number
          has_rework?: boolean
          id: string
          module?: string
          paused_at?: string | null
          recur_days_interval?: number | null
          recur_type?: string | null
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
          accumulated_minutes?: number | null
          actual_hours?: number | null
          assignee?: string
          client?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string
          description?: string | null
          estimated_hours?: number
          has_rework?: boolean
          id?: string
          module?: string
          paused_at?: string | null
          recur_days_interval?: number | null
          recur_type?: string | null
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
      weekly_reports: {
        Row: {
          client_id: string
          conclusion: string | null
          created_at: string
          created_by: string | null
          data_studio_url: string | null
          google_ads_investment: number
          id: string
          manager_analysis: string | null
          manual_content: string | null
          manual_mode: boolean
          meta_ads_investment: number
          overview_metrics: Json
          period_end: string
          period_start: string
          public_slug: string
          public_token: string
          published_at: string | null
          report_category: string | null
          report_type: string
          status: string
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          conclusion?: string | null
          created_at?: string
          created_by?: string | null
          data_studio_url?: string | null
          google_ads_investment?: number
          id?: string
          manager_analysis?: string | null
          manual_content?: string | null
          manual_mode?: boolean
          meta_ads_investment?: number
          overview_metrics?: Json
          period_end: string
          period_start: string
          public_slug?: string
          public_token?: string
          published_at?: string | null
          report_category?: string | null
          report_type?: string
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          conclusion?: string | null
          created_at?: string
          created_by?: string | null
          data_studio_url?: string | null
          google_ads_investment?: number
          id?: string
          manager_analysis?: string | null
          manual_content?: string | null
          manual_mode?: boolean
          meta_ads_investment?: number
          overview_metrics?: Json
          period_end?: string
          period_start?: string
          public_slug?: string
          public_token?: string
          published_at?: string | null
          report_category?: string | null
          report_type?: string
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_dispatch: { Args: { p_id: string }; Returns: undefined }
      create_report_client: {
        Args: {
          p_company: string
          p_meta_ads_account_id?: string
          p_name: string
          p_whatsapp?: string
        }
        Returns: string
      }
      delete_report: { Args: { p_id: string }; Returns: undefined }
      enqueue_report_dispatch: {
        Args: {
          p_channel?: string
          p_message: string
          p_phone: string
          p_report_id: string
          p_scheduled_at?: string
        }
        Returns: string
      }
      get_app_settings: { Args: never; Returns: Json }
      get_public_report: {
        Args: { p_slug: string; p_token: string }
        Returns: Json
      }
      has_reports_access: { Args: never; Returns: boolean }
      hide_report_client: { Args: { p_id: string }; Returns: undefined }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      list_due_dispatches: {
        Args: { p_limit?: number }
        Returns: {
          channel: string
          client_id: string
          id: string
          message: string
          phone: string
          report_id: string
        }[]
      }
      list_report_clients: {
        Args: never
        Returns: {
          company: string
          data_studio_urls: Json
          id: string
          meta_ads_account_id: string
          name: string
          reports_enabled: boolean
          whatsapp: string
        }[]
      }
      list_report_dispatches: {
        Args: { p_report_id: string }
        Returns: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string
          message: string
          phone: string
          scheduled_at: string
          sent_at: string
          status: string
        }[]
      }
      mark_dispatch_failed: {
        Args: { p_error: string; p_id: string; p_response?: Json }
        Returns: undefined
      }
      mark_dispatch_sent: {
        Args: { p_id: string; p_response?: Json }
        Returns: undefined
      }
      purge_old_reports: {
        Args: { p_dry_run?: boolean; p_keep_interval?: string }
        Returns: {
          cutoff_date: string
          deleted_campaigns: number
          deleted_dispatches: number
          deleted_reports: number
          deleted_tasks: number
          log_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      toggle_report_client_enabled: {
        Args: { p_enabled: boolean; p_id: string }
        Returns: undefined
      }
      trigger_weekly_reports_cron: { Args: never; Returns: number }
      unaccent: { Args: { "": string }; Returns: string }
      update_app_settings: {
        Args: {
          p_whatsapp_api_token: string
          p_whatsapp_api_url: string
          p_whatsapp_default_instance?: string
          p_whatsapp_default_template: string
        }
        Returns: undefined
      }
      update_report_client: {
        Args: {
          p_company: string
          p_data_studio_urls?: Json
          p_id: string
          p_meta_ads_account_id?: string
          p_name: string
          p_whatsapp?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      sm_ai_action_type:
        | "schedule_post"
        | "edit_post"
        | "cancel_post"
        | "suggest_slots"
        | "create_approval"
        | "update_status"
        | "generate_report"
        | "custom_command"
      sm_approval_status:
        | "aguardando"
        | "aprovado"
        | "reprovado"
        | "revisao_solicitada"
      sm_platform:
        | "instagram"
        | "facebook"
        | "linkedin"
        | "tiktok"
        | "youtube"
        | "twitter"
        | "pinterest"
        | "outro"
      sm_post_status:
        | "rascunho"
        | "agendado"
        | "publicado"
        | "pendente"
        | "atrasado"
        | "cancelado"
      sm_post_type:
        | "feed_foto"
        | "feed_video"
        | "reels"
        | "stories"
        | "carrossel"
        | "live"
        | "shorts"
        | "outro"
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
    Enums: {
      sm_ai_action_type: [
        "schedule_post",
        "edit_post",
        "cancel_post",
        "suggest_slots",
        "create_approval",
        "update_status",
        "generate_report",
        "custom_command",
      ],
      sm_approval_status: [
        "aguardando",
        "aprovado",
        "reprovado",
        "revisao_solicitada",
      ],
      sm_platform: [
        "instagram",
        "facebook",
        "linkedin",
        "tiktok",
        "youtube",
        "twitter",
        "pinterest",
        "outro",
      ],
      sm_post_status: [
        "rascunho",
        "agendado",
        "publicado",
        "pendente",
        "atrasado",
        "cancelado",
      ],
      sm_post_type: [
        "feed_foto",
        "feed_video",
        "reels",
        "stories",
        "carrossel",
        "live",
        "shorts",
        "outro",
      ],
    },
  },
} as const
