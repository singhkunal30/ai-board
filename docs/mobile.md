# AI-Board mobile (Android)

A native React Native (Expo) app — **not** a WebView wrapper. It talks to the
same AI-Board API as the web client and shares the auth, board, and AI command
contracts.

> Status: **first native slice.** Auth, workspaces, boards, a board screen
> (view/add/delete items) and the **AI command agent** (edit the board from
> natural language) are implemented. The native spatial canvas with live Yjs
> collaboration is the next slice.

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
- **Board screen**: view objects as cards, add/delete notes (persisted to the
  board snapshot), and an **AI agent command bar** — type "add three notes
  about pricing", "connect Login to Database", etc. and the board updates.
- **Settings**: change the backend URL at runtime.

## Next slice

- Native spatial canvas (pan/zoom, draggable notes) via
  `react-native-gesture-handler` + `reanimated`.
- Live multi-user collaboration through the Yjs realtime channel (already used
  by the web client).
