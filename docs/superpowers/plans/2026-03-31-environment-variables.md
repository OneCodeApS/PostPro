# Environment Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display and manage environment variables in the detail panel when an environment is selected, with plaintext storage for non-secret values and Vault for secrets.

**Architecture:** Add `value` and `is_secret` columns to `postpro_environment_variables`. Build an `EnvironmentDetail` component in column 3 that shows a key-value table with inline editing. Non-secret values display plaintext; secret values display masked dots. The detail panel routes between request detail and environment detail based on selection state.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Supabase

---

### Task 1: Database Schema Migration

**Files:**
- Reference: `docs/superpowers/plans/2026-03-31-environment-variables.md` (this file)

- [ ] **Step 1: Run migration in Supabase**

Execute this SQL in the Supabase SQL Editor:

```sql
ALTER TABLE public.postpro_environment_variables
  ADD COLUMN value text,
  ADD COLUMN is_secret boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Verify migration**

Run in Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'postpro_environment_variables'
ORDER BY ordinal_position;
```

Expected: `value` (text, nullable) and `is_secret` (boolean, NOT NULL, default false) columns present.

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/renderer/src/types/index.ts`

- [ ] **Step 1: Add new fields to EnvironmentVariable type**

```typescript
export interface EnvironmentVariable {
  id: string
  environment_id: string
  key: string
  value: string | null
  is_secret: boolean
  enabled: boolean
  vault_secret_id: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/types/index.ts
git commit -m "feat: add value and is_secret fields to EnvironmentVariable type"
```

---

### Task 3: Update EnvironmentService

**Files:**
- Modify: `src/renderer/src/services/EnvironmentService.ts`

- [ ] **Step 1: Update createVariable to accept value and is_secret**

Replace the `createVariable` method:

```typescript
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
```

- [ ] **Step 2: Add updateVariable method**

Add after `createVariable`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/services/EnvironmentService.ts
git commit -m "feat: update EnvironmentService with value/is_secret support and updateVariable method"
```

---

### Task 4: Build EnvironmentDetail Component

**Files:**
- Create: `src/renderer/src/components/environments/EnvironmentDetail.tsx`

This component shows all variables for a selected environment as an editable table. Non-secret values are shown as plaintext inputs. Secret values show `••••••••`.

- [ ] **Step 1: Create EnvironmentDetail component**

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { EnvironmentService } from '../../services/EnvironmentService'
import type { Environment, EnvironmentVariable } from '../../types'

const environmentService = new EnvironmentService(supabase)

interface EnvironmentDetailProps {
  environment: Environment
}

export function EnvironmentDetail({ environment }: EnvironmentDetailProps): React.JSX.Element {
  const [variables, setVariables] = useState<EnvironmentVariable[]>([])
  const [loading, setLoading] = useState(true)

  async function loadVariables(): Promise<void> {
    const vars = await environmentService.getVariables(environment.id)
    setVariables(vars)
    setLoading(false)
  }

  useEffect(() => {
    void (async () => {
      await loadVariables()
    })()
  }, [environment.id])

  async function handleAddVariable(): Promise<void> {
    await environmentService.createVariable({
      environment_id: environment.id,
      key: '',
      value: '',
      is_secret: false
    })
    await loadVariables()
  }

  async function handleUpdateVariable(
    id: string,
    updates: Partial<Pick<EnvironmentVariable, 'key' | 'value' | 'is_secret' | 'enabled'>>
  ): Promise<void> {
    await environmentService.updateVariable(id, updates)
    await loadVariables()
  }

  async function handleDeleteVariable(id: string): Promise<void> {
    await environmentService.deleteVariable(id)
    await loadVariables()
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-sm font-semibold text-white">{environment.name}</h2>
        <button
          onClick={handleAddVariable}
          className="rounded bg-op-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-op-primary/80"
        >
          Add Variable
        </button>
      </div>

      {/* Variable table */}
      <div className="flex-1 overflow-y-auto">
        {variables.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-white/40">
            No variables yet. Click "Add Variable" to create one.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/50">
                <th className="px-6 py-2 font-medium">Key</th>
                <th className="px-6 py-2 font-medium">Value</th>
                <th className="px-6 py-2 font-medium w-20">Secret</th>
                <th className="px-6 py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <VariableRow
                  key={v.id}
                  variable={v}
                  onUpdate={(updates) => handleUpdateVariable(v.id, updates)}
                  onDelete={() => handleDeleteVariable(v.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function VariableRow({
  variable,
  onUpdate,
  onDelete
}: {
  variable: EnvironmentVariable
  onUpdate: (updates: Partial<Pick<EnvironmentVariable, 'key' | 'value' | 'is_secret' | 'enabled'>>) => void
  onDelete: () => void
}): React.JSX.Element {
  const [key, setKey] = useState(variable.key)
  const [value, setValue] = useState(variable.value ?? '')

  function handleKeyBlur(): void {
    if (key !== variable.key) onUpdate({ key })
  }

  function handleValueBlur(): void {
    if (value !== (variable.value ?? '')) onUpdate({ value })
  }

  return (
    <tr className="group border-b border-white/5">
      <td className="px-6 py-1.5">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={handleKeyBlur}
          placeholder="KEY"
          className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
        />
      </td>
      <td className="px-6 py-1.5">
        {variable.is_secret ? (
          <span className="text-sm text-white/40">••••••••</span>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleValueBlur}
            placeholder="value"
            className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
          />
        )}
      </td>
      <td className="px-6 py-1.5">
        <button
          onClick={() => onUpdate({ is_secret: !variable.is_secret })}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            variable.is_secret
              ? 'bg-op-warning/20 text-op-warning'
              : 'bg-white/10 text-white/50'
          }`}
        >
          {variable.is_secret ? 'secret' : 'plain'}
        </button>
      </td>
      <td className="px-6 py-1.5">
        <button
          onClick={onDelete}
          className="text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-op-error"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/environments/EnvironmentDetail.tsx
git commit -m "feat: add EnvironmentDetail component with variable table"
```

---

### Task 5: Wire DetailPanel to Show EnvironmentDetail

**Files:**
- Modify: `src/renderer/src/components/DetailPanel.tsx`
- Modify: `src/renderer/src/App.tsx`

The DetailPanel currently shows a static placeholder. It needs to accept the selected environment (or request) and render the appropriate detail view.

- [ ] **Step 1: Update DetailPanel to accept and render environment detail**

Replace `src/renderer/src/components/DetailPanel.tsx`:

```tsx
import { EnvironmentDetail } from './environments/EnvironmentDetail'
import type { Environment, Request } from '../types'

interface DetailPanelProps {
  selectedEnvironment: Environment | null
  selectedRequest: Request | null
}

export function DetailPanel({
  selectedEnvironment,
  selectedRequest
}: DetailPanelProps): React.JSX.Element {
  if (selectedEnvironment) {
    return <EnvironmentDetail environment={selectedEnvironment} />
  }

  if (selectedRequest) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Request detail coming soon
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-white/30">
      Select a request or environment to view details
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx to pass selection state to DetailPanel**

In `src/renderer/src/App.tsx`, change the DetailPanel usage from:

```tsx
<DetailPanel />
```

to:

```tsx
<DetailPanel
  selectedEnvironment={activePage === 'environments' ? selectedEnvironment : null}
  selectedRequest={activePage === 'endpoints' ? selectedRequest : null}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/DetailPanel.tsx src/renderer/src/App.tsx
git commit -m "feat: wire DetailPanel to show EnvironmentDetail when environment selected"
```

---

### Task 6: Fix EnvironmentsPanel useEffect (React 19 Compliance)

**Files:**
- Modify: `src/renderer/src/components/environments/EnvironmentsPanel.tsx`

Same React 19 issue as EndpointsPanel — `load()` called directly in useEffect.

- [ ] **Step 1: Wrap load() in async IIFE**

Change:

```tsx
useEffect(() => {
  const envService = new EnvironmentService(supabase)

  async function load(): Promise<void> {
    const envs = await envService.getAll(companyId)
    setEnvironments(envs)
    setLoading(false)
  }

  load()
}, [companyId])
```

to:

```tsx
useEffect(() => {
  const envService = new EnvironmentService(supabase)

  void (async () => {
    const envs = await envService.getAll(companyId)
    setEnvironments(envs)
    setLoading(false)
  })()
}, [companyId])
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/environments/EnvironmentsPanel.tsx
git commit -m "fix: wrap EnvironmentsPanel useEffect in async IIFE for React 19"
```
