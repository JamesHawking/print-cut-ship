import type { Part } from '@/hooks/useParts'

// Selection fallback for the quote workspace: an explicit user selection wins;
// otherwise prefer the first READY part so the right panel shows a price
// instead of a skeleton/error for a still-parsing last upload; otherwise the
// last part (all parsing) or null (empty).
export function pickSelectedPart(
  parts: Part[],
  selectedId: string | null,
): Part | null {
  return (
    parts.find((p) => p.id === selectedId) ??
    parts.find((p) => p.status === 'ready') ??
    parts.at(-1) ??
    null
  )
}
