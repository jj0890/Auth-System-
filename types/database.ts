// Hand-written types that mirror the Supabase schema.
// When you add columns, update these types too.
// Alternatively: run `supabase gen types typescript` to auto-generate.

export type ContributionType =
  | "Article"
  | "Mix"
  | "Interview"
  | "Feature"
  | "Photo essay";

export type UploadStatus = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clerk_id: string;
          email: string;
          display_name: string | null;
          handle: string | null;
          role_label: string | null;
          bio: string | null;
          avatar_url: string | null;
          links: { label: string; url: string }[];
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      profile_albums: {
        Row: {
          id: string;
          clerk_id: string;
          rank: number;
          mb_id: string;
          title: string;
          artist: string;
          year: string | null;
          cover_url: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profile_albums"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profile_albums"]["Insert"]>;
      };
      contributions: {
        Row: {
          id: string;
          author_id: string;
          type: ContributionType;
          title: string;
          url: string | null;
          is_external: boolean;
          published_at: string | null;
          approved: boolean;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contributions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["contributions"]["Insert"]>;
      };
      avatar_uploads: {
        Row: {
          id: string;
          clerk_id: string;
          storage_path: string;
          status: UploadStatus;
          flagged_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["avatar_uploads"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["avatar_uploads"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: string;
          action: string;
          actor_id: string | null;
          target_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at">;
        Update: never; // Audit log is append-only
      };
    };
  };
}
