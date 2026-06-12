export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          coordinates: unknown | null;
          parcel_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          coordinates?: unknown | null;
          parcel_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          address?: string;
          coordinates?: unknown | null;
          parcel_id?: string | null;
          created_at?: string;
        };
      };
      assessments: {
        Row: {
          id: string;
          property_id: string;
          status: string;
          overall_score: number | null;
          category_scores: Json | null;
          findings: Json | null;
          recommendations: Json | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          property_id: string;
          status?: string;
          overall_score?: number | null;
          category_scores?: Json | null;
          findings?: Json | null;
          recommendations?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          property_id?: string;
          status?: string;
          overall_score?: number | null;
          category_scores?: Json | null;
          findings?: Json | null;
          recommendations?: Json | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      assessment_photos: {
        Row: {
          id: string;
          assessment_id: string;
          storage_path: string;
          category: string | null;
          analysis_results: Json | null;
          coordinates: unknown | null;
          captured_at: string;
          training_consent: boolean | null;
          hazard_tags: string[] | null;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          storage_path: string;
          category?: string | null;
          analysis_results?: Json | null;
          coordinates?: unknown | null;
          captured_at?: string;
          training_consent?: boolean | null;
          hazard_tags?: string[] | null;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          storage_path?: string;
          category?: string | null;
          analysis_results?: Json | null;
          coordinates?: unknown | null;
          captured_at?: string;
          training_consent?: boolean | null;
          hazard_tags?: string[] | null;
        };
      };
      map_annotations: {
        Row: {
          id: string;
          assessment_id: string;
          coordinates: unknown;
          annotation_type: string;
          content: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          coordinates: unknown;
          annotation_type: string;
          content: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          coordinates?: unknown;
          annotation_type?: string;
          content?: Json;
          created_at?: string;
        };
      };
      shared_reports: {
        Row: {
          id: string;
          assessment_id: string;
          share_type: string;
          recipient_email: string | null;
          access_token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          share_type: string;
          recipient_email?: string | null;
          access_token: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          share_type?: string;
          recipient_email?: string | null;
          access_token?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
      training_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          completed: boolean;
          quiz_score: number | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          completed?: boolean;
          quiz_score?: number | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string;
          completed?: boolean;
          quiz_score?: number | null;
          completed_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
