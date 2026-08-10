export interface ScannedFood {
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}

const round1 = (n: unknown) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 10) / 10 : 0)

/**
 * Looks up a product barcode on Open Food Facts.
 * Returns null when the product is not in their database.
 * Throws on network/server errors so callers can show a retry state.
 */
export async function lookupBarcode(barcode: string): Promise<ScannedFood | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GymTracker/1.0 (stefan.apostolovski97@gmail.com)' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts responded with ${res.status}`)

  const json = await res.json()
  if (json.status === 0 || !json.product) return null

  const p = json.product
  const n = p.nutriments ?? {}
  const name = [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' — ')
  return {
    name: name || `Product ${barcode}`,
    calories_per_100g: round1(n['energy-kcal_100g']),
    protein_per_100g: round1(n['proteins_100g']),
    carbs_per_100g: round1(n['carbohydrates_100g']),
    fat_per_100g: round1(n['fat_100g']),
    fiber_per_100g: round1(n['fiber_100g']),
  }
}
