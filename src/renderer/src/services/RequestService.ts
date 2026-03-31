import type { SupabaseClient } from '@supabase/supabase-js'
import type { Request } from '../types'

export class RequestService {
  constructor(private supabase: SupabaseClient) {}

  async getByCollection(collectionId: string): Promise<Request[]> {
    const { data, error } = await this.supabase
      .from('postpro_requests')
      .select('*')
      .eq('collection_id', collectionId)
      .order('sort_order')

    if (error) throw error
    return data
  }

  async getByCollections(collectionIds: string[]): Promise<Request[]> {
    if (collectionIds.length === 0) return []

    const { data, error } = await this.supabase
      .from('postpro_requests')
      .select('*')
      .in('collection_id', collectionIds)
      .order('sort_order')

    if (error) throw error
    return data
  }

  async create(
    request: Pick<Request, 'collection_id' | 'name'> &
      Partial<
        Pick<
          Request,
          'method' | 'url' | 'query_params' | 'headers' | 'body_type' | 'body' | 'sort_order'
        >
      >
  ): Promise<Request> {
    const { data, error } = await this.supabase
      .from('postpro_requests')
      .insert(request)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, updates: Partial<Omit<Request, 'id' | 'created_at'>>): Promise<Request> {
    const { data, error } = await this.supabase
      .from('postpro_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('postpro_requests').delete().eq('id', id)

    if (error) throw error
  }
}
