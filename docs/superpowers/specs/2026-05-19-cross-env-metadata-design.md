# Cross-Environment Metadata for Claude Code

**Datum:** 2026-05-19
**Status:** approved
**Autor:** Thomas Thiessenhusen (via Claude Code)

## Problem

Das Projekt wird in zwei Umgebungen gebaut:

- **Windows-PC** (VS Code) → Android-Build
- **macOS** → iOS-Build

Claude Code arbeitet in beiden Umgebungen am selben Repo. Ohne geteilte Metadaten droht, dass Änderungen (Code, Dependencies, native Konfiguration) auf der jeweils anderen Plattform den Build brechen.

## Ziel

Eine geteilte, im Repo getrackte Wissensbasis schaffen, die Claude Code in beiden Umgebungen genug Kontext liefert, um plattform-übergreifend konsistente Änderungen zu machen.

## Lösung

### 1. `CLAUDE.md` im Repo-Root

Wird automatisch von Claude Code geladen. Enthält:

1. Projektüberblick (Expo SDK 55, RN 0.83.6, React 19, TS strict)
2. Build-Matrix (Win→Android / Mac→iOS) mit Kommandos
3. Verbindliche Tool-Versionen (Node, npm, Expo SDK, RN)
4. Package-Manager-Regel: **npm** (Lockfile `package-lock.json`), nicht pnpm
5. Native-Code-Strategie: `/ios` und `/android` gitignored, per `expo prebuild` regeneriert, Patches via Expo-Config-Plugins
6. Plattform-spezifische Code-Pfade (Platform.OS, `.android.ts`/`.ios.ts`)
7. Cross-Platform-Pitfalls (Sharing, FileSystem, Haptics; PowerShell vs zsh)
8. Pre-Push-Checkliste

### 2. `docs/build-environments.md`

Detail-Anleitung pro Umgebung (Android Studio / Xcode-Einrichtung, Emulator-Hinweise). Wird aus `CLAUDE.md` verlinkt.

### 3. README-Konsistenz

`README.md` erwähnt pnpm in den Setup-Befehlen — Wahrheit ist npm. Befehle entsprechend korrigieren.

## Außerhalb des Scopes (YAGNI)

- Pro-Maschine Claude-Settings (wäre `~/.claude/settings.json`, ist nicht repo-trackbar)
- Git-Hooks / CI-Erweiterungen
- OS-Switch im Code (RN/Expo lösen das bereits)

## Risiken

- Metadaten können altern. Mitigation: kurz halten, auf andere Wahrheits-Quellen (package.json, app.json) verweisen statt Versionen zu duplizieren.
- README/CLAUDE.md-Drift: Beide werden hier in einem Schritt synchronisiert.