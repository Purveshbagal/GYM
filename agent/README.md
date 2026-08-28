# Gym Device Agent (Phase 2 — foundation)

Runs on a Windows PC inside the gym, on the same LAN as the Hikvision
terminal. It is the only thing that talks to the terminal (local IP, ISAPI
digest auth) and the only thing on that LAN that talks to the backend
(outbound HTTPS/HTTP). The Hikvision device itself never needs internet
access or a public IP.

Phase 2 scope: connects to the device (read-only `deviceInfo` check),
authenticates to the backend with its own agent credential, sends a
heartbeat, polls for jobs, and can execute the one safe job type that
exists so far (`GET_DEVICE_STATUS`). Fingerprint/face enrollment, door
control, and attendance sync are **not** implemented yet — see the root
conversation for why (pending the Phase 1 capability probe).

## Folder structure

```
agent/
  src/
    index.ts          entrypoint: setup wizard or main loop
    setup.ts           first-run CLI wizard + connection tests
    config.ts           load/save config.json, encrypt/decrypt secrets
    secretStore.ts        AES-256-GCM encryption for the device password + agent token
    paths.ts               where config/log/queue files live (%PROGRAMDATA%\GymDeviceAgent)
    backendClient.ts         HTTPS calls to the backend (heartbeat, jobs, results)
    deviceClient.ts           Hikvision ISAPI calls (via ../shared/isapi)
    heartbeat.ts               30s heartbeat loop with backoff
    jobPoller.ts                 5s job-poll loop with backoff
    retryLoop.ts                  generic retry/backoff runner
    queue.ts                       local SQLite outbox (foundation for later phases)
    logger.ts                       structured console + file logging (secrets redacted)
    types.ts                         shared TypeScript types
  scripts/
    build.js            esbuild bundle -> dist/agent.cjs
    package-exe.js        pkg -> release/GymDeviceAgent.exe (+ batch files + better-sqlite3)
  Start-Gym-Agent.bat   double-click launcher (runs setup if unconfigured)
  install-agent.bat      first-time install + optional Windows-login auto-start
  package.json / tsconfig.json
```

Shared with the backend: `../shared/isapi/digestFetch.js` and
`../shared/isapi/isapiClient.js` — the exact same ISAPI digest-auth code
`backend/src/lib/isapi.ts` re-exports, so there's one implementation to
keep in sync, not two.

## 1. Install dependencies

```
cd agent
npm install
```

## 2. Run in development

```
npm run dev
```

First run with no saved config automatically starts the setup wizard. To
force the wizard again later: `npm run setup`.

## 3. Configure the first gym

Two things are needed before running setup: a **device on the LAN** (the
real Hikvision terminal, or nothing yet if you're just testing the wizard)
and an **agent credential** from the backend admin. Provision one from the
backend:

```
cd backend
npm run create-agent -- --gym GYM001 --name "Main Entrance" \
  --ip 192.168.1.201 --username admin --password <hikvision-admin-password>
```

This prints an `Agent ID` and `Agent Token` **once** — copy them now. Then,
back in `agent/`:

```
npm run setup
```

Enter:
- Backend URL — e.g. `https://your-vps-domain-or-ip`
- Gym ID — must match `--gym` above (e.g. `GYM001`)
- Agent ID / Agent Token — from `create-agent`'s output
- Hikvision Machine IP / Port / Username / Password — same device

Setup only saves configuration if **both** tests below pass.

## 4. Test Hikvision connectivity

Setup runs this automatically (or re-run anytime with
`npm run dev -- --test-connection`, or `GymDeviceAgent.exe --test-connection`
once packaged). It calls `GET /ISAPI/System/deviceInfo` with digest auth —
read-only, changes nothing on the device — and expects:

```
✓ Machine reachable
✓ Authentication successful
✓ Device model detected: <model> (firmware <version>)
```

If it fails: check the IP is reachable from this PC (`ping <ip>`), that
port 80 (or your configured port) isn't blocked, and that the
username/password match the device's own web-admin login.

## 5. Test backend connectivity

Same command shows:

```
✓ Backend connected
```

If it fails: check `Backend URL` is reachable from this PC (no trailing
slash needed — the agent strips it), and that the Agent ID/Token match
what `create-agent` printed (they're single-use as displayed — if lost,
rerun `create-agent` for that device, which issues a new token).

## 6. Verify heartbeat is reaching the backend

Once running (`npm run dev` or the packaged exe), the agent logs
`Heartbeat sent { deviceOnline: true/false }` every 30s. To confirm it
landed in MongoDB, check the device document — `lastSeenAt`, `online`,
`deviceModel`, `serialNumber`, `firmwareVersion` should all be populated
and recent:

```js
// mongosh mongodb://<your-mongodb-uri>
db.devices.findOne({ agentId: "AGENT-..." })
```

## 7. Verify job polling

Insert a test job directly (until the backend has a UI/endpoint that
creates real jobs — that's a later phase):

```js
db.devicejobs.insertOne({
  gymId: "GYM001",
  device: ObjectId("<device _id>"),
  agentId: "AGENT-...",
  type: "GET_DEVICE_STATUS",
  status: "PENDING",
  attempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

Within ~5s the agent log should show `Received 1 pending job(s)` then
`Job completed`, and the document's `status` should flip
`PENDING → PROCESSING → SUCCESS` with a `result` containing the device's
model/serial/firmware.

## 8. Build the bundle

```
npm run build
```

Produces `dist/agent.cjs` (esbuild bundle; `better-sqlite3` stays external
since it's a native addon and can't be bundled).

## 9. Package into GymDeviceAgent.exe

```
npm run package
```

Runs the build, then `pkg` (targets `node18-win-x64`), then copies
`better-sqlite3`'s native module folder and both `.bat` launchers next to
the exe. Output: `release/` — this whole folder is what you copy to the
gym PC (not just the .exe alone, because of the native module).

```
release/
  GymDeviceAgent.exe
  node_modules/better-sqlite3/   <- required alongside the exe
  Start-Gym-Agent.bat
  install-agent.bat
```

## 10. Deploy to a gym PC

1. Copy the whole `release/` folder to the gym's Windows PC (no Node.js
   install needed there — the exe is self-contained).
2. Run `install-agent.bat` — it runs setup, then optionally registers a
   Startup-folder shortcut so the agent launches on Windows login.
3. For everyday start/stop, use `Start-Gym-Agent.bat`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `✗ Hikvision connection failed (HTTP 401)` | Wrong username/password for the device's own web-admin login |
| `✗ Hikvision connection failed` with no HTTP status / `fetch failed` | Wrong IP/port, device powered off, or not on the same LAN as this PC |
| `✗ Backend connection failed: HTTP 401` | Agent ID/Token don't match a device record — rerun `create-agent` |
| `✗ Backend connection failed: HTTP 500` immediately after starting the backend | MongoDB connection was still establishing on the backend's first request; safe to retry after a few seconds |
| `Backend connection failed: fetch failed` | Backend URL wrong/unreachable, or (in production) a self-signed HTTPS cert — use a real domain + valid TLS cert on the VPS instead of a bare IP with a self-signed cert |
| Heartbeat logs `deviceOnline: false` but device is fine | Check the agent's own network path to the device IP, not the backend — the two checks are independent by design |
| Agent won't start, no log at all | Check `%PROGRAMDATA%\GymDeviceAgent\agent.log` directly; `%PROGRAMDATA%` needs to be writable by the account running the agent |

Config, encryption key, log, and local queue all live in
`%PROGRAMDATA%\GymDeviceAgent\`. Deleting `config.json` there forces
first-run setup again (the Hikvision password and agent token are AES-256-GCM
encrypted in that file, never plaintext — see `src/secretStore.ts` for the
threat model this does and doesn't cover).
