# Playable cricket verification - 27 October 2026

## Implemented behavior

The existing auction and tournament remain in place. Bought Playing XIs control both innings; all eleven fielding players are represented exactly once, including bowler and keeper. Purchased agility, fielding and wicketkeeping ratings affect movement and collection reach. Older nine-fielder checkpoints upgrade at the next delivery boundary.

Bowling starts with an authoritative 1.2-second run-up and one release event, followed by a gravity/bounce/swing/seam simulation. Classic presets apply length, swing and seam. Pro controls include front-foot position: a positive overstep yields a no-ball penalty and a subsequent free hit, carried over another no-ball or wide. Byes, leg byes, and simplified right-handed pad-contact/LBW decisions are implemented. Twenty-over bowling quotas limit each bowler to four overs and avoid consecutive overs; part-time bowlers from the purchased XI are available when specialists exhaust their allowance.

The batting cue updates every frame and the delivery camera stays behind the batter. Bowler animation and the original jointed character rig carry gloves, pads and shoes with their limbs. No WCC2, IPL, commercial player model, or real-player asset was copied.

Fielding owners can select the nearest fielder, move with WASD or touch arrows, and throw to either wicket after collection. Auto field restores computer chasing. Abandoned manual collections return after two seconds. Return throws animate to the chosen wicket and cannot end prematurely due to the stationary-ball timeout. Throw-end runouts identify the threatened batter.

Last-ball replay records root, joint and bat transforms, ball and fielder positions. Practice pauses during replay; online match authority continues, while match controls are blocked during playback. Replay is local and bounded, not an exported full-match replay.

The server advances physics in fixed 1/60-second steps, independently of its broadcast timer. Disconnected matches pause without advancing other sessions. The game disables controls when the match is waiting for both owners or paused.

## Verified locally

Windows, Node 24.16.0, installed Chrome:

- `npm run check`: passed, including TypeScript acceptance scripts.
- `npm test`: 106 passing, zero failing. Includes manual ownership/range checks, collection/throw/checkpoint recovery, front-foot/no-ball/free-hit behavior, byes/leg byes/LBW, all eleven fielders, legacy migration, over quotas, jointed rig and replay transform restoration. Existing auction and fixture/points/playoff tests remain passing.
- `npm run build`: passed. Vite warns about the game chunk above 500 kB (about 555 kB minified, 146 kB gzip).
- `npm run test:browser`: passed on the production build. Desktop WebGL2 and normal DOM inputs produce a timed six and a complete over at 6/0 after 1.0 overs. Replay preserves the score and blocks gameplay inputs; Exit disposes the game. At 390x844, touch controls select a fielder and manually throw a collected ball, complete a Yorker, and verify the no-ball/free-hit display. No page errors or page-level horizontal overflow. Browser clocks are controlled for functional reproducibility; this is not a frame-rate or real-device certification.
- `npm run test:online`: two independent two-team tournaments, four authenticated owners, 44 actual HTTP auction purchases and XI selections, two concurrent matches, four complete socket-driven league/final matches, verified points and champions, then persistence checks after a real server restart. No injected match state or score. The script runs real-time server physics against local HTTP/WebSocket connections.
- Separate five-session socket tests verify capacity, ownership, isolated inputs and persisted recovery. Engine acceptance purchases 110 players for ten owners, completes five interleaved physical sessions, all 70 IPL-style league fixtures and Q1/Eliminator/Q2/Final, and checks independent tournament standings/champions.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities at verification time.

Both GitHub checks on the preceding commit passed, including Linux Chromium. The updated workflow also runs the live online acceptance script. Latest-commit CI results are reported separately in the PR.

## Scope boundaries and remaining external verification

This is a playable original procedural 3D browser game, not WCC2 visual parity. Pad/LBW and runout geometry are simplified, the batting model assumes a right-hander, and rare laws/umpire discretion, dynamic field restrictions, weather/DLS, stumping and hit-wicket are not complete. The no-ball control currently models front-foot overstepping; every no-ball mode is not detected. Wide deliveries are settled by the simplified keeper flow. There is no licensed or motion-captured player library.

Online acceptance uses local clients, not ten human browser sessions over the public internet. Real mobile hardware, WAN latency/loss, sustained cloud load, anti-cheat hardening and multi-host workers remain unverified. Capacity stays bounded to five sessions in one Node/SQLite process. A public deployment has not been claimed: Render requires confirmation of the target workspace before its services can be inspected or deployed.

Rules reference: [ICC Men's T20I Playing Conditions, October 2026](https://images.icc-cricket.com/image/upload/prd/bsxcho7ufe2pjban0wjp.pdf), clauses 21-23 and 36. These inform the implemented subset, not a claim of complete ICC conformance.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:online
```

To use installed Chrome on Windows, set `$env:BROWSER_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'`. Optional `SCREENSHOT_DIR` saves browser evidence. Both acceptance scripts start and close their own isolated servers. The online check takes roughly a minute or two.
