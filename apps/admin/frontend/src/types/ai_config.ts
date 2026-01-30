/**
 * AI Configuration types for the admin frontend.
 */

export interface AIProvider {
  id: string
  name: string
  display_name: string
  api_key_env_var: string
  base_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AIModel {
  id: string
  provider_id: string
  provider_name: string
  model_id: string
  display_name: string
  capabilities: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AIUseCaseConfig {
  id: string
  use_case: string
  description: string | null
  model_id: string | null
  model_name: string | null
  provider_name: string | null
  max_tokens: number
  temperature: number
  is_active: boolean
}

export interface AIProviderListResponse {
  providers: AIProvider[]
  total: number
}

export interface AIModelListResponse {
  models: AIModel[]
  total: number
}

export interface AIUseCaseConfigListResponse {
  use_cases: AIUseCaseConfig[]
  total: number
}

export interface AIProviderCreate {
  name: string
  display_name: string
  api_key_env_var: string
  base_url?: string
  is_active?: boolean
}

export interface AIProviderUpdate {
  display_name?: string
  api_key_env_var?: string
  base_url?: string
  is_active?: boolean
}

export interface AIModelCreate {
  provider_id: string
  model_id: string
  display_name: string
  capabilities?: string[]
  is_active?: boolean
}

export interface AIModelUpdate {
  display_name?: string
  capabilities?: string[]
  is_active?: boolean
}

export interface AIUseCaseConfigCreate {
  use_case: string
  description?: string
  model_id: string
  max_tokens?: number
  temperature?: number
  is_active?: boolean
}

export interface AIUseCaseConfigUpdate {
  description?: string
  model_id?: string
  max_tokens?: number
  temperature?: number
  is_active?: boolean
}
