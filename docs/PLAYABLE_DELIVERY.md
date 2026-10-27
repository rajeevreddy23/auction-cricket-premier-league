# Playable delivery increment — 27 October 2026

## Scope

This change extends the existing game; it does not replace the auction, purchased XI validation, score authority, fixtures, points, or playoff system. All geometry and animation changes are original procedural work. No WCC2 assets, code, branding, or real IPL identities were imported.

- Authoritative 1.2-second bowler run-up, held ball, one release event, and subsequent ballistic delivery. Optional run-up fields preserve older released checkpoints.
- Bowler translation and overarm action; stationary waiting pose between balls.
- Frame-updated batting approach cue, stable behind-batter delivery camera, and rejection of keyboard auto-repeat actions.
- Classic bowling presets apply length, swing and seam instead of silently discarding those controls.
- Fielders return collected balls to the wicket during the authoritative return timer. The stationary-ball timeout no longer ends an active return early.
- Radar tracks actual fielder positions. Online labels show purchased XI batter/bowler identities. Settings wrap, mobile controls stack, and changing practice role updates action availability immediately.
- Repeatable production-browser smoke script and CI step.

## Verification

Local Windows / Node 24.16.0 / installed Chrome:

- `npm run check`: passes.
- `npm test`: 92 passing, zero failing. Includes new run-up/release, legacy and mid-run-up checkpoint recovery, returned-ball motion, interleaved overs and stable delivery camera tests.
- Existing engine acceptance buys 110 players, confirms ten XIs, runs five interleaved physical matches, completes 70 league fixtures and playoffs/final, and checks independent tournaments.
- Live HTTP/WebSocket test admits five sessions and ten connected owners; now completes two concurrent deliveries through server ticks and socket inputs, checks one release/legal ball each, and verifies the other sessions remain ready. Transport setup seeds purchased squads; the separate auction and engine acceptance tests cover purchases.
- `npm run build`: passes; Vite warns that the game chunk exceeds 500 kB (about 545 kB minified, 143 kB gzip).
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities at verification time.
- `npm run test:browser`: desktop WebGL2, real DOM shot input scores six, six legal deliveries finish at 6/0 after 1.0 overs, and Exit disposes the game. At 390×844, touch-emulated Yorker preset/Deliver completes, with no page errors or page-level horizontal overflow. Desktop time is controlled through Playwright's browser clock; this checks functionality, not a real-time performance guarantee.

## Remaining work and limits

This remains a stylized procedural browser prototype, far below WCC2 visual fidelity. There are no licensed player models, production skeletal motion captures, manual fielder selection/throw aiming, or full replay animation state. Fielding and runouts use simplified AI/timers; LBW, no-balls, byes and comprehensive cricket law handling remain absent.

Online authoritative sessions, auction-owned XIs, IPL-style fixtures, points/NRR and Q1/Eliminator/Q2/Final already exist and remain covered. This increment does not prove a complete tournament through ten human browser sessions. Full internet deployment, real mobile hardware, latency/loss testing, anti-cheat hardening and sustained capacity/load measurement remain unverified. There is no demonstrated public multiplayer deployment from this change. Capacity is limited to five sessions in one Node/SQLite process; multi-host workers are not implemented.

Browser verification uses installed Windows Chrome with software-capable WebGL and mobile emulation. Linux GitHub Actions includes a Chromium installation and browser-smoke step; remote CI results must be checked on the PR. The browser smoke test requires the production bundle built first.
