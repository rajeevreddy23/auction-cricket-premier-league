# ACPL architecture and delivered boundaries

## Delivered architecture
The repository is a TypeScript modular monolith, with shared deterministic cricket simulation, a browser Three.js client, and an authoritative Node.js HTTP/WebSocket server. Browser build uses Vite and DOM TypeScript. This deliberately departs from the preferred Next.js/Unity stack: a shared browser/server simulation can execute in this environment without Unity/.NET and provides one rules implementation. It does not establish that this engine performs better than Unity on phones. Native cross-platform quality remains untested.

Source layout:
- src/core/auction.ts: fictional identities, integer virtual purse, timed lots, ordered bid validation, roster/XI rules.
- src/core/tournament.ts: lifecycle, fixture graph, standings and playoff dependency graph.
- src/core/cricket.ts: deterministic ball trajectories, input collision window, runs, assisted interception, wickets, innings/Super Overs.
- src/server/store.ts: SQLite WAL schema v1 and transactional aggregate persistence.
- src/server/index.ts: bearer-token guest auth, API, WebSocket transport, isolated 30Hz match loop, capacity and presence/checkpoints.
- src/web: responsive clubhouse interface, scoreboard and procedural WebGL scene.
- tests: domain correctness, HTTP/WebSocket integration, restart recovery and full deterministic engine-input tournament drivers.

A Node worker hosts at most five active sessions by default. Match state lives in separate objects keyed by match UUID. Tournament identifiers and owned-XI player IDs connect auctions to fixtures and game characters. Each match owner controls their current batting/bowling role. Clients submit bounded controls with monotonically increasing sequence numbers. They cannot submit runs, wickets, sold rosters or final results. Host result-edit endpoints do not exist.

A synchronous SQLite BEGIN IMMEDIATE transaction encloses each auction mutation; this serializes bids in one process. Token values are random opaque capabilities; only SHA256 hashes persist. This local architecture must NOT be scaled by starting multiple independent Node loops against one database. It has no distributed lock or match lease protocol.

The build published through Sites is the static browser bundle. It supports local practice on WebGL-capable browsers and an explicit connection setting for a separately hosted Node backend. It does NOT include a hosted multiplayer server, persistent hosted accounts, PostgreSQL or Redis. Running npm start serves both the built frontend and backend on the same origin.

## State and recovery
Tournament lifecycle follows DRAFT -> REGISTRATION -> AUCTION -> SQUAD_VALIDATION -> FIXTURES_GENERATED -> LEAGUE_IN_PROGRESS -> LEAGUE_COMPLETED -> PLAYOFFS/FINAL -> TOURNAMENT_COMPLETED. Only defined transitions are accepted. Two-team leagues proceed to a direct final. Completed fixture results are immutable/idempotent; their innings update aggregate NRR. All-out innings consume their allotted quota. Super Over figures do not enter NRR. DLS/reduced-over adjustments beyond supplied quotas are not implemented.

SQLite commits auction sales and verified match results. Active simulations checkpoint approximately each second, including physics, input sequences and score. A graceful shutdown checkpoints sessions; startup restores them paused. A hard crash can roll back up to the last committed checkpoint: zero-loss recovery is not promised. Hosts resume fixtures and players reattach using existing identities. This is checkpoint recovery, not a separate durable per-input event log. The match event list is bounded commentary, not a complete replay ledger.

## Production architecture still required
Separate auth/API, tournament and auction services; PostgreSQL transactions/constraints; Redis presence and pub/sub; signed expiring match join tokens; dedicated process/container match workers with fencing leases; bounded fair admission queue; durable per-input/event stream; object storage/CDN; external TLS ingress; telemetry and alerts; security review; measured horizontal scaling. The requested logical service list is an intended decomposition, not eleven deployed services.

Cloudflare Sites static hosting cannot execute this long-running Node websocket match loop. Provision a Node24 host with TLS and durable disk to run the local server, or implement/deploy the production services before inviting competitive users. Native Android/Windows/iOS builds and Apple signing are absent.

## Rules limitations
This is a playable developing cricket vertical slice, not WCC2 feature parity. Current simulation covers gravity/bounce, timed contact, directions/power/loft, boundaries, manual run requests, assisted catching/interception/throws, bowled/run-out, wides, overs, innings, scorecards, chase completion and repeated Super Overs. Not yet implemented: toss choice, LBW, no-balls/free hits, stumpings, powerplays, formal bowling quotas, seam/swing aerodynamic models, varied bowling releases/shot-specific animation, manual field placement/control, stamina fatigue, licensed/professional character animation, commentary audio, full-match replay and trophy ceremony. Player power/accuracy currently influence gameplay; other stored ratings are not fully modeled. Run cancel stops a subsequent run after finishing the current run. Super Over batter/bowler statistics remain cumulative in the current scorecard.
