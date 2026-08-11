# AI Chat Feature Plan

Chat interface for talking to an AI agent (Claude/Anthropic) that analyzes the user's tracked data (workouts, nutrition, body composition, recovery) and answers questions or surfaces insights.

## Current state (relevant to this feature)

- **Routing**: Expo Router, `app/_layout.tsx` root `Stack` + `(tabs)` group. Modal-style routes registered individually (e.g. `insights/index`).
- **State**: Zustand. `lib/store/auth.ts` (Firebase auth), `lib/store/workout.ts` (active workout session). No chat store yet.
- **Data layer**: Firestore is the live data layer — `lib/firestore/queries.ts` and `lib/firestore/queriesHealth.ts`, scoped to `users/{uid}/{collection}` via `auth.currentUser.uid`. Covers exercises, workouts/sets/PRs, body weight/composition, recovery logs, nutrition logs/foods, goals, streaks, averages. (`lib/db/*` is a legacy expo-sqlite implementation, no longer imported — ignore it.)
- **Insights aggregation**: `lib/insights.ts` already builds "Signal" objects (readiness score, FFMI, body-fat trend) — reusable logic for building AI context.
- **Auth**: Firebase Auth (Google OAuth). Session via `auth.currentUser` or `useAuthStore().user`.
- **UI**: Plain `StyleSheet`, shared theme in `lib/theme.ts` (colors, spacing, radii, font sizes, fonts — Cormorant Garamond headings, Inter body, JetBrains Mono numbers). Reusable components in `components/` (`Cards.tsx`, `Selectors.tsx`, `CategoryTabRow.tsx`, `Charts.tsx`, `TabBar.tsx`, `PhotoPicker.tsx`, `Ring.tsx`). No chat/bubble components exist yet.
- **Backend**: none currently. No Cloud Functions, no API routes, no AI SDK in `package.json`. `.env` only has `EXPO_PUBLIC_FIREBASE_*` keys — AI API keys can't be `EXPO_PUBLIC_*` since those ship in the client bundle.

## Architecture

### 1. Backend proxy (required)
A Firebase Cloud Function (fits the existing Firebase/Firestore setup, auth via Firebase ID tokens automatically):
- Receives `{ message, conversationId }`.
- Builds context from Firestore.
- Calls the Anthropic API (`@anthropic-ai/sdk`) via `messages.create` (or `tool_runner` for the agent loop).
- Returns/streams the response.

### 2. Context & tool-calling
Rather than dumping all tracked data into context up front, expose tools that map to existing query functions:
- `getNutritionSummary(dateRange)`
- `getWorkoutHistory(dateRange)`
- `getBodyTrend()`
- `getRecoverySummary(dateRange)`

These wrap `lib/firestore/queries.ts` / `queriesHealth.ts` (and reuse `lib/insights.ts` aggregation where relevant). The Cloud Function runs the agent loop server-side, calling these against Firestore scoped to the requesting user's uid. Claude decides what to fetch per question — keeps payloads small and scales as more tracked data types get added.

### 3. Model
Start with **Claude Sonnet 5** for cost/latency balance. No need for Opus unless responses require deeper reasoning.

### 4. Conversation persistence
New Firestore collection `users/{uid}/chat_messages`, matching the existing `users/{uid}/{collection}` pattern. Store role, content, timestamp.

### 5. Client
- New route `app/chat/index.tsx`, registered as a stack screen in `app/_layout.tsx` (like `insights/index`).
- New `lib/store/chat.ts` Zustand store: messages, streaming state, send/receive.
- Message list + input bar built in the existing `StyleSheet`/`lib/theme.ts` system — no chat components exist yet, build from scratch for visual consistency.
- Add a markdown renderer (e.g. `react-native-markdown-display`) for formatted agent responses (lists, summaries).
- Streaming: Claude's SDK supports SSE streaming; Cloud Function streams the response, client renders incrementally.

### 6. Entry point
Chat CTA on `insights/index.tsx` (already aggregates signals — natural jump-off point to "ask the AI about this") and/or an icon in the tab bar header.

## Phasing

1. Cloud Function + non-streaming single-turn chat, static context injection, no persistence — validate the AI wrapper works end to end.
2. Add tool-calling so the agent queries Firestore live instead of a fixed context blob.
3. Add conversation persistence + chat history UI.
4. Add streaming responses.

## Open questions

- Confirm Cloud Functions is the right home vs. a separate lightweight server, if one gets introduced for other reasons later.
- Rate limiting / cost control per user for the AI API calls.
