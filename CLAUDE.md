# Bockzettel — Claude Code Kontext

Diese Datei wird automatisch von Claude Code in **jeder** Umgebung geladen. Sie stellt sicher, dass Änderungen am Code oder an Dependencies in beiden Build-Umgebungen funktionieren.

## Projekt

Mobile-App zur Spielstand-Erfassung beim Doppelkopf. **Expo SDK 55 (Managed Workflow)**, **React Native 0.83.6**, **React 19**, **TypeScript (strict)**, **Zustand** für State, **React Native Paper** (Material 3) für UI, **i18next** für Übersetzungen, **`expo-file-system/legacy`** für JSON-Persistenz.

Wahrheits-Quellen für Versionen: [package.json](package.json), [app.json](app.json) — diese Datei nicht damit duplizieren.

## Build-Umgebungen

Das Repo wird in **zwei** Umgebungen entwickelt, die sich denselben `main`-Branch teilen:

| Umgebung | Plattform | Build-Target | Shell | Native-Ordner |
|---|---|---|---|---|
| Windows-PC | `win32` | **Android** (`npm run android`) | PowerShell | `/android` (lokal generiert) |
| macOS | `darwin` | **iOS** (`npm run ios`) | zsh/bash | `/ios` (lokal generiert) |

> Jede Änderung muss in beiden Umgebungen baubar bleiben. Wenn du in **einer** Umgebung Code änderst, der die andere Plattform betreffen könnte (Dependencies, native Konfiguration, plattform-spezifische APIs), markiere das im Commit/PR-Text, damit die andere Umgebung gezielt nachzieht.

## Package-Manager: **npm** (verbindlich)

- Lockfile: `package-lock.json` (im Repo getrackt). Es gibt **kein** `pnpm-lock.yaml` / `yarn.lock`.
- Verwende `npm install` (bei Änderungen) bzw. `npm ci` (für reproduzierbares Install in CI / nach Pull).
- **Nicht** `pnpm install` oder `yarn` benutzen — das würde einen Lockfile-Konflikt erzeugen.
- Das `pnpm`-Feld in `package.json` ist legacy und kann ignoriert werden (bei Gelegenheit entfernen).

### Dependency-Änderungen (kritisch für Cross-Env-Builds)

1. In **einer** Umgebung `npm install <pkg>` (oder Update) ausführen → `package-lock.json` aktualisiert sich.
2. Beides committen: `package.json` **und** `package.json-lock`.
3. In der **anderen** Umgebung nach `git pull` zwingend `npm ci` (nicht `npm install`!), damit der Lockfile autoritativ bleibt.
4. Dann dort einen Plattform-Build ausführen (`npm run android` bzw. `npm run ios`) und prüfen, dass es weiter durchläuft.

## Native-Ordner: gitignored, lokal generiert

- `/android` und `/ios` stehen in `.gitignore` (siehe [.gitignore](.gitignore)).
- Sie werden über Expo Prebuild aus `app.json` + Config-Plugins regeneriert.
- **Niemals** in die generierten Ordner direkt eincheckbare Patches schreiben — sie würden bei der anderen Umgebung nicht existieren.
- Native Anpassungen (Plugins, Permissions, Icons) gehören in [app.json](app.json) und ggf. Expo-Config-Plugins.

## Plattform-spezifischer Code

Wenn Verhalten sich zwischen iOS und Android unterscheiden muss:

- `Platform.OS === 'android'` / `'ios'`-Checks im Code, **oder**
- Datei-Suffixe `*.android.ts` / `*.ios.ts` (Metro löst das automatisch auf).

Bekannte Stellen mit plattform-spezifischem Verhalten (Stand 2026-05-19):

- "Backup speichern unter…" / "Gruppe speichern unter…" — nur unter Android verfügbar (Storage Access Framework).
- PDF-Export via `expo-print` + `expo-sharing` — Verhalten beim Speichern unterscheidet sich.

Cross-Platform-Pitfalls bei diesen Expo-Modulen:

- `expo-file-system` — URI-Format unterscheidet sich (Android: `content://`, iOS: `file://`).
- `expo-sharing` — iOS zeigt Share-Sheet, Android öffnet je nach Mime-Type unterschiedlich.
- `expo-haptics` — auf Android nur eingeschränkt, manche Patterns sind no-op.

## Shell-Unterschiede

- **Windows (PowerShell)**: `$env:VAR=...`, kein `&&` in alten 5.1-Versionen, Pfade mit Backslashes.
- **macOS (zsh/bash)**: `export VAR=...`, POSIX-Pfade.
- npm-Scripts laufen via Node und sind plattform-agnostisch — wenn du eigene Bash-Schritte hinzufügst, plattform-übergreifend halten (oder `cross-env` / Node-Scripts nutzen).

## Pre-Push / Vor jedem Commit

```
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm test              # Jest
```

Plus mindestens **einer** der beiden Plattform-Builds in der lokalen Umgebung:

```
npm run android       # Windows
# bzw.
npm run ios           # macOS
```

Bei Dependency-Updates: in der anderen Umgebung gezielt `npm ci` + Plattform-Build nachziehen (siehe oben).

## Weitere Doku

- [docs/build-environments.md](docs/build-environments.md) — Setup-Details pro Umgebung (Android Studio, Xcode, Versionen).
- [docs/superpowers/specs/](docs/superpowers/specs/) — Design-Specs vergangener Features.
- [docs/superpowers/plans/](docs/superpowers/plans/) — Implementierungs-Pläne.

## Memory-System

Claude Code unterhält pro Maschine ein eigenes Memory unter `~/.claude/projects/<repo-slug>/memory/`. Maschinen-übergreifendes Wissen (Konventionen, Build-Regeln, Architektur-Entscheidungen) gehört hier in `CLAUDE.md` oder in `docs/`, **nicht** ins Memory.
