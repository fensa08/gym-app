import type { Food, NutritionLog } from '../types'

function formatMacros(p: number, c: number, f: number): string {
  return `${Math.round(p)}p/${Math.round(c)}c/${Math.round(f)}f`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function buildFoodMarkdown(
  logs: NutritionLog[],
  foods: Food[],
  range: { start: string; end: string }
): string {
  const lines: string[] = []

  lines.push('# Food Log Export')
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} · ${range.start} to ${range.end} · ${logs.length} day${logs.length === 1 ? '' : 's'} logged`)
  lines.push('')

  for (const log of logs) {
    lines.push(`## ${formatDate(log.date)}`)
    const totalsParts = [
      log.calories != null ? `**${log.calories.toLocaleString()} kcal**` : null,
      log.protein_g != null ? `${log.protein_g}g protein` : null,
      log.carbs_g != null ? `${log.carbs_g}g carbs` : null,
      log.fat_g != null ? `${log.fat_g}g fat` : null,
      log.fiber_g != null ? `${log.fiber_g}g fiber` : null,
      log.water_ml != null ? `${log.water_ml}ml water` : null,
    ].filter(Boolean)
    if (totalsParts.length > 0) lines.push(totalsParts.join(' · '))
    lines.push('')

    for (const meal of log.meals) {
      lines.push(`### ${meal.name}`)
      for (const item of meal.items) {
        const portion = item.grams > 0 ? ` (${item.grams}g)` : ''
        lines.push(`- ${item.food_name}${portion} — ${Math.round(item.calories)} kcal, ${formatMacros(item.protein_g, item.carbs_g, item.fat_g)}`)
      }
      lines.push('')
    }

    if (log.notes) {
      lines.push(`_Notes: ${log.notes}_`)
      lines.push('')
    }
  }

  if (foods.length > 0) {
    lines.push('## Appendix: Food Library')
    lines.push('')
    lines.push('| Food | Calories/100g | Protein/100g | Carbs/100g | Fat/100g | Fiber/100g |')
    lines.push('|---|---|---|---|---|---|')
    for (const f of foods) {
      lines.push(
        `| ${f.name} | ${f.calories_per_100g} | ${f.protein_per_100g} | ${f.carbs_per_100g} | ${f.fat_per_100g} | ${f.fiber_per_100g ?? 0} |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}
