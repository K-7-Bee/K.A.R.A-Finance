
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accounts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"id": string,"is_archived": boolean,"name": string,"type": Database["public"]['Enums']["account_type"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"id"?: string,"is_archived"?: boolean,"name": string,"type": Database["public"]['Enums']["account_type"],"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"is_archived"?: boolean,"name"?: string,"type"?: Database["public"]['Enums']["account_type"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"after": Json | null,"before": Json | null,"id": number,"occurred_at": string,"reason": string | null,"row_id": string | null,"source": string | null,"table_name": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"id"?: never,"occurred_at"?: string,"reason"?: string | null,"row_id"?: string | null,"source"?: string | null,"table_name": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"id"?: never,"occurred_at"?: string,"reason"?: string | null,"row_id"?: string | null,"source"?: string | null,"table_name"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"id": string,"is_archived": boolean,"is_system": boolean,"kind": Database["public"]['Enums']["category_kind"],"name": string,"parent_id": string | null,"system_key": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_archived"?: boolean,"is_system"?: boolean,"kind": Database["public"]['Enums']["category_kind"],"name": string,"parent_id"?: string | null,"system_key"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_archived"?: boolean,"is_system"?: boolean,"kind"?: Database["public"]['Enums']["category_kind"],"name"?: string,"parent_id"?: string | null,"system_key"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_workspace_id_fkey"
      columns: ["parent_id","workspace_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "categories_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"currencies": {
                  Row: {
                    "code": string,"minor_unit": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"minor_unit": number
                  }
                  Update: {
                    "code"?: string,"minor_unit"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ledger_entries": {
                  Row: {
                    "account_id": string | null,"amount": number,"category_id": string | null,"currency": string,"id": number,"transaction_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount": number,"category_id"?: string | null,"currency": string,"id"?: never,"transaction_id": string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount"?: number,"category_id"?: string | null,"currency"?: string,"id"?: never,"transaction_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_account_id_workspace_id_currency_fkey"
      columns: ["account_id","workspace_id","currency"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","workspace_id","currency"]
    },{
      foreignKeyName: "ledger_entries_category_id_workspace_id_fkey"
      columns: ["category_id","workspace_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "ledger_entries_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ledger_entries_transaction_id_workspace_id_fkey"
      columns: ["transaction_id","workspace_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"amount": number,"category_id": string | null,"counter_account_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"description": string | null,"id": string,"merchant": string | null,"notes": string | null,"occurred_at": string,"source": Database["public"]['Enums']["transaction_source"],"status": Database["public"]['Enums']["transaction_status"],"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount": number,"category_id"?: string | null,"counter_account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"description"?: string | null,"id"?: string,"merchant"?: string | null,"notes"?: string | null,"occurred_at": string,"source"?: Database["public"]['Enums']["transaction_source"],"status"?: Database["public"]['Enums']["transaction_status"],"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string,"amount"?: number,"category_id"?: string | null,"counter_account_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"merchant"?: string | null,"notes"?: string | null,"occurred_at"?: string,"source"?: Database["public"]['Enums']["transaction_source"],"status"?: Database["public"]['Enums']["transaction_status"],"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_workspace_id_currency_fkey"
      columns: ["account_id","workspace_id","currency"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","workspace_id","currency"]
    },{
      foreignKeyName: "transactions_category_id_workspace_id_fkey"
      columns: ["category_id","workspace_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "transactions_counter_account_id_workspace_id_currency_fkey"
      columns: ["counter_account_id","workspace_id","currency"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","workspace_id","currency"]
    },{
      foreignKeyName: "transactions_currency_fkey"
      columns: ["currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "base_currency": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["workspace_kind"],"name": string,"owner_id": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_currency"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["workspace_kind"],"name": string,"owner_id": string,"timezone"?: string
                  }
                  Update: {
                    "base_currency"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["workspace_kind"],"name"?: string,"owner_id"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_base_currency_fkey"
      columns: ["base_currency"]
isOneToOne: false
      referencedRelation: "currencies"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "account_balances":
{ Args: { "p_as_of"?: string,"p_workspace_id": string }; Returns: {
              "account_id": string,"balance": number,"currency": string,"is_archived": boolean,"name": string,"type": Database["public"]['Enums']["account_type"]
            }[]
                           },
"category_totals":
{ Args: { "p_from_date": string,"p_to_date": string,"p_workspace_id": string }; Returns: {
              "category_id": string,"currency": string,"kind": Database["public"]['Enums']["category_kind"],"name": string,"total": number
            }[]
                           },
"create_account":
{ Args: { "p_currency"?: string,"p_name": string,"p_opening_balance"?: number,"p_opening_date"?: string,"p_type": Database["public"]['Enums']["account_type"],"p_workspace_id": string }; Returns: string
                           },
"ledger_integrity_check":
{ Args: { "p_workspace_id": string }; Returns: {
              "entry_count": number,"entry_sum": number,"transaction_id": string
            }[]
                           },
"period_totals":
{ Args: { "p_from_date": string,"p_to_date": string,"p_workspace_id": string }; Returns: {
              "currency": string,"expense": number,"income": number,"net": number
            }[]
                           },
"post_transaction":
{ Args: { "p": Json }; Returns: string
                           },
"reconcile_account":
{ Args: { "p_account_id": string,"p_actual_balance": number,"p_as_of"?: string }; Returns: string
                           },
"reconcile_account_on_date":
{ Args: { "p_account_id": string,"p_actual_balance": number,"p_date": string }; Returns: string
                           },
"set_opening_balance":
{ Args: { "p_account_id": string,"p_amount": number,"p_opening_date"?: string }; Returns: string
                           },
"update_transaction":
{ Args: { "p": Json,"p_id": string }; Returns: undefined
                           },
"void_transaction":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_type": "bank"|"cash"|"debit_card"|"credit_card"|"savings"|"investment","category_kind": "income"|"expense"|"equity","transaction_source": "manual"|"import"|"receipt"|"assistant"|"rule","transaction_status": "posted"|"void","transaction_type": "income"|"expense"|"transfer"|"opening_balance"|"adjustment","workspace_kind": "personal"|"business"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_type": ["bank", "cash", "debit_card", "credit_card", "savings", "investment"],"category_kind": ["income", "expense", "equity"],"transaction_source": ["manual", "import", "receipt", "assistant", "rule"],"transaction_status": ["posted", "void"],"transaction_type": ["income", "expense", "transfer", "opening_balance", "adjustment"],"workspace_kind": ["personal", "business"]
          }
        }
} as const
