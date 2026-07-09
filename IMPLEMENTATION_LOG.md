# Implementation Log — UI_PLAN.md build-out (COMPLETE)

Source spec: `UI_PLAN.md` (derived from `Gym App - Standalone (1).html` mockup).
Goal: implement the readiness/body/nutrition/insights features described there on top of the existing Expo Router gym tracker.

All 3 phases are now complete and verified (`ReadLints` clean across `app/`, `components/`, `lib/`; `npx tsc --noEmit` passes with zero errors). This file is being kept as a permanent implementation-notes doc rather than deleted, since it documents non-obvious decisions (chart-library substitutions, modal presentation choice, judgement calls on ambiguous spec details) that are useful context for future work — delete it whenever you're comfortable the team no longer needs that context.

Existing app uses a **light** sage/green theme (`lib/theme.ts`), not the "dark" theme mentioned in `UI_PLAN.md` — followed the existing tokens since that rule says "Do Not Change" the existing design system.

## What was built

### 1. DB schema (`lib/db/schema.ts`)
- Added tables: `body_weight_logs`, `body_composition_logs`, `recovery_logs`, `nutrition_logs`, `resolved_staleness`, `user_goals` (single row, id=1).
- Added `sets.rpe` and `workouts.overall_rpe` columns, with `PRAGMA table_info`-based backfill for existing installs.
- Idempotency confirmed: every `CREATE TABLE` uses `IF NOT EXISTS`, the seed row uses `INSERT OR IGNORE`, and the two column backfills are gated behind a `PRAGMA table_info` existence check — safe to run on every app launch.

### 2. Types (`lib/types.ts`)
- Added `BodyWeightLog`, `BodyCompositionLog`, `BodyFatMethod`, `RecoveryLog`, `SorenessLevel`, `MuscleGroupKey`, `NutritionLog`, `UserGoals`.
- `Workout` now has `overall_rpe: number | null`.

### 3. Queries (`lib/db/queriesHealth.ts` — new file, kept separate from `queries.ts`)
- Body weight: `upsertBodyWeightLog`, `getBodyWeightLogs`, `getLatestBodyWeight`, `getDaysSinceLastMeasurement`.
- Body composition: `insertBodyCompositionLog`, `getLatestBodyComposition`, `getBodyCompositionHistory`.
- Recovery: `upsertRecoveryLog`, `getLatestRecoveryLog`, `getRecoveryLogs`, `readinessScore()` (pure function: averages normalized sleep/HRV/resting-HR, 0–10 scale, returns null if no data).
- Nutrition: `upsertNutritionLog`, `getTodayNutritionLog`, `getNutritionLogs`, `getNutritionStreaks`.
- Goals: `getUserGoals`, `updateUserGoals`.
- RPE: `setWorkoutRpe`, `setExerciseRpe` (bulk-updates all sets for a `workout_exercise_id`).
- Staleness: `getStaleExercises` (>21 days since last PR, excludes `resolved_staleness`), `markStalenessResolved`.
- Calibration: `getMaintenanceCalibration` (needs ≥14 days of nutrition logs, returns null otherwise).

### 4. Insights logic (`lib/insights.ts` — new file)
- `getBodyCompositionSignal`, `getReadinessSignal`, `getBulkQualitySignal`, `getStalenessSignal`, `getCalibrationSignal`, and `getTopInsight` (priority: bad readiness > bulk quality > body comp > readiness) for the Home dashboard's single insight card.
- `computeFFMI(weightKg, bfPct, heightCm)` — extracted in Phase 3 from `app/body/index.tsx`'s inline FFMI calc so it could be reused by the Stats screen's FFMI history table without duplicating the formula.
- `SIGNAL_COLORS` map (green/amber/red/blue → hex) shared by Home, Insights, and Stats screens.

### 5. Shared components (`components/`)
- `Ring.tsx`: `ReadinessRing`, `ProgressRing` (SVG arc rings).
- `Charts.tsx`: `LineChart` (multi-series via `series` prop for solid+dashed overlays, e.g. weight vs lean mass), `BarChart` (optional dashed goal line + above/below coloring), `DivergingBarChart` (added in Phase 3 — renders bars above/below a zero baseline for the Stats Nutrition tab's calorie surplus/deficit chart; `BarChart` only supports goal-line-relative coloring from a bottom baseline, not a true zero-centered diverging chart, so this is a distinct small component rather than an awkward reuse).
- `Selectors.tsx`: `RPESelector` (1–10 tap row), `SorenessGrid` (5 muscle groups × 4-dot scale).
- `Cards.tsx`: `StatChip`, `SignalCard` (accent bar + headline + chips + optional recommendation block).
- `PhotoPicker.tsx`: placeholder photo picker (no `expo-image-picker` dependency installed, so it simulates a captured thumbnail rather than opening a real camera — documented in a code comment).
- `CategoryTabRow.tsx`: horizontal scrollable pill tabs, generic over a string union. Used by both `app/(tabs)/stats.tsx` (Training/Body/Recovery/Nutrition/Insights) — its original intended use case.

### 6. Home dashboard (`app/(tabs)/index.tsx`)
- Replaced the "More Coming Soon" section with: Readiness card (ring + sleep/HRV/RHR mini stats, taps to `/recovery`), a 2-column row of Nutrition card (3 mini progress bars, taps to `/nutrition`) and Body card (weight + 7-day SVG sparkline + days-since-measurement, taps to `/body`), and an Insights card (taps to `/insights`) showing `getTopInsight()`.

### 7. Body Hub
- `app/body/index.tsx`: header with "Log Weight" CTA, 30-day weight+lean-mass line chart, horizontally scrollable metric cards (Body Fat %, Lean Mass, FFMI with "Natural ceiling: 25" note, Waist-to-Height — FFMI now computed via the shared `computeFFMI` helper), circumference grid (6 muscles, latest value + date, `CIRCUMFERENCE_FIELDS` exported for reuse), "Log Measurements" CTA, Bulk/Cut Quality traffic-light section with computed explanation.
- `app/body/log-weight.tsx`: bottom-sheet-style modal (self-rendered overlay + rounded sheet), large mono weight input, ±0.5 stepper, Today/Yesterday pill, collapsible notes, Save → `upsertBodyWeightLog`.
- `app/body/log-composition.tsx`: bottom-sheet modal, scrollable. Body Fat % input + Manual/Navy/Bioimpedance method pills; Navy reveals Neck (cm) + Height (cm) fields, Height prefilled from latest `body_composition_logs` row or `getUserGoals().height_cm`. 2-column circumference grid reusing `CIRCUMFERENCE_FIELDS`. Three `PhotoPicker`s (Front/Side/Back). Save → `insertBodyCompositionLog`.

### 8. Recovery Hub + log modal
- `app/recovery/index.tsx`: header with "Log Check-In" CTA; hero `ReadinessRing` (200px) driven by `readinessScore()` on the latest recovery log, with a contributing-factors line (Sleep/HRV/RHR) below; 3 stat chips (no HealthKit badges since there's no HealthKit integration); 7-day readiness bar strip — computed inline (not via the shared `BarChart`, since that only supports binary above/below-goal coloring, not 3-way green/amber/red range coloring); read-only `SorenessGrid` (no-op `onChange`) showing the latest log's soreness levels.
- `app/recovery/log.tsx`: bottom-sheet modal. Sleep hours via a ±0.5 stepper (no slider lib installed); Sleep Quality and Stress Level each via `RPESelector`; Resting HR / HRV numeric inputs; editable `SorenessGrid`; no "Sync from Apple Watch" button. Save → `upsertRecoveryLog`, prefilled from the latest log on mount.

### 9. Nutrition Hub + log modal
- `app/nutrition/index.tsx`: header with "Log Today" CTA; 3 `ProgressRing`s side by side (Protein/Calories/Water, Calories largest/center at 104px) fed by `getTodayNutritionLog` + `getUserGoals`; "Weekly Calories" `BarChart` with a dashed goal line over a 7-day rolling window; 2 streak chips (surplus/deficit) from `getNutritionStreaks`; 2 Pre/Post-workout toggle rows that read-merge-write against today's log so calories/protein/water are never clobbered by a toggle tap.
- `app/nutrition/log.tsx`: bottom-sheet modal. Calories/protein (with a "Goal: Xg" reference)/water inputs, the same toggle rows, collapsible notes. Prefills from today's existing log on open. Save → single `upsertNutritionLog` call.

### 10. Insights screen
- `app/insights/index.tsx`: 5 cards in spec priority order. Body Composition / Readiness / Bulk Quality reuse the shared `SignalCard` and are silently skipped when their signal getter returns null (insufficient data). "Exercises Needing Change" is a hand-built card (list body doesn't fit `SignalCard`) with per-row "Mark Resolved" buttons and an "All lifts progressing well" empty state. "Calorie Calibration" reuses `getCalibrationSignal` and falls back to a "Log 14 days of nutrition to unlock" empty-state card.

### 11. Modal routes (`app/_layout.tsx`)
- Registers `body/log-weight`, `body/log-composition`, `recovery/log`, `nutrition/log` as `Stack.Screen`s with `presentation: 'transparentModal', animation: 'slide_from_bottom'`. Chosen over `modal`/card presentation because all 4 log screens self-render their own full-screen `rgba(0,0,0,0.4)` overlay + rounded bottom sheet — a non-transparent native presentation would add a second layer of chrome on top of that. Hub screens (`body`, `recovery`, `nutrition`, `insights`) intentionally have **no** `Stack.Screen` entry — they're plain pushes, same as any other unlisted route, and don't need special presentation options.

### 12. Stats screen expansion (`app/(tabs)/stats.tsx`) — Phase 3
- Added `CategoryTabRow` (Training/Body/Recovery/Nutrition/Insights) above the existing weekly/monthly toggle. All data for all 5 tabs loads together in the existing `loadData()` on focus (simpler than lazy-loading per tab, and the query volume is small).
- **Training tab**: existing weekly/monthly toggle + content, completely unchanged, just gated behind `tab === 'training'`.
- **Body tab**: 30-day weight `LineChart`; a Body Fat % history `LineChart` — uses **all** `body_composition_logs` entries with a non-null `body_fat_pct` rather than filtering to `method === 'navy'` only, because restricting to Navy-only measurements made the chart too sparse to be useful for someone who logs BF% manually or via bioimpedance most of the time (documented as a judgement call, easy to add a method filter later if strictness is preferred); FFMI history table (last 8 entries) matching each body-comp entry with a `body_fat_pct` to the nearest preceding weight log and running it through the shared `computeFFMI` helper.
- **Recovery tab**: 30-day readiness trend `LineChart` (per-log `readinessScore()`); 7-day and 30-day sleep-hour averages as stat chips; HRV shown as "current" vs "30-day avg" stat chips rather than a second mini chart — judgement call to keep the tab scannable rather than chart-heavy, since the readiness trend chart already covers the main "how am I trending" question.
- **Nutrition tab**: 30-day calorie surplus/deficit chart using the new `DivergingBarChart` component (bars above a zero line = surplus vs goal, below = deficit); protein adequacy % (days hitting the protein goal ÷ total days with a protein value logged in the last 30 days).
- **Insights tab**: lightweight preview — a "Top Insight" card (reusing `getTopInsight()`, same as the Home dashboard) with the signal's accent color as a left border, two stat chips (stale-exercise count, calorie-calibration readiness), and a "View All Insights" CTA button, all navigating to `/insights`. Deliberately not duplicating the 5 full `SignalCard`s here — the full Insights screen is one tap away.

### 13. Active workout RPE + rest-summary flow — Phase 3
- `lib/store/workout.ts`: `WorkoutView` union now includes `'rpe'` (between `'resting'` and `'summary'`). New state: `restLog: RestLogEntry[]` (`{exerciseIndex, exerciseName, target, actual}`), `overallRpe: number | null`, `perExerciseRpe: Record<number, number>`. New actions: `logRest(...)`, `setOverallRpe(rpe)`, `setExerciseRpe(exerciseIndex, rpe)`. All three are cleared back to defaults (`[]`, `null`, `{}`) in `reset()`.
- `app/workout/active.tsx`:
  - `RestingView`'s `onSkip` prop was replaced with `onFinishRest(actualSeconds: number)`. Both the auto-complete interval path (remaining hits 0 → `actual = restDuration`) and the two manual-skip paths (top-row close button, "Skip Rest" button — both now call a local `handleSkip()` that computes `actual = restDuration - remaining`) funnel through the same formula and the same callback, so rest is logged consistently regardless of how the rest period ended.
  - The parent's `handleFinishRest(actualSeconds)` only calls `store.logRest(...)` when `actualSeconds > 0`, guarding against a zero-length log entry if something calls finish immediately.
  - `handleFinish()`'s confirmation `Alert` is unchanged in spirit — "Finish" now transitions to `setView('rpe')` instead of immediately writing to the DB and calling `storeFinish()`.
  - New `RpeView` component (styled consistently with the file's existing `screen`/`topRow`/`primaryBtn` conventions): "How hard was this session?" headline + `RPESelector` bound to `overallRpe`; a collapsible "Per-Exercise RPE" section (only shown if at least one exercise has logged sets) with one `RPESelector` per exercise with sets; a "Rest Time Summary" table built from `restLog`, averaging multiple rest entries per exercise and coloring the actual-rest cell green if within 15s of target, amber otherwise; a "Confirm & Save" button that calls `setWorkoutRpe` (if an overall RPE was set), `setExerciseRpe` for every exercise index with a rating (skipping any without a `workoutExerciseId`, e.g. exercises that failed to persist), then the existing `dbFinishWorkout`, then the store's `finishWorkout()` (which transitions to `'summary'`, unchanged).

## Final verification (Phase 3)
- `ReadLints` run across `app/`, `components/`, `lib/` — zero errors.
- `npx tsc --noEmit` — zero errors (including the two `/nutrition` and `/insights` typed-route errors that existed before those screens were built; both resolved once the corresponding files were added in Phase 2).
- Reachability check via `router.push`/`router.back` grep across `app/`: every hub (`/body`, `/recovery`, `/nutrition`, `/insights`) is reachable from the Home dashboard's cards, and every log modal is reachable from its hub's CTA button. No dead ends found.
- `app/_layout.tsx` has exactly the 4 modal `Stack.Screen` entries needed (`body/log-weight`, `body/log-composition`, `recovery/log`, `nutrition/log`); hub screens correctly have no entry and work as default pushes.
- `lib/db/schema.ts` confirmed idempotent (see item 1 above).

## Known limitations / spec deviations (by design, no native deps added)
- **No real camera/photo library** — `PhotoPicker` simulates a captured thumbnail instead of opening `expo-image-picker` (not installed). Progress photos are effectively a placeholder feature.
- **No HealthKit integration** — Resting HR / HRV / sleep are always manually entered; no auto-sync badges, no "Sync from Apple Watch" button anywhere.
- **No slider library** — the spec's sleep-hours slider (`Recovery Log Modal`) is a ±0.5 stepper instead, matching the existing Log Weight modal's stepper pattern.
- **No charting library** — all charts (`LineChart`, `BarChart`, `DivergingBarChart`, readiness bar strips) are hand-built from `react-native-svg` and plain `View`s, consistent with how the pre-existing Home/Stats screens already charted workout volume before this feature was added.
- **Navy BF% history chart** (Stats → Body tab) intentionally includes all body-fat measurements regardless of method, not just `method === 'navy'` ones, to avoid an overly sparse chart — see item 12 above.
- **Stats → Recovery tab** shows HRV as current-vs-30-day-average stat chips rather than a second trend chart, to keep the tab from being overloaded with charts.
- **Stats → Insights tab** is a lightweight preview (one insight headline + 2 stat chips + a CTA), not a duplicate of all 5 signal cards — the full detail is one tap away on `/insights`.

## Notes / decisions for continuity
- `body_weight_logs`, `recovery_logs`, `nutrition_logs` are all **one-row-per-day upserts** (`ON CONFLICT(date) DO UPDATE`) — re-logging the same day overwrites rather than duplicating.
- `body_composition_logs` allows multiple rows per day (append-only) since it's a less frequent, richer log.
- File conventions followed throughout: `StyleSheet.create` at bottom of file, `colors/sp/r/fs/fonts` from `lib/theme`, `useFocusEffect` + `useCallback` for screen data loading, `useSQLiteContext()` for db access.
