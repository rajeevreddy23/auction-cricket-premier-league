# Phase 0 audit — 27 October 2026

## Existing stack

- TypeScript, Vite and Three.js browser client
- Node.js authoritative HTTP/WebSocket server
- SQLite WAL persistence
- Server-owned auction, squad, fixture, standings and cricket state
- Responsive web UI deployed through Render and ChatGPT Sites

## Working today

- Separate guest or username/password identities and revocable sessions
- Tournament creation with a unique ID/invite code
- Independent owners joining from separate devices, one franchise per owner
- Real-time, atomic auction bids with ₹120 Cr purse and ₹20 Cr player cap
- Purchased roster → playing XI → fixtures → isolated live matches
- Deterministic scoring, standings, playoffs and final
- Procedural Three.js practice and online cricket vertical slice

## Important gaps versus the visual reference target

- Procedural player shapes, not production rigged humanoid GLB/VRM characters
- One procedural stadium, not three authored stadiums or a 40-stadium catalog
- Small action set, not 45+ batting shots and 28 bowling actions
- Basic cameras and no replay director, DRS, wagon wheel or pitch-map presentation
- No weather/DLS flow, career mode, ODI/Test rules, progression economy or audio commentary
- No measured 60 FPS device matrix; the Render free service is not production autoscaling

## Upgrade phases

1. Foundation: clarify multi-device tournament joining, formalize game modules and asset licensing.
2. Stadium: three original environments, pitch surfaces, lighting profiles and scalable crowd.
3. Avatars: shared rig, original customization data and mobile LODs.
4. Animation: state machines, retargeted licensed clips and input-to-shot mapping.
5. Gameplay: richer pitch/contact physics, Classic/Pro controls, AI and field placement.
6. Broadcast: camera director, replay buffer and original DRS-style visualizations.
7. Presentation: TV scoreboard, graphs, pitch map and text commentary hooks.
8. Modes/performance: formats, progression, device profiles, profiling and production capacity.

WCC2 is used only as a feature and quality reference. No commercial assets, branding, names, faces, audio or extracted code are included.
