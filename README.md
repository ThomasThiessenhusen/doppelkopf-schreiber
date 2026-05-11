# Bockzettel

Mobile-App (Android & iOS) zur Unterstuetzung des Schreibers beim Doppelkopf-Kartenspiel.

## Voraussetzungen

- Node.js >= 20
- pnpm >= 10
- Android Studio mit eingerichtetem Emulator (fuer Android-Lauf)
- macOS + Xcode (fuer iOS-Simulator)

## Setup

```bash
pnpm install
```

## Entwicklung

```bash
pnpm start          # Metro-Bundler
pnpm android        # In Android-Emulator starten
pnpm ios            # In iOS-Simulator starten (nur macOS)
```

## Tests & Qualitaet

```bash
pnpm test           # Jest
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint
```

## Tech-Stack

- Expo SDK 54 (Managed Workflow) mit Expo Router (File-based Routing)
- React Native + TypeScript (strict)
- React Native Paper (Material 3)
- Zustand fuer State Management
- `expo-file-system/legacy` fuer JSON-Persistenz
- Jest + babel-jest fuer Unit-Tests
