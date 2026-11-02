// Public schema contract for supabase/migrations/20261101000000_initial_schema.sql.
// Regenerate after schema changes with `supabase gen types typescript --local`.
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
      establishments: {
        Row: {
          id: string;
          name: string;
          contact_name: string | null;
          phone: string | null;
          address: string | null;
          access_email: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string | null;
          phone?: string | null;
          address?: string | null;
          access_email: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_name?: string | null;
          phone?: string | null;
          address?: string | null;
          access_email?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: "admin" | "establishment";
          establishment_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role: "admin" | "establishment";
          establishment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: "admin" | "establishment";
          establishment_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: true;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          establishment_id: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          delivery_date: string;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
        };
        Insert: {
          id?: string;
          order_number?: never;
          establishment_id: string;
          quantity: number;
          unit_price?: number;
          total_price?: never;
          delivery_date: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
        };
        Update: {
          id?: string;
          order_number?: never;
          establishment_id?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: never;
          delivery_date?: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_establishment_id_fkey";
            columns: ["establishment_id"];
            isOneToOne: false;
            referencedRelation: "establishments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_establishment_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      create_order: {
        Args: {
          p_quantity: number;
          p_delivery_date: string;
          p_establishment_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      update_order: {
        Args: {
          p_order_id: string;
          p_quantity: number;
          p_delivery_date: string;
          p_notes?: string | null;
        };
        Returns: undefined;
      };
      cancel_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Establishment = Database["public"]["Tables"]["establishments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
