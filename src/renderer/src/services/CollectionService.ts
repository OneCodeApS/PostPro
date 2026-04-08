import type { SupabaseClient } from '@supabase/supabase-js'
import type { Collection } from '../types'

export class CollectionService {
  constructor(private supabase: SupabaseClient) {}

  async getAll(companyId: string): Promise<Collection[]> {
    const { data, error } = await this.supabase
      .from('postpro_collections')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at')

    if (error) throw error
    return data
  }

  async create(
    collection: Pick<Collection, 'company_id' | 'name'> &
      Partial<
        Pick<Collection, 'description' | 'parent_collection_id' | 'environment_id' | 'created_by'>
      >
  ): Promise<Collection> {
    const { data, error } = await this.supabase
      .from('postpro_collections')
      .insert(collection)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(
    id: string,
    updates: Partial<Pick<Collection, 'name' | 'description' | 'environment_id' | 'parent_collection_id'>>
  ): Promise<Collection> {
    const { data, error } = await this.supabase
      .from('postpro_collections')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('postpro_collections').delete().eq('id', id)

    if (error) throw error
  }
}
