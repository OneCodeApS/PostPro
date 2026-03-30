import type { SupabaseClient } from '@supabase/supabase-js'
import type { Environment, EnvironmentVariable } from '../types'

export class EnvironmentService {
  constructor(private supabase: SupabaseClient) {}

  async getAll(companyId: string): Promise<Environment[]> {
    const { data, error } = await this.supabase
      .from('postpro_environments')
      .select('*')
      .eq('company_id', companyId)
      .order('name')

    if (error) throw error
    return data
  }

  async create(environment: Pick<Environment, 'company_id' | 'name'>): Promise<Environment> {
    const { data, error } = await this.supabase
      .from('postpro_environments')
      .insert(environment)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, updates: Partial<Pick<Environment, 'name'>>): Promise<Environment> {
    const { data, error } = await this.supabase
      .from('postpro_environments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('postpro_environments')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getVariables(environmentId: string): Promise<EnvironmentVariable[]> {
    const { data, error } = await this.supabase
      .from('postpro_environment_variables')
      .select('*')
      .eq('environment_id', environmentId)

    if (error) throw error
    return data
  }

  async createVariable(
    variable: Pick<EnvironmentVariable, 'environment_id' | 'key' | 'vault_secret_id'> &
      Partial<Pick<EnvironmentVariable, 'enabled'>>
  ): Promise<EnvironmentVariable> {
    const { data, error } = await this.supabase
      .from('postpro_environment_variables')
      .insert(variable)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteVariable(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('postpro_environment_variables')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
