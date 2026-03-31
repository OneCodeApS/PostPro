export interface Collection {
  id: string
  company_id: string
  parent_collection_id: string | null
  name: string
  description: string | null
  environment_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Request {
  id: string
  collection_id: string
  name: string
  method: string
  url: string
  query_params: { key: string; value: string; enabled: boolean }[]
  headers: { key: string; value: string; enabled: boolean }[]
  body_type: string
  body: string | null
  sort_order: number
  schema: unknown | null
  schema_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Environment {
  id: string
  company_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface EnvironmentVariable {
  id: string
  environment_id: string
  key: string
  value: string | null
  is_secret: boolean
  enabled: boolean
  vault_secret_id: string | null
}

export interface AppUser {
  id: string
  display_name: string
  email: string
  current_company_id: string | null
  auth_user_id: string | null
  avatar_url: string | null
  job_roles: string[] | null
  created_at: string
}
