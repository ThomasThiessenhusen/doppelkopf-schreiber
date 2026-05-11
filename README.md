# Bockzettel

Mobile-App (Android & iOS) zur Unterstuetzung des Schreibers beim Doppelkopf-Kartenspiel.
React-Native-Reimplementierung der frueheren Flutter-App. Migration nach Spec
`2026-05-11-react-native-migration-design.md` (im urspruenglichen Flutter-Repo unter
`doppelkopf_app/docs/superpowers/specs/`).

## Voraussetzungen

- Node.js >= 20
- pnpm >= 10
- Android Studio mit eingerichtetem Emulator (fuer Android-Lauf)
- macOS + Xcode (fuer iOS-Simulator; spaeter, siehe M8 in der Spec)

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

## Stand

Migration laeuft. Aktueller Meilenstein: M1 (Projekt-Setup) abgeschlossen.
