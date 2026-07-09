# Gym App — UI Design Plan

## Design System (Existing — Do Not Change)

- **Fonts**: Inter (body), Cormorant Garamond (headings), JetBrains Mono (numbers/stats)
- **Theme**: Dark, sage/green palette
- **Components**: Cards with subtle borders, circular progress rings, bar charts via SVG

---

## 1. Home Screen — Today Dashboard

**Goal**: Replace the "More Coming Soon" section with a daily dashboard of tappable summary cards.

### Layout (top to bottom)
1. Existing hero workout card (keep as-is)
2. **Readiness Card** — full-width, prominent
3. **2-column grid**: Nutrition Card + Body Card
4. **Insights Card** — full-width, accent border

### Readiness Card
- Large readiness score number (JetBrains Mono, ~64px) centered inside an SVG arc/ring
- Ring color: green (≥7), amber (5–6), red (<5)
- Below ring: 3 small stat chips — Sleep, HRV, Resting HR
- Subtitle: "Based on last night's data"
- Tap navigates to `/recovery`

### Nutrition Card (half-width)
- Title: "Nutrition"
- 3 mini horizontal progress bars stacked: Calories / Protein / Water
- Each bar shows current vs goal with a percentage label
- Tap navigates to `/nutrition`

### Body Card (half-width)
- Title: "Body"
- Current weight (large, JetBrains Mono)
- Tiny 7-day sparkline (SVG line)
- Days since last body measurement (small, muted)
- Tap navigates to `/body`

### Insights Card
- Title: "Top Insight"
- One-line signal text (e.g., "Gaining muscle cleanly" / "Recovery flagged — consider deload")
- Left accent bar color-coded by signal type
- Tap navigates to `/insights`

---

## 2. Body Hub (`/body`)

### Layout
- Header with "Body Composition" title + "Log Weight" CTA button (top right)
- ScrollView content below

### Weight Chart
- 30-day SVG line chart
- Two series: Total Weight (solid line) + Lean Mass estimate (dashed line)
- X-axis: date labels at week boundaries only
- Y-axis: weight range auto-scaled with 5% padding
- Dot marker on last entry

### Metric Cards Row
- 4 cards in horizontal scroll: Body Fat %, Lean Mass, FFMI, Waist-to-Height
- Each card: label (small, muted) + value (large, JetBrains Mono) + trend arrow
- FFMI card shows a small "Natural ceiling: 25" reference line annotation

### Circumferences Section
- 2-column grid: Chest, Waist, Hips, Arms, Thighs, Calves
- Each cell: muscle name (small, muted) + measurement value + date last recorded
- "Log Measurements" button at bottom

### Bulk/Cut Quality
- Horizontal traffic light: 3 states — Clean Bulk (green) / Dirty Bulk (amber) / Cutting (blue)
- Active state is filled, inactive states are outlined
- One-line explanation below (e.g., "Waist stable while weight rising — clean bulk")

---

## 3. Log Weight Modal (`/body/log-weight`)

- Bottom sheet modal (slide from bottom)
- Large centered weight input (JetBrains Mono, ~72px)
- Unit label next to number (kg / lb)
- Stepper row: `−0.5` button / value / `+0.5` button
- Date selector: "Today" / "Yesterday" toggle pill
- Optional notes input (collapsed by default, expand on tap)
- Full-width "Save" button (lime/accent color)
- Drag handle at top

---

## 4. Log Measurements Modal (`/body/log-composition`)

- Bottom sheet modal, scrollable
- **Section 1 — Body Fat**: single numeric input + method selector (Manual / Navy / Bioimpedance)
  - If Navy selected: show Neck + Height fields (Height auto-filled from profile)
- **Section 2 — Circumferences**: 6 labeled inputs in 2-column grid (Chest, Waist, Hips, Arms, Thighs, Calves)
- **Section 3 — Progress Photos**: 3 photo pickers side by side (Front / Side / Back)
  - Each shows a placeholder outline with camera icon + label
  - Tapping opens image picker; selected photo shows as thumbnail with remove (×) button
- Full-width "Save" button

---

## 5. Recovery Hub (`/recovery`)

### Layout
- Header: "Recovery" title + "Log Check-In" button

### Readiness Ring (hero element)
- Large SVG ring, ~200px diameter, centered
- Score 0–10 in center (JetBrains Mono, 48px)
- Label below: "Readiness Score"
- Color transitions smoothly: red → amber → green
- Subtext: contributing factors breakdown (HRV __, Sleep __, HR __)

### Today's Metrics Row
- 3 stat chips: Sleep (hours), HRV (ms), Resting HR (bpm)
- HealthKit badge icon on chips that are auto-synced

### 7-Day Readiness Chart
- Bar chart (7 bars, one per day)
- Bars color-coded by score range
- Today's bar slightly wider / highlighted

### Muscle Soreness Map
- 5 labeled rows: Chest / Back / Legs / Shoulders / Arms
- Each row: label + 4-dot scale (none / mild / moderate / severe)
- Active dot filled, inactive outlined
- Color: green → amber → red → deep red

---

## 6. Recovery Log Modal (`/recovery/log`)

- **Sleep**: large slider (0–12h, step 0.5) + value display
- **Sleep Quality**: 1–10 tap-to-select row (10 numbered circles)
- **Stress Level**: same 1–10 tap-to-select row
- **Resting HR**: numeric input (grayed + HealthKit badge if auto-filled)
- **HRV**: numeric input (grayed + HealthKit badge if auto-filled)
- **Soreness**: 5-row grid (same dot-scale as hub)
- **Sync from Apple Watch** button (secondary style, only shown if HealthKit enabled)
- "Save" button

---

## 7. Nutrition Hub (`/nutrition`)

### Layout
- Header: "Nutrition" title + "Log Today" button

### Three Progress Rings (hero)
- 3 SVG rings side by side: Calories / Protein / Water
- Each ring: current value in center (JetBrains Mono), label below, % arc fill
- Calories ring largest (center), Protein and Water flanking (slightly smaller)

### Weekly Calorie Chart
- 7-bar chart
- Horizontal goal line drawn across bars (dashed SVG line)
- Bars above goal: amber tint. Bars below goal: green tint.
- Day labels on X-axis

### Streak Counters
- 2 chips side by side: "Surplus Streak: X days" / "Deficit Streak: X days"
- Active streak chip has accent border

### Meal Timing
- 2 toggle rows: "Pre-workout meal" + "Post-workout meal"
- Each row: label on left, toggle pill on right (on/off)

---

## 8. Nutrition Log Modal (`/nutrition/log`)

- Calories input (large numeric)
- Protein input (numeric, grams) with goal reference below ("Goal: Xg")
- Water input (numeric, ml or oz)
- 2 toggle rows: Pre-workout meal / Post-workout meal
- Optional notes (collapsed)
- "Save" button

---

## 9. Insights Screen (`/insights`)

5 signal cards, stacked vertically, each with consistent structure:

### Card Structure
- Left accent bar (4px wide, color-coded by signal strength)
- Title (small, muted, all-caps label)
- Signal headline (medium, bold — the main message)
- Supporting data row (2–3 small stat chips)
- Optional: "What to do" recommendation in a muted block below

### Card 1 — Muscle vs Fat
- Title: "BODY COMPOSITION SIGNAL"
- Colors: green (gaining muscle) / amber (gaining fat) / blue (cutting)
- Data chips: Weight change, BF% change, Lean mass change

### Card 2 — Training Readiness
- Title: "TODAY'S READINESS"
- Colors: green / amber / red
- Data chips: Sleep avg, HRV vs baseline, Resting HR

### Card 3 — Bulk Quality
- Title: "BULK QUALITY"
- Colors: green (clean) / amber (dirty)
- Data chips: Weight gain rate, Waist change, Recommended adjustment

### Card 4 — Staleness Detection
- Title: "EXERCISES NEEDING CHANGE"
- List of stale exercises, each as a row: exercise name + "X days since PR" badge
- "Mark Resolved" button per row (small, ghost style)
- Empty state: "All lifts progressing well"

### Card 5 — Maintenance Calibration
- Title: "CALORIE CALIBRATION"
- Headline: "Estimated maintenance: X kcal"
- Data chips: Avg intake, Weight trend, Surplus/deficit
- Empty state if < 14 days data: "Log 14 days of nutrition to unlock"

---

## 10. Stats Screen — Expanded (`/(tabs)/stats`)

### Add Category Tab Row
- Horizontal scrollable tab row above existing weekly/monthly toggle
- Tabs: Training / Body / Recovery / Nutrition / Insights
- Active tab: underline or pill highlight (accent color)
- Inactive tabs: muted text

### Training Tab (existing content, no change)

### Body Tab
- Weight trend (30-day mini chart)
- FFMI history table (date + value, last 8 entries)
- Navy BF% history chart

### Recovery Tab
- 30-day readiness score trend (line chart)
- Sleep average (7-day + 30-day)
- HRV trend

### Nutrition Tab
- Calorie surplus/deficit chart (30 days, green/red bars above/below zero line)
- Protein adequacy % (days hitting protein goal / total days)

### Insights Tab
- Summary cards linking to `/insights`

---

## 11. Active Workout — RPE Addition

### After "Finish Workout" is tapped, show a summary step before saving:

**Overall Session RPE**
- Title: "How hard was this session?"
- 1–10 tap-to-select row (same pattern as recovery log)

**Per-Exercise RPE** (expandable section, collapsed by default)
- Each exercise listed with its own 1–10 row
- Label: "Optional — rate each exercise"

**Rest Time Summary**
- Small table: Exercise name / Target rest / Actual avg rest
- Color code: green if within 15s of target, amber if over

**Confirm & Save** button — writes everything to DB and navigates home

---

## Navigation Patterns

| Trigger | Navigation |
|---|---|
| Tap dashboard card | Push to hub screen |
| Tap "Log" CTA | Open bottom sheet modal |
| Tap "Back" | Pop to hub or dashboard |
| Tap insights card | Push to `/insights` |
| Tap stale exercise | Push to exercise PR history |

---

## Shared Components Needed

| Component | Used In |
|---|---|
| `<ReadinessRing score={n} />` | Home dashboard, Recovery hub |
| `<ProgressRing value={n} goal={n} label="..." />` | Nutrition hub |
| `<LineChart data={[]} />` | Body hub, Stats |
| `<BarChart data={[]} goalLine={n} />` | Nutrition hub, Stats |
| `<RPESelector value={n} onChange={fn} />` | Recovery log, Workout finish |
| `<SorenessGrid value={obj} onChange={fn} />` | Recovery hub, Recovery log |
| `<StatChip label="..." value="..." />` | Home cards, Insights cards |
| `<SignalCard title accentColor headline chips />` | Insights screen |
| `<PhotoPicker label="Front" uri={uri} onChange={fn} />` | Body composition log |
| `<CategoryTabRow tabs={[]} active onChange />` | Stats screen |
