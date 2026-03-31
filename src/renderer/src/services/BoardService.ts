import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoardWithWorkspace } from '../types'

export class BoardService {
  constructor(private supabase: SupabaseClient) {}

  async search(query: string): Promise<BoardWithWorkspace[]> {
    const { data, error } = await this.supabase
      .from('boards')
      .select('id, name, workspace_id, archived, created_at, workspaces!fk_workspace(name)')
      .eq('archived', false)
      .ilike('name', `%${query}%`)
      .limit(20)

    if (error) {
      console.error('[BoardService] search error:', error)
      return []
    }
    return (data ?? []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      name: b.name as string,
      workspace_id: b.workspace_id as string,
      archived: b.archived as boolean,
      created_at: b.created_at as string,
      workspace_name: (b.workspaces as { name: string })?.name ?? ''
    }))
  }

  async getLinkedBoards(requestId: string): Promise<BoardWithWorkspace[]> {
    const { data, error } = await this.supabase
      .from('postpro_request_boards')
      .select('board_id, boards(id, name, workspace_id, archived, created_at, workspaces!fk_workspace(name))')
      .eq('request_id', requestId)

    if (error) {
      console.error('[BoardService] getLinkedBoards error:', error)
      return []
    }
    return (data ?? []).map((row: Record<string, unknown>) => {
      const b = row.boards as Record<string, unknown>
      return {
        id: b.id as string,
        name: b.name as string,
        workspace_id: b.workspace_id as string,
        archived: b.archived as boolean,
        created_at: b.created_at as string,
        workspace_name: (b.workspaces as { name: string })?.name ?? ''
      }
    })
  }

  async linkBoard(requestId: string, boardId: string): Promise<void> {
    const { error } = await this.supabase
      .from('postpro_request_boards')
      .insert({ request_id: requestId, board_id: boardId })

    if (error) throw error
  }

  async unlinkBoard(requestId: string, boardId: string): Promise<void> {
    const { error } = await this.supabase
      .from('postpro_request_boards')
      .delete()
      .eq('request_id', requestId)
      .eq('board_id', boardId)

    if (error) throw error
  }
}
