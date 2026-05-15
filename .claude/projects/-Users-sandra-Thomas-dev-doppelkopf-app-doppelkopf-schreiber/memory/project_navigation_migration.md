---
name: project-navigation-migration
description: expo-router → @react-navigation/native-stack migration completed in May 2026
metadata:
  type: project
---

Migration von expo-router auf @react-navigation/native-stack abgeschlossen (2026-05-15).

**Why:** expo-router wurde aus package.json entfernt, Einstiegspunkt auf `expo/AppEntry` geändert.

**Was geändert wurde:**
- `package.json`: expo `^49` → `^55`, `@react-navigation/native-stack` hinzugefügt, expo-router entfernt, main = `expo/AppEntry`
- `App.tsx` neu erstellt: NavigationContainer + createNativeStackNavigator (ersetzt `app/_layout.tsx`)
- `src/navigation/types.ts` neu: `RootStackParamList` mit allen 9 Routen
- `tsconfig.json`: `app/` in exclude, damit totes Code nicht type-geprüft wird
- 6 Screen-Dateien migriert: `useRouter` → `useNavigation`, `Stack.Screen` → `useLayoutEffect + setOptions`

**Migrationsregeln:**
- `router.push(path)` → `navigation.navigate('RouteName', params?)`
- `router.replace(...)` → `navigation.replace('RouteName', params)`
- `router.back()` → `navigation.goBack()`
- `router.replace('/')` → `navigation.reset({ index: 0, routes: [{ name: 'Home' }] })`
- `Stack.Screen options={...}` in Render → `useLayoutEffect(() => navigation.setOptions(...), deps)`

**How to apply:** Alle neuen Navigationsänderungen gegen `RootStackParamList` in `src/navigation/types.ts` typen. Die `app/`-Dateien sind totes Code (von tsconfig excludiert) und können bei Gelegenheit gelöscht werden.
