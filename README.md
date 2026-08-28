# GYM Management App

Flutter app + Next.js backend + MongoDB for gym membership management, wired
to a Hikvision MinMoe (K1T320-B series) face/fingerprint terminal for door
access control.

## How access control works

- Every member gets a numeric **Device ID** (`deviceUserId`) when registered
  in the app.
- Staff physically enrolls the member's face/fingerprint **on the terminal**,
  typing in that same Device ID as the employee number.
- When the app creates or renews a membership, it calls the terminal's ISAPI
  (`src/lib/isapi.ts`) to set that person's **access-valid window** to match
  the membership period (`Valid.beginTime` / `Valid.endTime`).
- The terminal enforces this window **on its own** — once a membership
  expires, the device itself refuses that person's face/fingerprint and the
  door stays locked, with no dependency on network connectivity at that
  moment. A daily backend job (`scripts/cron.ts`) only syncs the app's own
  `status` field for renew-reminder UI; it doesn't need to touch the device.
- Every verification attempt (granted or denied) is pushed by the device to
  `/api/webhooks/device-events` and logged for the Access Logs screen.

## Backend (`backend/`) — Next.js + MongoDB

```
cd backend
npm install
npm run seed   # creates default plans (edit fees anytime in-app) + owner login
npm run dev    # http://localhost:3000
npm run cron   # separate process: daily membership-status sync
```

### Login (username + password)

`npm run seed` creates one login: username `Gym`, password `Fitness@2026`
(role `owner`). To add another staff account, either call
`POST /api/auth/register` with `{ name, username, password }` once logged in,
or insert another `Admin` document directly in MongoDB.

Config: `backend/.env.local`
- `MONGODB_URI` — defaults to `mongodb://localhost:27017/gym`
- `BACKEND_PUBLIC_URL` — LAN address of this backend, used when registering
  the terminal's event-push target

### Adding the terminal

In the app: Settings → Biometric Terminals → Add, with the terminal's LAN IP
and its ISAPI username/password (same credentials used to log into the
device's web admin page). The backend digest-authenticates against ISAPI
(`src/lib/digestFetch.ts`) — no cloud/Hik-Connect account needed.

Hikvision firmware varies slightly across models/versions in field names and
endpoint paths for `UserInfo/Record`, `UserInfo/Modify`, and the event-push
setup — if calls fail, check the device's own ISAPI documentation (usually
reachable at `http://<device-ip>/doc/` or in Hikvision's ISAPI PDF for your
firmware) and adjust `src/lib/isapi.ts` accordingly.

### API surface

Auth: `POST /api/auth/login` (mobile app login), `POST /api/auth/register`
  (create additional staff/owner accounts)
Plans: `GET/POST /api/plans`, `PUT/DELETE /api/plans/:id`
Members: `GET/POST /api/members`, `GET/PUT/DELETE /api/members/:id`,
  `POST /api/members/:id/renew`, `POST /api/members/:id/toggle`,
  `POST /api/members/:id/enrolled`
Devices: `GET/POST /api/devices`, `POST /api/devices/:id/sync`
Logs: `GET /api/logs`
Dashboard: `GET /api/dashboard/stats`
Device webhook: `POST /api/webhooks/device-events` (called by the terminal, not the app)

All routes except `/api/auth/*`, `GET /api/plans`, and the webhook require
`Authorization: Bearer <token>`.

## Mobile (`mobile/`) — Flutter

```
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:3000
```

`10.0.2.2` (the default in `lib/config.dart`) only reaches the host machine
from the Android **emulator**. For a physical phone or the terminal's own
network, pass your machine's LAN IP via `--dart-define` as above.

Screens: Login (username/password), Dashboard (stats), Members (list/search/filter, add,
detail with renew/suspend/enrollment-tracking/payment history), Membership
Plans & Fees (CRUD), Biometric Terminals (device setup, under Settings),
Access Logs, Settings.

### Android release build

`android/key.properties` + `android/keystore/*.jks` hold the real release
signing key (gitignored, generated locally — back these up, losing them
means future updates can't be signed the same way and users would have to
uninstall/reinstall). The release build type in `android/app/build.gradle.kts`
uses them automatically when present, falling back to the debug key
otherwise. Build with:

```
flutter build apk --release --split-per-abi --dart-define=API_BASE_URL=http://<your-lan-ip>:3000
```

`--split-per-abi` produces a much smaller per-architecture APK
(`app-arm64-v8a-release.apk` covers most modern phones) instead of one ~47MB
universal APK. The backend's LAN IP is baked in at build time — rebuild
whenever it changes. Installing a non-Play-Store APK will always show
Android's "Install unknown apps" prompt; that's the OS's own protection for
any sideloaded app and isn't something to bypass, only something proper
signing (done here) keeps from looking untrustworthy on top of.

`android/app/src/main/res/xml/network_security_config.xml` explicitly
allows plain HTTP only to the backend's specific LAN IP (Android blocks
cleartext HTTP everywhere else by default since API 28) — update the IP
there (and in `ios/Runner/Info.plist`'s `NSAppTransportSecurity` block) if
the backend's address changes.

### iOS build (needs Codemagic — Windows can't build iOS directly)

Flutter's iOS toolchain requires Xcode, which only runs on macOS. With an
Apple Developer account but no Mac, `codemagic.yaml` (repo root) is set up
to build and publish to TestFlight from Codemagic's cloud Mac runners —
TestFlight installs cleanly with no "unknown source" warnings at all, which
is the properly-signed equivalent of what direct APK installs can't offer.

To use it:
1. Push this repo to GitHub/GitLab/Bitbucket.
2. Sign up at codemagic.io, connect the repo.
3. Apple Developer portal: register App ID `com.gymapp.gymApp` (or change
   the bundle ID in `mobile/ios/Runner.xcodeproj` first if you'd rather use
   your own).
4. App Store Connect: create the app record with that same bundle ID.
5. Codemagic → Team settings → Integrations → connect your Apple Developer
   account (this is what `integrations.app_store_connect` in the yaml
   refers to — rename the `codemagic` placeholder there to match).
6. Codemagic → Team settings → Environment variable groups → create
   `app_config` with `API_BASE_URL` (your backend's public/LAN URL).
7. Trigger the `ios-testflight` workflow. On success it publishes straight
   to TestFlight; add yourself as a tester in App Store Connect to install
   it on your iPhone via the TestFlight app.
