# AI-Board mobile (Android)

A native React Native (Expo) app — **not** a WebView wrapper. It talks to the
same AI-Board API as the web client and shares the auth, board, and AI command
contracts.

> Status: auth, workspaces, boards, a **native spatial canvas** (pan/zoom,
> draggable notes) with **live Yjs collaboration**, an edit sheet, and the
> **AI command agent** (edit the board from natural language) are implemented.

Lives in `apps/mobile` as a standalone Expo project (its own `npm install`,
intentionally outside the pnpm workspace so it builds with standard Android
tooling).

## Getting an APK

### Option A — GitHub Actions (no local Android setup)

The **Mobile APK** workflow builds a debug `.apk` on GitHub's runners and
uploads it as an artifact:

1. Push the branch, then open **Actions → Mobile APK → Run workflow**.
2. Optionally set the **backend URL** the app should default to (your LAN IP,
   e.g. `http://192.168.1.50:4000`, or a deployed `https://…`). Default is
   `http://10.0.2.2:4000` (Android emulator → host machine).
3. When it finishes, download the **ai-board-debug-apk** artifact and install
   it on your phone (enable "Install unknown apps").

You can also change the server later inside the app (**Settings → Backend URL**)
— no rebuild needed.

### Option B — Build locally

Requires Node 20+, JDK 17, and the Android SDK (Android Studio).

```bash
cd apps/mobile
npm install
# Run on a connected device / emulator (Metro dev server):
npm run android
# …or produce an installable APK:
npx expo prebuild --platform android --no-install
./android/gradlew -p android assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Running on iPhone / iOS

iOS apps can't be sideloaded from an `.ipa` the way Android takes an `.apk`
(Apple requires signing). The fast path needs **no build and no Apple account**:

### Expo Go (recommended for testing)

1. On the machine with the repo: `cd apps/mobile && npm install && npx expo start`
2. Install **Expo Go** from the App Store on the iPhone.
3. Scan the terminal QR code with the iPhone camera → the app opens in Expo Go.
   (Phone + computer on the same Wi‑Fi; if it won't connect, `npx expo start --tunnel`.)
4. In the app: **Settings → Backend URL** → `http://<your-computer-LAN-IP>:4000`.

All native modules used here ship with Expo Go, so the canvas, realtime and AI
agent all work.

### A real installable iOS app (EAS Build)

Needs an Apple Developer account (a free Apple ID works for a 7‑day development
build registered to your device; TestFlight/App Store needs the paid program):

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile preview --platform ios       # ad‑hoc / internal
eas build --profile development --platform ios    # dev build for your device
```

iOS App Transport Security is pre-configured (`NSAllowsLocalNetworking`) so the
app can reach an `http://` backend on your LAN; production should use `https://`.

## Pointing the app at your backend

The app needs to reach the AI-Board API/web server:

| Scenario | URL to use |
| --- | --- |
| Android **emulator** on the same machine as the server | `http://10.0.2.2:4000` |
| **Physical phone** on the same Wi‑Fi | `http://<your-computer-LAN-IP>:4000` |
| **Deployed** server | `https://board.yourcompany.com` |

Set it at build time (workflow input / `app.json` → `expo.extra.defaultApiUrl`)
or at runtime in the app's **Settings** screen. The realtime WebSocket URL is
derived automatically (`http→ws`, `+/realtime`).

For a physical device against a local stack, start the API bound to all
interfaces (`API_HOST=0.0.0.0`, already the default) and ensure
`CORS_ORIGINS`/firewall allow the phone.

## What's implemented

- **Auth**: login/register, persisted session (AsyncStorage), silent token
  refresh on 401.
- **Workspaces / Boards**: list and create.
- **Board canvas**: a native infinite canvas (`react-native-gesture-handler` +
  `reanimated`) — one-finger pan, two-finger pinch-zoom, individually draggable
  notes, tap-to-edit/delete sheet, and "+ Note".
- **Live collaboration**: connects to the Yjs realtime channel (Hocuspocus)
  with the JWT; edits sync across devices and show a live/peer indicator.
- **AI agent command bar**: type "add three notes about pricing", "connect
  Login to Database", etc.; the returned operations are applied to the live
  document, so collaborators see them too.
- **Settings**: change the backend URL at runtime.

## Next

- Render connectors/edges on the canvas (data already synced).
- Presence cursors and richer object types (matching the web client).
- On-device tuning of the gesture canvas (built and type-checked here, but the
  gesture/reanimated interactions are best refined on a real device).
