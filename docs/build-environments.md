# Build-Umgebungen

Detailinformationen zu den beiden Build-Umgebungen. Übergeordneter Kontext: [CLAUDE.md](../CLAUDE.md).

## Geteilte Voraussetzungen (beide Umgebungen)

- **Node.js ≥ 20** (LTS empfohlen)
- **npm ≥ 10** (kommt mit Node 20+)
- **Git**
- **Expo CLI** — wird via `@expo/cli` als Dev-Dependency installiert, kein globales Setup nötig.

Install nach `git clone`:

```
npm ci
```

(`npm install` nur, wenn `package-lock.json` absichtlich verändert wird.)

## Windows-PC → Android

### Setup

- **Android Studio** (aktuelle stabile Version, mind. Hedgehog / 2023.1).
- Android SDK Platform 34+ und Build-Tools über den SDK Manager installieren.
- Mindestens ein AVD (Android Virtual Device), empfohlen: Pixel mit aktuellem System Image.
- Umgebungsvariablen:
  - `ANDROID_HOME` auf das SDK-Verzeichnis (typisch `%LOCALAPPDATA%\Android\Sdk`).
  - `%ANDROID_HOME%\platform-tools` im `PATH`.

### Build

```
npm run android
```

Beim ersten Start (oder nach Änderungen an `app.json` / nativen Plugins) führt Expo automatisch `prebuild` aus und legt `/android` an. Der Ordner ist gitignored und gehört nicht ins Repo.

### Häufige Stolperfallen

- Gradle-Builds laufen länger als iOS — ein Build-Log unter `android_build.log` ist normal.
- Bei Lockfile-Mismatch: `npm ci` neu ausführen, dann `npm run android` erneut.
- Bei nativen Plugin-Änderungen: `/android` löschen und neu prebuilden (`npx expo prebuild -p android --clean`).

## macOS → iOS

### Setup

- **Xcode** (aktuelle Version aus dem App Store).
- Xcode Command Line Tools: `xcode-select --install`.
- **CocoaPods** — wird heute meist per `gem install cocoapods` oder via `brew install cocoapods` aufgesetzt; Expo ruft es bei Bedarf auf.
- iOS-Simulator (kommt mit Xcode).

### Build

```
npm run ios
```

Auch hier macht Expo Prebuild und legt `/ios` an (gitignored).

### Häufige Stolperfallen

- Nach Expo-SDK-Updates kann ein `pod install` im `/ios`-Ordner nötig werden — Expo macht das normalerweise automatisch, im Zweifel `npx expo prebuild -p ios --clean`.
- Bei Signing-Themen für Device-Builds: Apple Developer Account in Xcode konfigurieren, Bundle-ID `de.meinnaechsterurlaub.bockzettel` ist in [app.json](../app.json) festgelegt.

## Cross-Umgebung-Sync nach Pull

Wenn jemand im anderen Environment etwas an Dependencies geändert hat:

```
git pull
npm ci                 # Lockfile-treuer Install, NICHT npm install
npm run android        # oder npm run ios
```

Schlägt der Build fehl, in dieser Reihenfolge prüfen:

1. Lockfile-Konflikt? → `npm ci` nochmal, ggf. `node_modules` löschen.
2. Native-Ordner veraltet? → `npx expo prebuild -p <android|ios> --clean`.
3. SDK/Tooling-Version geändert? → `package.json` und `app.json` vergleichen, Tool-Versionen prüfen.

## Tests, Lint, Typecheck (plattform-agnostisch)

```
npm test              # Jest
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
```

Diese Schritte laufen in beiden Umgebungen identisch und sollten vor jedem Push grün sein.
