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
      posts: {
        Row: {
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
          brief: string | null
          created_at: string
          id: string
          image_path: string
          name: string | null
          videos_generated: number
        }
        Insert: {
          brief?: string | null
          created_at?: string
          id?: string
          image_path: string
          name?: string | null
          videos_generated?: number
        }
        Update: {
          brief?: string | null
          created_at?: string
          id?: string
          image_path?: string
          name?: string | null
          videos_generated?: number
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          created_at: string
          enabled: boolean
          hour: number
          id: string
          minute: number
          platforms: string[]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          hour: number
          id?: string
          minute?: number
          platforms?: string[]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          hour?: number
          id?: string
          minute?: number
          platforms?: string[]
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
      [_ in never]: never
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
