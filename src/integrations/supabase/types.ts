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
      acl_rules: {
        Row: {
          action: string
          conditions: Json | null
          created_at: string
          created_by: string
          effect: string
          id: string
          organization_id: string
          resource_id: string | null
          resource_type: string
          target_team_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          action?: string
          conditions?: Json | null
          created_at?: string
          created_by: string
          effect?: string
          id?: string
          organization_id: string
          resource_id?: string | null
          resource_type: string
          target_team_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          conditions?: Json | null
          created_at?: string
          created_by?: string
          effect?: string
          id?: string
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          target_team_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acl_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_events: {
        Row: {
          all_day: boolean
          client_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          event_type: string
          id: string
          location: string | null
          metadata: Json | null
          organization_id: string
          participants: string[] | null
          priority: string
          process_id: string | null
          reminders: Json | null
          source: string
          start_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
          video_link: string | null
        }
        Insert: {
          all_day?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          metadata?: Json | null
          organization_id: string
          participants?: string[] | null
          priority?: string
          process_id?: string | null
          reminders?: Json | null
          source?: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          video_link?: string | null
        }
        Update: {
          all_day?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          metadata?: Json | null
          organization_id?: string
          participants?: string[] | null
          priority?: string
          process_id?: string | null
          reminders?: Json | null
          source?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          memory: Json | null
          model: string | null
          name: string
          organization_id: string
          run_count: number
          status: string
          system_prompt: string | null
          tools: Json | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          memory?: Json | null
          model?: string | null
          name: string
          organization_id: string
          run_count?: number
          status?: string
          system_prompt?: string | null
          tools?: Json | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          memory?: Json | null
          model?: string | null
          name?: string
          organization_id?: string
          run_count?: number
          status?: string
          system_prompt?: string | null
          tools?: Json | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_report_templates: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          organization_id: string
          prompt_template: string
          report_type: string
          sections: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          organization_id: string
          prompt_template: string
          report_type?: string
          sections?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          prompt_template?: string
          report_type?: string
          sections?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          data_snapshot: Json | null
          delivery_channel: string | null
          generated_at: string | null
          id: string
          is_scheduled: boolean
          organization_id: string
          recipients: string[] | null
          report_type: string
          scheduled_cron: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          data_snapshot?: Json | null
          delivery_channel?: string | null
          generated_at?: string | null
          id?: string
          is_scheduled?: boolean
          organization_id: string
          recipients?: string[] | null
          report_type?: string
          scheduled_cron?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          data_snapshot?: Json | null
          delivery_channel?: string | null
          generated_at?: string | null
          id?: string
          is_scheduled?: boolean
          organization_id?: string
          recipients?: string[] | null
          report_type?: string
          scheduled_cron?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_template_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          template_id: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          template_id: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          organization_id: string
          tags: string[] | null
          template_type: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          tags?: string[] | null
          template_type?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          tags?: string[] | null
          template_type?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      asset_history: {
        Row: {
          action: string
          asset_id: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          action: string
          asset_id: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          action?: string
          asset_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          acquired_at: string | null
          asset_type: string
          category: string
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          location: string | null
          metadata: Json | null
          name: string
          organization_id: string
          responsible_id: string | null
          status: string
          tags: string[] | null
          updated_at: string
          version: number
        }
        Insert: {
          acquired_at?: string | null
          asset_type?: string
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          name: string
          organization_id: string
          responsible_id?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          version?: number
        }
        Update: {
          acquired_at?: string | null
          asset_type?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          name?: string
          organization_id?: string
          responsible_id?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_id: string
          created_at: string
          details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          items_matched: number
          items_processed: number
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_matched?: number
          items_processed?: number
          organization_id: string
          started_at?: string
          status?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          items_matched?: number
          items_processed?: number
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          external_flow_id: string | null
          id: string
          last_run_at: string | null
          name: string
          organization_id: string
          run_count: number
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          external_flow_id?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          organization_id: string
          run_count?: number
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          external_flow_id?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          organization_id?: string
          run_count?: number
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_configs: {
        Row: {
          can_open_tickets: boolean
          can_query_processes: boolean
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          legal_areas: string[] | null
          name: string
          organization_id: string
          system_prompt: string | null
          tone: string
          updated_at: string
        }
        Insert: {
          can_open_tickets?: boolean
          can_query_processes?: boolean
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          legal_areas?: string[] | null
          name?: string
          organization_id: string
          system_prompt?: string | null
          tone?: string
          updated_at?: string
        }
        Update: {
          can_open_tickets?: boolean
          can_query_processes?: boolean
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          legal_areas?: string[] | null
          name?: string
          organization_id?: string
          system_prompt?: string | null
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversations: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          organization_id: string
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          organization_id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id: string
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          business_area: string | null
          client_type: string
          created_at: string
          document_number: string | null
          document_type: string
          email: string | null
          full_name: string
          id: string
          internal_notes: string | null
          organization_id: string
          phone: string | null
          responsible_id: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_area?: string | null
          client_type?: string
          created_at?: string
          document_number?: string | null
          document_type?: string
          email?: string | null
          full_name: string
          id?: string
          internal_notes?: string | null
          organization_id: string
          phone?: string | null
          responsible_id?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_area?: string | null
          client_type?: string
          created_at?: string
          document_number?: string | null
          document_type?: string
          email?: string | null
          full_name?: string
          id?: string
          internal_notes?: string | null
          organization_id?: string
          phone?: string | null
          responsible_id?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          channel: string
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          organization_id: string
          title: string
          updated_at: string
          updated_by: string | null
          variables: string[] | null
          version: number
        }
        Insert: {
          channel?: string
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          organization_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[] | null
          version?: number
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[] | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_consents: {
        Row: {
          client_id: string | null
          consent_type: string
          created_at: string
          created_by: string
          description: string | null
          granted_at: string
          id: string
          metadata: Json | null
          organization_id: string
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          consent_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          granted_at?: string
          id?: string
          metadata?: Json | null
          organization_id: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          consent_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          granted_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_incidents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          impact: string | null
          measures_taken: string | null
          notified_authority: boolean
          organization_id: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          measures_taken?: string | null
          notified_authority?: boolean
          organization_id: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          measures_taken?: string | null
          notified_authority?: boolean
          organization_id?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_policies: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          organization_id: string
          policy_type: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          organization_id: string
          policy_type?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          policy_type?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          accepted_terms: boolean
          contract_id: string
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          signature_url: string
          signed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_terms?: boolean
          contract_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          signature_url: string
          signed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_terms?: boolean
          contract_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          signature_url?: string
          signed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount_cents: number
          clauses: string | null
          client_id: string | null
          contract_type: string
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          payment_method: string | null
          periodicity: string | null
          process_id: string | null
          responsible_id: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          terms: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          clauses?: string | null
          client_id?: string | null
          contract_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          periodicity?: string | null
          process_id?: string | null
          responsible_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          terms?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          clauses?: string | null
          client_id?: string | null
          contract_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          periodicity?: string | null
          process_id?: string | null
          responsible_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          terms?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      court_integrations: {
        Row: {
          court_process_id: string | null
          court_system: string
          created_at: string
          id: string
          last_sync_at: string | null
          organization_id: string
          process_id: string
          status: string
          sync_config: Json | null
          updated_at: string
        }
        Insert: {
          court_process_id?: string | null
          court_system?: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          organization_id: string
          process_id: string
          status?: string
          sync_config?: Json | null
          updated_at?: string
        }
        Update: {
          court_process_id?: string | null
          court_system?: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          process_id?: string
          status?: string
          sync_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_integrations_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          due_time: string | null
          id: string
          notified: boolean
          organization_id: string | null
          priority: string
          process_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          due_time?: string | null
          id?: string
          notified?: boolean
          organization_id?: string | null
          priority?: string
          process_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          due_time?: string | null
          id?: string
          notified?: boolean
          organization_id?: string | null
          priority?: string
          process_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          template_id: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          template_id: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          organization_id: string
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          client_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          organization_id: string | null
          process_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          process_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          client_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          process_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      dsar_requests: {
        Row: {
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          organization_id: string
          request_type: string
          requester_email: string
          requester_name: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          request_type?: string
          requester_email: string
          requester_name: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          request_type?: string
          requester_email?: string
          requester_name?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsar_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsar_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_messages: {
        Row: {
          attachments: Json | null
          body: string
          channel: string
          client_id: string | null
          created_at: string
          direction: string
          external_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          process_id: string | null
          read_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          channel?: string
          client_id?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          process_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          process_id?: string | null
          read_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_messages_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_committees: {
        Row: {
          chair_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          members: string[] | null
          name: string
          organization_id: string
          purpose: string | null
          status: string
          updated_at: string
        }
        Insert: {
          chair_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          members?: string[] | null
          name: string
          organization_id: string
          purpose?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          chair_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          members?: string[] | null
          name?: string
          organization_id?: string
          purpose?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_committees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_decisions: {
        Row: {
          committee_id: string | null
          created_at: string
          created_by: string
          deadline: string | null
          decision_type: string
          description: string | null
          id: string
          implementation_notes: string | null
          meeting_id: string | null
          organization_id: string
          priority: string
          responsible_ids: string[] | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          committee_id?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          decision_type?: string
          description?: string | null
          id?: string
          implementation_notes?: string | null
          meeting_id?: string | null
          organization_id: string
          priority?: string
          responsible_ids?: string[] | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          committee_id?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          decision_type?: string
          description?: string | null
          id?: string
          implementation_notes?: string | null
          meeting_id?: string | null
          organization_id?: string
          priority?: string
          responsible_ids?: string[] | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_decisions_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "governance_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "governance_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_meetings: {
        Row: {
          attachments: Json | null
          attendees: string[] | null
          committee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          location: string | null
          meeting_date: string
          minutes: string | null
          organization_id: string
          status: string
          title: string
          updated_at: string
          video_link: string | null
        }
        Insert: {
          attachments?: Json | null
          attendees?: string[] | null
          committee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          minutes?: string | null
          organization_id: string
          status?: string
          title: string
          updated_at?: string
          video_link?: string | null
        }
        Update: {
          attachments?: Json | null
          attendees?: string[] | null
          committee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          minutes?: string | null
          organization_id?: string
          status?: string
          title?: string
          updated_at?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_meetings_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "governance_committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hearings: {
        Row: {
          created_at: string
          hearing_date: string
          hearing_type: string
          id: string
          location: string
          notes: string | null
          organization_id: string
          process_id: string
          responsible_id: string | null
          status: string
          updated_at: string
          user_id: string
          video_link: string | null
        }
        Insert: {
          created_at?: string
          hearing_date: string
          hearing_type?: string
          id?: string
          location: string
          notes?: string | null
          organization_id: string
          process_id: string
          responsible_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          video_link?: string | null
        }
        Update: {
          created_at?: string
          hearing_date?: string
          hearing_type?: string
          id?: string
          location?: string
          notes?: string | null
          organization_id?: string
          process_id?: string
          responsible_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hearings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hearings_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          court_system: string
          created_at: string
          id: string
          message: string | null
          movements_created: number | null
          movements_found: number | null
          organization_id: string
          process_id: string
          source: string | null
          status: string
          tribunal: string | null
        }
        Insert: {
          court_system?: string
          created_at?: string
          id?: string
          message?: string | null
          movements_created?: number | null
          movements_found?: number | null
          organization_id: string
          process_id: string
          source?: string | null
          status?: string
          tribunal?: string | null
        }
        Update: {
          court_system?: string
          created_at?: string
          id?: string
          message?: string | null
          movements_created?: number | null
          movements_found?: number | null
          organization_id?: string
          process_id?: string
          source?: string | null
          status?: string
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          integration_id: string
          organization_id: string
          records_synced: number | null
          started_at: string
          status: string
        }
        Insert: {
          action?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          integration_id: string
          organization_id: string
          records_synced?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          integration_id?: string
          organization_id?: string
          records_synced?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          config: Json | null
          created_at: string
          created_by: string
          credentials_encrypted: Json | null
          field_mapping: Json | null
          id: string
          last_sync_at: string | null
          name: string
          organization_id: string
          provider: string
          status: string
          sync_frequency: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          category?: string
          config?: Json | null
          created_at?: string
          created_by: string
          credentials_encrypted?: Json | null
          field_mapping?: Json | null
          id?: string
          last_sync_at?: string | null
          name: string
          organization_id: string
          provider: string
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          category?: string
          config?: Json | null
          created_at?: string
          created_by?: string
          credentials_encrypted?: Json | null
          field_mapping?: Json | null
          id?: string
          last_sync_at?: string | null
          name?: string
          organization_id?: string
          provider?: string
          status?: string
          sync_frequency?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          client_id: string | null
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_history: {
        Row: {
          id: string
          kpi_id: string
          notes: string | null
          organization_id: string
          recorded_at: string
          recorded_by: string | null
          value: number
        }
        Insert: {
          id?: string
          kpi_id: string
          notes?: string | null
          organization_id: string
          recorded_at?: string
          recorded_by?: string | null
          value: number
        }
        Update: {
          id?: string
          kpi_id?: string
          notes?: string | null
          organization_id?: string
          recorded_at?: string
          recorded_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_history_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          alert_threshold_critical: number | null
          alert_threshold_warning: number | null
          category: string
          created_at: string
          current_value: number
          data_source: string | null
          description: string | null
          frequency: string
          id: string
          metadata: Json | null
          metric_type: string
          name: string
          organization_id: string
          owner_id: string | null
          status: string
          target_value: number | null
          team_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          alert_threshold_critical?: number | null
          alert_threshold_warning?: number | null
          category?: string
          created_at?: string
          current_value?: number
          data_source?: string | null
          description?: string | null
          frequency?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          name: string
          organization_id: string
          owner_id?: string | null
          status?: string
          target_value?: number | null
          team_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          alert_threshold_critical?: number | null
          alert_threshold_warning?: number | null
          category?: string
          created_at?: string
          current_value?: number
          data_source?: string | null
          description?: string | null
          frequency?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          status?: string
          target_value?: number | null
          team_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_references: {
        Row: {
          category: string | null
          content: string | null
          court: string | null
          created_at: string
          decision_date: string | null
          folder: string | null
          id: string
          is_favorite: boolean
          notes: string | null
          organization_id: string
          reference_type: string
          source: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          court?: string | null
          created_at?: string
          decision_date?: string | null
          folder?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string | null
          organization_id: string
          reference_type?: string
          source?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string | null
          court?: string | null
          created_at?: string
          decision_date?: string | null
          folder?: string | null
          id?: string
          is_favorite?: boolean
          notes?: string | null
          organization_id?: string
          reference_type?: string
          source?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_references_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rule_logs: {
        Row: {
          channels_used: string[] | null
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          rule_id: string
          status: string
          trigger_data: Json | null
        }
        Insert: {
          channels_used?: string[] | null
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          rule_id: string
          status?: string
          trigger_data?: Json | null
        }
        Update: {
          channels_used?: string[] | null
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          rule_id?: string
          status?: string
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rule_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rule_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          actions: Json | null
          channels: string[] | null
          conditions: Json | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          template: string | null
          trigger_event: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          channels?: string[] | null
          conditions?: Json | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          template?: string | null
          trigger_event: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          channels?: string[] | null
          conditions?: Json | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          template?: string | null
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          organization_id: string | null
          read: boolean
          resource_id: string | null
          resource_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string | null
          read?: boolean
          resource_id?: string | null
          resource_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string | null
          read?: boolean
          resource_id?: string | null
          resource_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_results: {
        Row: {
          created_at: string
          current_value: number
          id: string
          metric_type: string
          notes: string | null
          okr_id: string
          organization_id: string
          responsible_id: string | null
          status: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          metric_type?: string
          notes?: string | null
          okr_id: string
          organization_id: string
          responsible_id?: string | null
          status?: string
          target_value?: number
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          metric_type?: string
          notes?: string | null
          okr_id?: string
          organization_id?: string
          responsible_id?: string | null
          status?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_key_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          organization_id: string
          owner_id: string
          parent_id: string | null
          period_end: string
          period_start: string
          progress: number
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          owner_id: string
          parent_id?: string | null
          period_end: string
          period_start: string
          progress?: number
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          parent_id?: string | null
          period_end?: string
          period_start?: string
          progress?: number
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okrs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_secrets: {
        Row: {
          allowed_users: string[] | null
          created_at: string
          created_by: string
          description: string | null
          encrypted_value: string
          expires_at: string | null
          id: string
          metadata: Json | null
          name: string
          organization_id: string
          rotated_at: string | null
          secret_type: string
          updated_at: string
          version: number
        }
        Insert: {
          allowed_users?: string[] | null
          created_at?: string
          created_by: string
          description?: string | null
          encrypted_value: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          organization_id: string
          rotated_at?: string | null
          secret_type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          allowed_users?: string[] | null
          created_at?: string
          created_by?: string
          description?: string | null
          encrypted_value?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          organization_id?: string
          rotated_at?: string | null
          secret_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_secrets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          ai_instructions: string | null
          ai_style: string | null
          created_at: string
          currency: string
          date_format: string
          email_signature: string | null
          id: string
          locale: string
          maintenance_admin_access: boolean
          maintenance_message: string | null
          maintenance_mode: boolean
          notification_events: Json
          notification_frequency: string
          notifications_external: boolean
          notifications_internal: boolean
          onboarding_completed: boolean
          onboarding_step: number
          organization_id: string
          sender_email: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          ai_instructions?: string | null
          ai_style?: string | null
          created_at?: string
          currency?: string
          date_format?: string
          email_signature?: string | null
          id?: string
          locale?: string
          maintenance_admin_access?: boolean
          maintenance_message?: string | null
          maintenance_mode?: boolean
          notification_events?: Json
          notification_frequency?: string
          notifications_external?: boolean
          notifications_internal?: boolean
          onboarding_completed?: boolean
          onboarding_step?: number
          organization_id: string
          sender_email?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          ai_instructions?: string | null
          ai_style?: string | null
          created_at?: string
          currency?: string
          date_format?: string
          email_signature?: string | null
          id?: string
          locale?: string
          maintenance_admin_access?: boolean
          maintenance_message?: string | null
          maintenance_mode?: boolean
          notification_events?: Json
          notification_frequency?: string
          notifications_external?: boolean
          notifications_internal?: boolean
          onboarding_completed?: boolean
          onboarding_step?: number
          organization_id?: string
          sender_email?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cancellation_requested_at: string | null
          created_at: string
          deleted_at: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          name: string
          plan: string
          razao_social: string | null
          responsavel_legal_cpf: string | null
          responsavel_legal_nome: string | null
          status: string
          tax_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancellation_requested_at?: string | null
          created_at?: string
          deleted_at?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          name: string
          plan?: string
          razao_social?: string | null
          responsavel_legal_cpf?: string | null
          responsavel_legal_nome?: string | null
          status?: string
          tax_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_requested_at?: string | null
          created_at?: string
          deleted_at?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          name?: string
          plan?: string
          razao_social?: string | null
          responsavel_legal_cpf?: string | null
          responsavel_legal_nome?: string | null
          status?: string
          tax_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ownership_transfers: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          organization_id: string
          responded_at: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          organization_id: string
          responded_at?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          organization_id?: string
          responded_at?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          external_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          method: string
          organization_id: string
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          method?: string
          organization_id: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          method?: string
          organization_id?: string
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          ai_explanation: string | null
          confidence_score: number | null
          created_at: string
          generated_at: string | null
          id: string
          input_data: Json | null
          organization_id: string
          prediction_type: string
          result: Json | null
          status: string
          target_id: string | null
          target_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_explanation?: string | null
          confidence_score?: number | null
          created_at?: string
          generated_at?: string | null
          id?: string
          input_data?: Json | null
          organization_id: string
          prediction_type?: string
          result?: Json | null
          status?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_explanation?: string | null
          confidence_score?: number | null
          created_at?: string
          generated_at?: string | null
          id?: string
          input_data?: Json | null
          organization_id?: string
          prediction_type?: string
          result?: Json | null
          status?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      process_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          organization_id: string
          parent_id: string | null
          process_id: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          organization_id: string
          parent_id?: string | null
          process_id: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          parent_id?: string | null
          process_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "process_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_chat_messages_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_movements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          movement_date: string
          movement_type: string
          organization_id: string
          origin: string
          process_id: string
          responsible_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          organization_id: string
          origin?: string
          process_id: string
          responsible_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          organization_id?: string
          origin?: string
          process_id?: string
          responsible_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_movements_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          archived: boolean
          assunto: string[] | null
          classe: string | null
          client_name: string
          court: string | null
          created_at: string
          description: string | null
          fase: string | null
          foro: string | null
          id: string
          judge: string | null
          notes: string | null
          number: string
          organization_id: string | null
          partes: Json | null
          responsible_id: string | null
          risk_level: string | null
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          user_id: string
          valor_causa: number | null
          vara: string | null
        }
        Insert: {
          archived?: boolean
          assunto?: string[] | null
          classe?: string | null
          client_name: string
          court?: string | null
          created_at?: string
          description?: string | null
          fase?: string | null
          foro?: string | null
          id?: string
          judge?: string | null
          notes?: string | null
          number: string
          organization_id?: string | null
          partes?: Json | null
          responsible_id?: string | null
          risk_level?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          valor_causa?: number | null
          vara?: string | null
        }
        Update: {
          archived?: boolean
          assunto?: string[] | null
          classe?: string | null
          client_name?: string
          court?: string | null
          created_at?: string
          description?: string | null
          fase?: string | null
          foro?: string | null
          id?: string
          judge?: string | null
          notes?: string | null
          number?: string
          organization_id?: string | null
          partes?: Json | null
          responsible_id?: string | null
          risk_level?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          valor_causa?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_organization_id: string | null
          avatar_url: string | null
          created_at: string
          email_notifications: boolean
          full_name: string | null
          id: string
          language: string
          notify_deadlines: boolean
          notify_documents: boolean
          notify_in_app: boolean
          phone: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_organization_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email_notifications?: boolean
          full_name?: string | null
          id?: string
          language?: string
          notify_deadlines?: boolean
          notify_documents?: boolean
          notify_in_app?: boolean
          phone?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_organization_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email_notifications?: boolean
          full_name?: string | null
          id?: string
          language?: string
          notify_deadlines?: boolean
          notify_documents?: boolean
          notify_in_app?: boolean
          phone?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          organization_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          organization_id: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "quick_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_task_subtasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          organization_id: string
          position: number
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          organization_id: string
          position?: number
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          organization_id?: string
          position?: number
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "quick_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_task_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_task_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          description: string | null
          done: boolean
          due_date: string | null
          id: string
          organization_id: string
          position: number
          priority: string
          process_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          organization_id: string
          position?: number
          priority?: string
          process_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          organization_id?: string
          position?: number
          priority?: string
          process_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          config: Json | null
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          organization_id: string
          report_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          organization_id: string
          report_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          organization_id?: string
          report_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_summary: string | null
          config: Json | null
          created_at: string
          file_url: string | null
          format: string
          generated_at: string | null
          id: string
          organization_id: string
          report_type: string
          result_data: Json | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          config?: Json | null
          created_at?: string
          file_url?: string | null
          format?: string
          generated_at?: string | null
          id?: string
          organization_id: string
          report_type?: string
          result_data?: Json | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          config?: Json | null
          created_at?: string
          file_url?: string | null
          format?: string
          generated_at?: string | null
          id?: string
          organization_id?: string
          report_type?: string
          result_data?: Json | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          impact: string
          mitigation_plan: string | null
          organization_id: string
          probability: string
          process_id: string | null
          resolved_at: string | null
          responsible_id: string | null
          risk_level: string
          risk_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          impact?: string
          mitigation_plan?: string | null
          organization_id: string
          probability?: string
          process_id?: string | null
          resolved_at?: string | null
          responsible_id?: string | null
          risk_level?: string
          risk_type?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          impact?: string
          mitigation_plan?: string | null
          organization_id?: string
          probability?: string
          process_id?: string | null
          resolved_at?: string | null
          responsible_id?: string | null
          risk_level?: string
          risk_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          secret_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          secret_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          secret_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secret_access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secret_access_logs_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "org_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          ip_address: string | null
          is_anomaly: boolean
          metadata: Json | null
          organization_id: string
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string | null
          resource_type: string | null
          severity: string
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          is_anomaly?: boolean
          metadata?: Json | null
          organization_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          is_anomaly?: boolean
          metadata?: Json | null
          organization_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          canceled_at: string | null
          completed_at: string | null
          contract_id: string | null
          created_at: string
          created_by: string
          description: string | null
          document_id: string | null
          external_key: string | null
          id: string
          metadata: Json | null
          organization_id: string
          provider: string
          reminder_sent_at: string | null
          signers: Json
          signing_order: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          document_id?: string | null
          external_key?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          provider?: string
          reminder_sent_at?: string | null
          signers?: Json
          signing_order?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          document_id?: string | null
          external_key?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          provider?: string
          reminder_sent_at?: string | null
          signers?: Json
          signing_order?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          max_resolution_hours: number | null
          max_response_hours: number | null
          name: string
          organization_id: string
          priority_filter: string | null
          resource_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_resolution_hours?: number | null
          max_response_hours?: number | null
          name: string
          organization_id: string
          priority_filter?: string | null
          resource_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_resolution_hours?: number | null
          max_response_hours?: number | null
          name?: string
          organization_id?: string
          priority_filter?: string | null
          resource_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_violations: {
        Row: {
          created_at: string
          exceeded_by_hours: number | null
          id: string
          organization_id: string
          resolved_at: string | null
          resource_id: string
          resource_type: string
          sla_policy_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          exceeded_by_hours?: number | null
          id?: string
          organization_id: string
          resolved_at?: string | null
          resource_id: string
          resource_type: string
          sla_policy_id: string
          violation_type?: string
        }
        Update: {
          created_at?: string
          exceeded_by_hours?: number | null
          id?: string
          organization_id?: string
          resolved_at?: string | null
          resource_id?: string
          resource_type?: string
          sla_policy_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_violations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_violations_sla_policy_id_fkey"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          leader_id: string | null
          legal_area: string | null
          name: string
          organization_id: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string | null
          legal_area?: string | null
          name: string
          organization_id: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string | null
          legal_area?: string | null
          name?: string
          organization_id?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          organization_id: string
          priority: string
          process_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          organization_id: string
          priority?: string
          process_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          organization_id?: string
          priority?: string
          process_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          client_id: string | null
          created_at: string
          date: string
          description: string | null
          duration_minutes: number
          end_time: string | null
          hourly_rate_cents: number
          id: string
          organization_id: string
          process_id: string | null
          start_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean
          client_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number
          end_time?: string | null
          hourly_rate_cents?: number
          id?: string
          organization_id: string
          process_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean
          client_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          duration_minutes?: number
          end_time?: string | null
          hourly_rate_cents?: number
          id?: string
          organization_id?: string
          process_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          accessibility: Json
          created_at: string
          id: string
          interface: Json
          notifications: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accessibility?: Json
          created_at?: string
          id?: string
          interface?: Json
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accessibility?: Json
          created_at?: string
          id?: string
          interface?: Json
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_access_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vault_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_access_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_documents: {
        Row: {
          access_level: string
          allowed_teams: string[] | null
          allowed_users: string[] | null
          category: string
          classification: string
          created_at: string
          description: string | null
          expires_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          metadata: Json | null
          organization_id: string
          tags: string[] | null
          title: string
          updated_at: string
          uploaded_by: string
          version: number
          view_only: boolean
        }
        Insert: {
          access_level?: string
          allowed_teams?: string[] | null
          allowed_users?: string[] | null
          category?: string
          classification?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          metadata?: Json | null
          organization_id: string
          tags?: string[] | null
          title: string
          updated_at?: string
          uploaded_by: string
          version?: number
          view_only?: boolean
        }
        Update: {
          access_level?: string
          allowed_teams?: string[] | null
          allowed_users?: string[] | null
          category?: string
          classification?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          uploaded_by?: string
          version?: number
          view_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vault_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contracts: {
        Row: {
          amount_cents: number
          auto_renew: boolean
          created_at: string
          created_by: string
          currency: string
          description: string | null
          end_date: string | null
          file_url: string | null
          id: string
          organization_id: string
          renewal_date: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount_cents?: number
          auto_renew?: boolean
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          organization_id: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount_cents?: number
          auto_renew?: boolean
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          business_area: string | null
          cnpj: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          rating: number | null
          responsible_id: string | null
          sla_terms: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          business_area?: string | null
          cnpj?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          rating?: number | null
          responsible_id?: string | null
          sla_terms?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          business_area?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          rating?: number | null
          responsible_id?: string | null
          sla_terms?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_article_versions: {
        Row: {
          article_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          version: number
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          version: number
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiki_article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "wiki_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_articles: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_published: boolean
          organization_id: string
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by: string
          id?: string
          is_published?: boolean
          organization_id: string
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_published?: boolean
          organization_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wiki_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "wiki_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wiki_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wiki_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wiki_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "wiki_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          context: Json | null
          created_at: string
          current_node: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          organization_id: string
          started_at: string
          status: string
          triggered_by: string
          workflow_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          current_node?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          organization_id: string
          started_at?: string
          status?: string
          triggered_by: string
          workflow_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          current_node?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          organization_id?: string
          started_at?: string
          status?: string
          triggered_by?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          edges: Json | null
          id: string
          name: string
          nodes: Json | null
          organization_id: string
          status: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          edges?: Json | null
          id?: string
          name: string
          nodes?: Json | null
          organization_id: string
          status?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          edges?: Json | null
          id?: string
          name?: string
          nodes?: Json | null
          organization_id?: string
          status?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_org_id: { Args: never; Returns: string }
      get_client_id_for_user: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      has_org_role: {
        Args: { _org_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "intern"
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
      app_role: ["admin", "user", "intern"],
    },
  },
} as const
