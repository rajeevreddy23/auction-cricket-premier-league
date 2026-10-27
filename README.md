# Auction Cricket Premier League — development build 0.1

A real source implementation: transactional auction, purchased squads, tournament scheduling/standings/playoffs, Node WebSocket matches and an input-driven Three.js cricket vertical slice. **The full 28-section specification is not complete or production-ready.** See docs/PLAYABLE_DELIVERY.md for the latest verified scope.

## Local run
Requires Node.js 24+ (node:sqlite) and npm. From this directory:

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

Open http://localhost:3000 in separate browser profiles for separate owners. For a second device use the host's reachable LAN address and configure your firewall normally. Local HTTP is for development. Use a TLS reverse proxy for internet hosting. npm start persists guests/tournaments/auctions/checkpoints in data/acpl.db. Keep this volume when restarting. Never commit tokens or runtime data.

```sh
PORT=3000 DB_PATH=data/acpl.db MAX_MATCHES=5 DISCONNECT_GRACE_MS=120000 npm start
node --experimental-strip-types scripts/benchmark.ts
```

On Windows set variables in PowerShell with `$env:PORT='3000'`, or use defaults. Environment variables are documented in .env.example; automatic dotenv loading is not installed. `npm run dev -- --port 4173` serves the existing dist bundle and APIs; rebuild after frontend changes.

## Playing
Open **Practice** without an account on a WebGL-capable browser. Batting practice has a local AI bowler; bowling practice has a local batting driver. These local sessions never enter league standings. Space swings, B bowls, R requests runs, N advances a dead ball/innings; on-screen buttons support touch. Adjust line, speed, spin, shot direction, power and loft. A replay button visually replays the latest sampled ball trajectory; it is not a persisted full-match replay.

For real online play, see docs/USER_GUIDE.md. The separately published static frontend requires the Node service URL in Settings. HTTPS frontend needs an HTTPS/WSS backend and exact ALLOWED_ORIGIN. It cannot reach this environment's ephemeral localhost server from the user's phone.

## Build outputs and deployment
`npm run build` produces dist/ web assets. `npm start` serves those assets plus API and WS. The source contains a Dockerfile and GitHub Actions CI configuration; Docker/remote CI have not been executed here. To build after installing Docker:

```sh
docker build -t acpl:0.1 .
docker run --rm -p 3000:3000 -v acpl-data:/data acpl:0.1
```

Do not horizontally replicate this single-process SQLite runtime. Capacity five is an admission bound verified in local tests, not a production load guarantee. No Android APK, Windows native executable or iOS binary exists.

## Asset rights
All 160 player identities and all procedural stadium/character geometry are original fictional content. No real player photographs, WCC2 code/models, IPL marks or official team logos are included. Three.js and dependency license notices are in node_modules after installation; third-party licenses listed in docs/ASSETS.md.

## Online service setup (0.2)
See docs/ONLINE_DEPLOYMENT.md and render.yaml. The frontend is already published; its Settings screen can test a separately deployed backend. The prepared Render service needs your connected account and source repository access. No external multiplayer service is provisioned yet.

## Delivery and browser verification

The bowler now runs in for 1.2 seconds before the authoritative release. A frame-updated approach meter helps time batting. The automatic camera stays behind the batter throughout the delivery. Classic bowling presets now apply their length, swing and seam. Fielders return collected balls visibly to the wicket, and deliveries wait for the return to finish. Online batter/bowler labels use the selected Playing XI.

Run the production-browser smoke check after building:

```sh
npx playwright install chromium
npm run test:browser
```

It starts its own in-memory server and closes it afterwards. It uses a controlled desktop browser clock, normal UI input events, and real-time mobile touch emulation. It does not inject match state. On Windows you can use installed Chrome with `$env:BROWSER_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'`. Optional `SCREENSHOT_DIR` saves desktop/mobile screenshots. See [verification and remaining work](docs/PLAYABLE_DELIVERY.md).
