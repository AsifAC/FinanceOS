export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string | null;
          currency: string | null;
          onboarding_completed: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string | null;
          currency?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string | null;
          currency?: string | null;
          onboarding_completed?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          theme: string | null;
          accent_color: string | null;
          default_view: string | null;
          week_starts_on: string | null;
          month_start_day: number | null;
          number_format: string | null;
          currency: string | null;
          timezone: string | null;
          preview_mode_enabled: boolean | null;
          notifications_enabled: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string | null;
          accent_color?: string | null;
          default_view?: string | null;
          week_starts_on?: string | null;
          month_start_day?: number | null;
          number_format?: string | null;
          currency?: string | null;
          timezone?: string | null;
          preview_mode_enabled?: boolean | null;
          notifications_enabled?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: string | null;
          accent_color?: string | null;
          default_view?: string | null;
          week_starts_on?: string | null;
          month_start_day?: number | null;
          number_format?: string | null;
          currency?: string | null;
          timezone?: string | null;
          preview_mode_enabled?: boolean | null;
          notifications_enabled?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
export type UserPreferences =
  Database["public"]["Tables"]["user_preferences"]["Row"];
export type UserPreferencesInsert =
  Database["public"]["Tables"]["user_preferences"]["Insert"];
export type UserPreferencesUpdate =
  Database["public"]["Tables"]["user_preferences"]["Update"];
