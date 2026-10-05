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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          label: string | null
          max_uses: number
          months: number
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          months?: number
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          months?: number
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      activations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          license_token: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          license_token: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          license_token?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      code_redemptions: {
        Row: {
          code: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      posts: {
        Row: {
          owner_user_id: string | null
          caption_instagram: string | null
          caption_tiktok: string | null
          created_at: string
          error: string | null
          generation_prompt: string | null
          generation_status: string | null
          id: string
          ig_post_id: string | null
          kling_task_id: string | null
          notes: string | null
          platforms: string[]
          posted_at: string | null
          scheduled_for: string | null
          source_image_path: string | null
          status: string
          tiktok_post_id: string | null
          vibe_id: string | null
          vibe_name: string | null
          video_path: string
        }
        Insert: {
          owner_user_id?: string | null
          caption_instagram?: string | null
          caption_tiktok?: string | null
          created_at?: string
          error?: string | null
          generation_prompt?: string | null
          generation_status?: string | null
          id?: string
          ig_post_id?: string | null
          kling_task_id?: string | null
          notes?: string | null
          platforms?: string[]
          posted_at?: string | null
          scheduled_for?: string | null
          source_image_path?: string | null
          status?: string
          tiktok_post_id?: string | null
          vibe_id?: string | null
          vibe_name?: string | null
          video_path: string
        }
        Update: {
          owner_user_id?: string | null
          caption_instagram?: string | null
          caption_tiktok?: string | null
          created_at?: string
          error?: string | null
          generation_prompt?: string | null
          generation_status?: string | null
          id?: string
          ig_post_id?: string | null
          kling_task_id?: string | null
          notes?: string | null
          platforms?: string[]
          posted_at?: string | null
          scheduled_for?: string | null
          source_image_path?: string | null
          status?: string
          tiktok_post_id?: string | null
          vibe_id?: string | null
          vibe_name?: string | null
          video_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_vibe_id_fkey"
            columns: ["vibe_id"]
            isOneToOne: false
            referencedRelation: "vibes"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          owner_user_id: string | null
          brief: string | null
          created_at: string
          id: string
          image_path: string
          name: string | null
          videos_generated: number
        }
        Insert: {
          owner_user_id?: string | null
          brief?: string | null
          created_at?: string
          id?: string
          image_path: string
          name?: string | null
          videos_generated?: number
        }
        Update: {
          owner_user_id?: string | null
          brief?: string | null
          created_at?: string
          id?: string
          image_path?: string
          name?: string | null
          videos_generated?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      saved_prompts: {
        Row: {
          owner_user_id: string | null
          created_at: string
          duration: number
          id: string
          last_used_at: string | null
          prompt: string
          title: string
          updated_at: string
          use_count: number
          vibe_id: string | null
        }
        Insert: {
          owner_user_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          last_used_at?: string | null
          prompt: string
          title: string
          updated_at?: string
          use_count?: number
          vibe_id?: string | null
        }
        Update: {
          owner_user_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          last_used_at?: string | null
          prompt?: string
          title?: string
          updated_at?: string
          use_count?: number
          vibe_id?: string | null
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          owner_user_id: string | null
          created_at: string
          enabled: boolean
          hour: number
          id: string
          minute: number
          platforms: string[]
        }
        Insert: {
          owner_user_id?: string | null
          created_at?: string
          enabled?: boolean
          hour: number
          id?: string
          minute?: number
          platforms?: string[]
        }
        Update: {
          owner_user_id?: string | null
          created_at?: string
          enabled?: boolean
          hour?: number
          id?: string
          minute?: number
          platforms?: string[]
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_paid_cents: number | null
          current_period_end: string | null
          currency: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid_cents?: number | null
          current_period_end?: string | null
          currency?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid_cents?: number | null
          current_period_end?: string | null
          currency?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: { event_id: string; event_type: string; received_at: string }
        Insert: { event_id: string; event_type: string; received_at?: string }
        Update: { event_id?: string; event_type?: string; received_at?: string }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vibes: {
        Row: {
          caption_tone: string
          created_at: string
          id: string
          music_mood: string | null
          name: string
          prompt_style: string
          weight: number
        }
        Insert: {
          caption_tone: string
          created_at?: string
          id?: string
          music_mood?: string | null
          name: string
          prompt_style: string
          weight?: number
        }
        Update: {
          caption_tone?: string
          created_at?: string
          id?: string
          music_mood?: string | null
          name?: string
          prompt_style?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "member"],
    },
  },
} as const
