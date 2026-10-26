# User and host guide

## Guests and league registration
1. Run the Node backend locally, or connect a separately hosted HTTPS backend in Settings on the hosted frontend.
2. Choose your clubhouse identity and enter a nickname. This creates a stable guest token in this browser. Browser profiles/incognito windows represent different people for local tests. Keep the token private; clearing browser storage loses access to that guest identity. Email/Google login and guest upgrades are not implemented.
3. Create a tournament: choose name, 2/4/6/8/10 teams, 1–20 overs, public/private and integer virtual purse. Use virtual currency only.
4. Each participant joins the tournament and claims one franchise, including the host if the host wants a team. Share the displayed tournament/invite code with intended participants. All slots must be claimed before the host starts auction.

## Auction to Playing XI
The host opens the auction and nominates a catalog player. Owners compete with Bid while the server deadline is open. Late valid bids extend the lot according to its rules. Early Close is rejected; the server settles expired lots and persists the winner/purse. The host then nominates another player. Ensure each franchise purchases at least eleven players, including a wicketkeeper and five eligible bowlers/all-rounders, within the overseas limit. There are 160 fictional players. AI franchise filling and automatic auction bots are not implemented; human owners must bid.

When every roster is eligible and the last lot closes, finish auction. In My Squad choose eleven owned players, captain and wicketkeeper, then confirm. Each owner confirms separately. Host generates a single/double round-robin schedule, or the 70-match IPL-style format for ten teams. The scheduler prevents team clashes within a wave.

## Matches and standings
Host starts a ready fixture from Fixtures. Both team owners enter that match. The server waits for both authenticated owners to be present before stepping the simulation. Up to five separate sessions are admitted in the local runtime. Open Scorecard for a lightweight read-only view. Spectators cannot bowl, bat or submit scores.

The bowling owner sets line/speed/spin and clicks BOWL. The batting owner chooses direction/power/loft and times SWING. The ball has a short collision window near the batter; a tap triggers one swing per delivery. Request RUN while a hit is in play; running continues until cancelled. Cancel completes the current run and stops the next one. NEXT advances a completed delivery/innings. Owners exchange roles for the chase. Boundaries, wickets and match outcomes come from the server simulation. The supported rules are listed in ARCHITECTURE.md; this is not full cricket-law coverage.

Verified completed match results update standings automatically. The league's top four enter Q1 and Eliminator; their results resolve Q2 and the final. The tournament champion screen is text/graphic presentation, not a 3D trophy ceremony. Smaller leagues use a compatible smaller bracket.

## Recovery and host operations
Keep the server's database volume. On a brief disconnect the server pauses physical stepping until both owners return. After the configured grace period, the runtime slot is released and the session saved as paused. Host starts the same LIVE fixture to resume its committed checkpoint, then both owners rejoin. On server restart, unfinished sessions are restored paused. Recently uncheckpointed input can roll back after a hard crash. No automatic forfeit or AI takeover is implemented. Completed results cannot be edited through host controls.

The audit API is GET /api/tournaments/:id/audit with host Authorization; there is no full health/audit administration dashboard yet. /health reports local active count and capacity without private data.

## Build 0.3: permanent accounts and crore auction policy
The default identity dialog now offers Sign in and Create account. Register a unique username (3–32 letters/digits/_/-) and a password of10–128 characters. Re-enter the password to confirm. Sign in on another browser using the same credentials to recover the same user ID and franchises. Passwords are not saved in localStorage; the bearer session is stored there for signed-in access. Signing out revokes that session. Sessions expire after seven days. Password reset and email recovery are not available yet, so this is not a complete account-management product.

Each new franchise begins with ₹120 Cr in virtual currency; each player costs at most ₹20 Cr. One currency unit in storage is one lakh; bids accept crore inputs in .01 Cr steps. These are virtual funds only. Old development tournaments preserve their existing balances with a legacy label.

When WebGL is unavailable the app can show a simplified vector scene. The same scene geometry is projected without GPU materials/crowds. It may be slow and is not part of a certified supported-device profile. Use a WebGL-capable device for actual performance assessment.
