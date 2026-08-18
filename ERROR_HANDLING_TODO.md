# Fix Firebase/Firestore Error Handling

The app is Firestore-only (one-shot `getDoc`/`getDocs`/`setDoc`/`addDoc`/`updateDoc`/`deleteDoc`) plus Firebase Auth
(`onAuthStateChanged`, `signInWithPopup`, `signOut`). There is no `onSnapshot`, no Storage, no batch/transaction.

**Core problem:** none of the three service-layer files that wrap every Firestore call have a single `try/catch`.
Roughly half of the UI call sites into them also have no try/catch, so failures become unhandled promise rejections
with zero user feedback. Fix bottom-up: service layer first, then the UI call sites.

## Reference pattern (already good in this codebase)

`app/login.tsx` and `app/workout/start.tsx` / `app/workout/create-program.tsx` do this correctly:

```ts
try {
  setLoading(true)
  await doFirestoreThing()
} catch (err) {
  console.error(err)
  Alert.alert('Something went wrong', errorMessage(err))
} finally {
  setLoading(false)
}
```

Apply this shape everywhere below. For list/load screens, add an `error` state and render a "failed to load / retry"
UI instead of silently showing stale/empty data.

## 1. Service layer — add try/catch (or let errors propagate cleanly with typed errors)

- `lib/firestore/queries.ts` — 31 exported functions (workouts, sets, exercises, PRs, programs, stats). No error
  handling anywhere.
- `lib/firestore/queriesHealth.ts` — 34 exported functions (body weight/composition, recovery, foods, nutrition,
  goals, staleness, calibration). No error handling. `mergeHealthKitMetrics` (L177-234) does a multi-write loop over
  `getDoc`/`setDoc` — if one write fails mid-loop, the rest silently never run.
- `lib/firestore/queriesRunning.ts` — `saveRun`, `getRecentRuns`, `deleteRun`. No error handling.
- `lib/firestore/seed.ts` — `seedExercises()` (L51-59) has no try/catch, and is called fire-and-forget with no
  `.catch()` from `app/_layout.tsx` L33 on every login.

Decide on one approach (recommend): let these throw normally, but ensure every caller catches. Do NOT swallow errors
here — surface them to callers so the UI can show feedback.

## 2. Auth store — `lib/store/auth.ts`

- L22-26 `onAuthStateChanged(auth, (user) => {...})` has no error callback (3rd arg). A listener error leaves the
  app stuck on the loading spinner forever with no timeout/fallback. Add an error callback that sets an error state
  and stops `loading`.
- L28-30 `signIn()` — `signInWithPopup(auth, googleProvider)` has no try/catch, and **`signInWithPopup` is a
  web-only Firebase Auth API** — it will fail on native. This is a functional bug, not just missing error handling;
  needs `signInWithCredential` via a native Google auth flow (e.g. `expo-auth-session` / `@react-native-google-signin`).
- L32-34 `signOut()` — no try/catch.

## 3. UI screens with NO error handling at all (add try/catch + error state)

- `app/insights/index.tsx` — `loadData()` (L34-52, `Promise.all` of 5 calls) and `handleResolve` (L49-52)
- `app/recovery/index.tsx` — `loadData()`; `handleConnectHealthKit` (L54-62) has `try/finally` but no `catch`
- `app/recovery/log.tsx` — `getRecoveryLog(...).then(...)` (L34-51, no `.catch()`); `handleSave` (L52) no try/catch
- `app/(tabs)/stats.tsx` — `loadData()` (Promise.all of 7+ queries); `getExerciseHistory(...).then(...)` no `.catch()`
- `app/(tabs)/food.tsx` — `loadData(date)`; `applyGrams`, `deleteItem`, `addWater` — all no try/catch
- `app/body/index.tsx` — `loadData()`
- `app/body/log-composition.tsx` — `handleSave()` (L41-56)
- `app/body/log-weight.tsx` — `getLatestBodyWeight().then(...)` no `.catch()`; `handleSave()` (L43-48) no try/catch
- `app/nutrition/goals.tsx` — `getUserGoals().then(...)` no `.catch()`; `handleSave()` (L32-42) no try/catch
- `app/nutrition/food-edit.tsx` — `getFoods().then(...)` no `.catch()`; `handleSave()` (L47-62) no try/catch
- `app/nutrition/foods.tsx` — `getFoods().then(...)` no `.catch()`; `handleDelete(id)` (L21-24) no try/catch,
  optimistically filters local state before confirming the delete succeeded
- `app/nutrition/add-food.tsx` — `getFoods().then(...)` no `.catch()`; `confirmAdd()` (L77-90) no try/catch
- `app/stats/[metric].tsx` — data-loading `useEffect`, no try/catch
- `app/(tabs)/profile.tsx` — `handleSignOut()` (L68-75) has `try/finally` but no `catch`

## 4. UI screens that catch but only `console.error` (add user-facing feedback)

- `app/(tabs)/index.tsx` (L51-127) — 4 try/catch blocks around dashboard loads, all catch-log-only. Add an error
  banner/state instead of silently showing stale data.

## 5. "Fake success" bugs — catch swallows error, then proceeds as if it worked (fix logic, not just add feedback)

- `app/(tabs)/workouts.tsx` (L66-71) — delete custom program: empty catch, no feedback on failure
- `app/(tabs)/log.tsx` (L32-37) — `handleDelete`: optimistic removal happens **before** the try/catch; on failure
  the workout disappears from UI but still exists in Firestore
- `app/workout/[id].tsx` (L56-62) — `confirmDelete()`: empty catch, then unconditionally `router.back()` regardless
  of success
- `app/workout/active.tsx`:
  - `confirmDiscard()` (L196-203) — empty catch, then unconditionally resets and navigates back
  - `handleDeleteSet` (L108-129) — optimistic local removal happens before the try/catch around `deleteSet`; no
    rollback on failure
  - `handleFinish` (L173-190) — `storeFinish()` runs unconditionally after the try/catch, even if the Firestore
    save failed

## 6. HealthKit connect flow

- `lib/healthkitSync.ts` — `connectHealthKit()` (L29-44) has no try/catch. Its two callers (`profile.tsx` L53-65,
  `recovery/index.tsx` L54-62) only use `try/finally`, no `catch` — a real failure here is completely silent to the
  user. `syncHealthKitIfNeeded()` (background sync) is fine as-is (catches everything, never throws).

## 7. Missing offline/network handling

No file checks Firestore's offline/network error conditions (e.g. `error.code === 'unavailable'`), and there's no
"you're offline" messaging anywhere. Once try/catch is added everywhere above, add a shared helper to detect this
error code and show a consistent offline message instead of a generic error alert.

## Suggested order of work

1. Add error callback to `onAuthStateChanged` in `lib/store/auth.ts`; fix `signInWithPopup` native bug.
2. Fix the 4 "fake success" bugs in section 5 (real data-integrity risk).
3. Wrap all section 3 call sites in try/catch with `Alert.alert` + error state, following the `login.tsx` /
   `workout/start.tsx` pattern.
4. Upgrade section 4's console-only catches to show user feedback.
5. Fix `seedExercises()` fire-and-forget call in `app/_layout.tsx`.
6. Add a shared `isOfflineError(err)` helper and offline messaging.
