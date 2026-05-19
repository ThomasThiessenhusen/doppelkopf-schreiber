# Bockzettel

Mobile-App (Android & iOS) zur Unterstuetzung des Schreibers beim Doppelkopf-Kartenspiel.

## Voraussetzungen

- Node.js >= 20
- npm >= 10
- Android Studio mit eingerichtetem Emulator (fuer Android-Lauf)
- macOS + Xcode (fuer iOS-Simulator)

## Setup

```bash
npm ci
```

## Entwicklung

```bash
npm start           # Metro-Bundler
npm run android     # In Android-Emulator starten
npm run ios         # In iOS-Simulator starten (nur macOS)
```

## Tests & Qualitaet

```bash
npm test            # Jest
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

## Build-Umgebungen

Das Projekt wird in zwei Umgebungen entwickelt (Windows-PC für Android, macOS für iOS).
Cross-Environment-Details: [docs/build-environments.md](docs/build-environments.md) und [CLAUDE.md](CLAUDE.md).

## Tech-Stack

- Expo SDK 55 (Managed Workflow)
- React Native 0.83.6 + React 19 + TypeScript (strict)
- React Native Paper (Material 3)
- @react-navigation/native-stack fuer Navigation
- Zustand fuer State Management
- `expo-file-system/legacy` fuer JSON-Persistenz
- Jest + babel-jest fuer Unit-Tests
