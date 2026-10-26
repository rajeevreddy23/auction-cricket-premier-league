# ACPL completion goal

## Goal

Complete the Auction Cricket Premier League as a verified online multiplayer platform where separate users join from separate devices, own one franchise each, conduct a server-authoritative auction, play with purchased squads in isolated interactive cricket matches, progress through league fixtures and playoffs, and determine a persistent tournament champion.

## Continuation rule

When the user says **continue**, **next**, **do it**, or asks for the next phase:

1. Inspect the current repository state and preserve working features.
2. Implement the next incomplete phase with working code.
3. Run TypeScript validation, the full automated test suite and the production build.
4. Fix reproducible failures before publishing.
5. Commit the verified source to GitHub.
6. Deploy it to Render and confirm the latest deployment is live.
7. Report exactly what is complete, what was tested and what remains.

Never label an unrun test as passed and never claim WCC2-equivalent professional assets unless production-quality licensed assets have actually been integrated and validated.

## Remaining planned stages

- Phase 7: broadcast UI, lower-thirds, wagon wheel, pitch map, runs-per-over and run-rate graphics, expanded text commentary.
- Phase 8: game modes, progression, quality polish and measured device performance.
- Production validation: persistent managed database, multi-phone acceptance test, network/reconnection test, security/load test, supported-device matrix and native packaging decision.

## Definition of complete

- Different users can create password accounts and join one tournament from different devices.
- Each owner controls exactly one franchise in that tournament.
- The auction is atomic, live and server-authoritative with ₹120 Cr per team and ₹20 Cr maximum per player.
- Purchased players form the franchise squad and selectable Playing XI.
- Two owners play an interactive server-authoritative cricket match.
- Multiple matches and tournaments remain isolated.
- Verified match results update standings and net run rate.
- Playoffs produce exactly two finalists and one persistent champion.
- Supported disconnect/restart recovery, security and measured load tests pass.
- Declared web/mobile/desktop targets are validated on a published supported-device matrix.
- All bundled assets are original or properly licensed and documented.

Professional rigged characters, production mocap, native app signing and paid scalable infrastructure remain external dependencies until supplied and validated.
