# Assets and attribution

- Fictional 160-player dataset: original deterministic generation in src/core/auction.ts. No real names, photographs or likeness rights required by that dataset.
- Stadium, crowd, pitch, bats, wickets, clothing, characters, floodlights and ball: procedural original geometry/materials in src/web/game.ts. Crowd is instanced geometry. These are simple stylized models, not professional animation assets.
- Harbour Crown Ground, Highland Pavilion and Desert Star Arena profiles: original procedural configurations in src/web/game/stadiums.ts. They use no downloaded stadium mesh or commercial texture.
- Twenty fictional face-shape profiles, seven skin tones and five hair profiles: original procedural parameters in src/web/game/avatars.ts. They are not scans or likenesses of real cricketers.
- Player motion poses and blending state machine: original procedural animation code in src/web/game/animation.ts. No commercial motion capture clips are bundled.
- Camera profiles, automatic broadcast director and ball-path review graphics: original code and SVG presentation in src/web/game/camera.ts and src/web/game.ts. They do not use Hawk-Eye or another vendor's assets or branding.
- Dashboard bat/ball art: original CSS geometry. Navigation icons: inline SVG paths in app source.
- Three.js: MIT, https://github.com/mrdoob/three.js/blob/dev/LICENSE
- ws: MIT, https://github.com/websockets/ws/blob/master/LICENSE
- Vite: MIT, https://github.com/vitejs/vite/blob/main/LICENSE
- TypeScript: Apache-2.0, development compiler.
- Google Fonts styles import Barlow Condensed and DM Sans. Font network loading may fail; CSS supplies system fallbacks. These are available under the SIL Open Font License; distribute font license files before bundling font binaries. No font binaries are bundled here.
- No IPL/WCC2 proprietary source, trademarks, uniforms, player photos, models, soundtrack or commentary are bundled. The references describe feature goals only.

Dependency packages include their full upstream notices after npm ci. Recheck licenses and product branding before distribution. No assets are claimed to be purchased or externally licensed.
