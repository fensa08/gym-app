# Gym Tracker

A personal workout tracking app built with Expo and React Native.

## Features

- **Home dashboard** — last workout summary, weekly activity dots, quick-start PPL templates
- **Active workout** — full-screen session with swipeable exercise cards, set logging, PR detection, and rest timer
- **Exercise library** — searchable list with muscle group filter chips (39 built-in exercises across 7 groups)
- **Progress** — volume bar chart, personal records, and workout history
- **Profile** — stats overview and settings

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54 |
| Navigation | expo-router v6 (file-based) |
| Database | expo-sqlite v16 |
| State | Zustand v5 |
| Styling | React Native StyleSheet + design tokens |
| Utilities | date-fns v3 |

## Project Structure

```
app/
  _layout.tsx          # Root layout — SQLiteProvider, DB init
  (tabs)/
    _layout.tsx        # Bottom tab bar
    index.tsx          # Home dashboard
    library.tsx        # Exercise library
    progress.tsx       # Progress & charts
    profile.tsx        # Profile & settings
  workout/
    active.tsx         # Active workout session

components/
  workout/
    SetRow.tsx         # Weight/reps input row
    RestTimer.tsx      # Rest timer overlay

lib/
  theme.ts             # Design tokens (dark theme)
  types.ts             # Shared TypeScript interfaces
  templates.ts         # PPL workout templates
  db/
    schema.ts          # SQLite schema
    seed.ts            # Exercise seed data
    queries.ts         # Typed query helpers
  store/
    workout.ts         # Active workout Zustand store
```

## Design System

Dark theme with four accent colors:

- Background: `#0A0A0F`
- Primary accent: `#6C63FF`
- Warm accent: `#FF6B35`
- Success: `#00D4A4`

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app (SDK 54).
