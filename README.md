# Bockzettel

Mobile-App (Android, iOS & Web) zur Unterstuetzung des Schreibers beim Doppelkopf-Kartenspiel.

Web-Version: **https://thomasthiessenhusen.github.io/doppelkopf-schreiber/**

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
npm run android     # In Android-Emulator starten
npm run web         # Im Browser starten

# iOS (zwei Schritte, da expo run:ios beim URL-Open fehlschlaegt):
REACT_NATIVE_PACKAGER_HOSTNAME=localhost npx expo start --port 8081
xcrun simctl launch <UDID> de.meinnaechsterurlaub.bockzettel
```

## Tests & Qualitaet

```bash
npm test            # Jest
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

## Build-Umgebungen

Das Projekt wird in zwei Umgebungen entwickelt (Windows-PC fuer Android, macOS fuer iOS).
Cross-Environment-Details: [docs/build-environments.md](docs/build-environments.md) und [CLAUDE.md](CLAUDE.md).

Die Web-Version wird automatisch bei jedem Push auf `main` via GitHub Actions nach GitHub Pages deployt.

## Tech-Stack

- Expo SDK 55 (Managed Workflow)
- React Native 0.83.6 + React 19 + TypeScript (strict)
- React Native Paper (Material 3)
- @react-navigation/native-stack fuer Navigation
- Zustand fuer State Management
- i18next + react-i18next fuer Uebersetzungen (DE/EN)
- Persistenz: `expo-file-system/legacy` (nativ) · IndexedDB / localStorage (Web)
- Jest + babel-jest fuer Unit-Tests
