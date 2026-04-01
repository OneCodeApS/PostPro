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
    const { error } = await this.supabase.from('postpro_environments').delete().eq('id', id)

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

  async getResolvedVariables(environmentId: string): Promise<{ key: string; value: string }[]> {
    const vars = await this.getVariables(environmentId)
    const resolved: { key: string; value: string }[] = []
    for (const v of vars) {
      if (!v.enabled) continue
      if (v.is_secret && v.vault_secret_id) {
        try {
          const secret = await this.readVaultSecret(v.vault_secret_id)
          resolved.push({ key: v.key, value: secret })
        } catch {
          resolved.push({ key: v.key, value: '' })
        }
      } else {
        resolved.push({ key: v.key, value: v.value ?? '' })
      }
    }
    return resolved
  }

  async createVariable(
    variable: Pick<EnvironmentVariable, 'environment_id' | 'key'> &
      Partial<Pick<EnvironmentVariable, 'enabled' | 'value' | 'is_secret' | 'vault_secret_id'>>
  ): Promise<EnvironmentVariable> {
    const { data, error } = await this.supabase
      .from('postpro_environment_variables')
      .insert(variable)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateVariable(
    id: string,
    updates: Partial<Pick<EnvironmentVariable, 'key' | 'value' | 'is_secret' | 'enabled'>>
  ): Promise<EnvironmentVariable> {
    const { data, error } = await this.supabase
      .from('postpro_environment_variables')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteVariable(id: string): Promise<void> {
    // Get the variable first to check if it has a vault secret to clean up
    const { data: variable } = await this.supabase
      .from('postpro_environment_variables')
      .select('vault_secret_id')
      .eq('id', id)
      .single()

    const { error } = await this.supabase
      .from('postpro_environment_variables')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Clean up vault secret if it exists
    if (variable?.vault_secret_id) {
      await this.deleteVaultSecret(variable.vault_secret_id)
    }
  }

  async makeSecret(variableId: string, plainValue: string): Promise<void> {
    // Create vault secret
    const vaultId = await this.createVaultSecret(plainValue, `env_var_${variableId}`)
    // Update the variable: clear plaintext value, set vault reference
    const { error } = await this.supabase
      .from('postpro_environment_variables')
      .update({ value: null, is_secret: true, vault_secret_id: vaultId })
      .eq('id', variableId)

    if (error) throw error
  }

  async makePlain(variableId: string): Promise<void> {
    // Get current vault_secret_id
    const { data: variable, error: fetchError } = await this.supabase
      .from('postpro_environment_variables')
      .select('vault_secret_id')
      .eq('id', variableId)
      .single()

    if (fetchError) throw fetchError

    // Read the decrypted value from vault
    let plainValue = ''
    if (variable?.vault_secret_id) {
      plainValue = await this.readVaultSecret(variable.vault_secret_id)
    }

    // Update the variable: set plaintext value, clear vault reference
    const { error } = await this.supabase
      .from('postpro_environment_variables')
      .update({ value: plainValue, is_secret: false, vault_secret_id: null })
      .eq('id', variableId)

    if (error) throw error

    // Delete the vault secret
    if (variable?.vault_secret_id) {
      await this.deleteVaultSecret(variable.vault_secret_id)
    }
  }

  private async createVaultSecret(secret: string, name: string): Promise<string> {
    const { data, error } = await this.supabase.rpc('vault_create_secret', {
      secret,
      name
    })

    if (error) throw error
    return data as string
  }

  private async readVaultSecret(secretId: string): Promise<string> {
    const { data, error } = await this.supabase.rpc('vault_read_secret', {
      secret_id: secretId
    })

    if (error) throw error
    return (data as string) ?? ''
  }

  private async deleteVaultSecret(secretId: string): Promise<void> {
    const { error } = await this.supabase.rpc('vault_delete_secret', {
      secret_id: secretId
    })

    if (error) {
      console.error('Failed to delete vault secret:', error)
    }
  }
}
