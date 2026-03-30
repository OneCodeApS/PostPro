# PostPro - Style Guide

## Color System

The project uses custom Tailwind CSS theme colors with the `op-` prefix:

```css
--color-op-primary: #175673;
--color-op-secondary: #4C2878;
--color-op-tertiary: #1B5E3B;
--color-op-error: #B91C1C;
--color-op-success: #15803D;
--color-op-warning: #B45309;
--color-op-disabled: #6B7280;
```

### Color Roles

| Token | Hex | Role |
|-------|-----|------|
| `op-primary` | `#175673` | Main actions, brand identity |
| `op-secondary` | `#4C2878` | Secondary actions, accents |
| `op-tertiary` | `#1B5E3B` | Supporting UI, tags, badges |
| `op-error` | `#B91C1C` | Errors, destructive actions |
| `op-success` | `#15803D` | Confirmations, completed states |
| `op-warning` | `#B45309` | Warnings, caution states |
| `op-disabled` | `#6B7280` | Disabled elements, placeholders |

## Buttons

Use the reusable `<Button>` component from `components/Button.tsx`. Do not use raw `<button>` elements.

```tsx
import { Button } from './components/Button'
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'success'` | `'primary'` | Color variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `disabled` | `boolean` | `false` | Disabled state (auto-styled) |
| `className` | `string` | `''` | Additional classes for one-off overrides |
| `...props` | `ButtonHTMLAttributes` | — | All standard button attributes |

### Sizes

| Size | Padding | Usage |
|------|---------|-------|
| `sm` | `px-3 py-1.5 text-sm` | Inline actions, table rows |
| `md` | `px-5 py-2.5` | Standard actions |
| `lg` | `px-7 py-3.5 text-lg` | Hero CTAs, prominent actions |

### Variants

| Variant | Color | Usage |
|---------|-------|-------|
| `primary` | `op-primary` | Main actions (submit, save, sign in) |
| `secondary` | `op-secondary` | Secondary actions (sign out, cancel) |
| `danger` | `op-error` | Destructive actions (delete, remove) |
| `success` | `op-success` | Confirmations (approve, complete) |

Disabled buttons automatically use `op-disabled` with `cursor-not-allowed` and `opacity-60`.

### Examples

```tsx
{/* Primary default */}
<Button onClick={handleSave}>Save</Button>

{/* Secondary small */}
<Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>

{/* Danger large */}
<Button variant="danger" size="lg" onClick={handleDelete}>Delete Account</Button>

{/* Disabled */}
<Button disabled>Submit</Button>
```
