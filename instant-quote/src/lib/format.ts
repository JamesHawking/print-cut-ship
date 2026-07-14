// Presentation-only formatting helpers.

const pln = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
})

export function formatPln(amount: number): string {
  return pln.format(amount)
}

export function formatMm(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} mm`
}

export function formatDims(bbox: { x: number; y: number; z: number }): string {
  const f = (n: number) => n.toFixed(n < 10 ? 1 : 0)
  return `${f(bbox.x)} × ${f(bbox.y)} × ${f(bbox.z)} mm`
}

export function formatVolume(cm3: number): string {
  return `${cm3.toFixed(cm3 < 10 ? 2 : 1)} cm³`
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}
