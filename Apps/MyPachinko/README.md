
# My Pachinko — Ultimate Master (Mega Expanded Edition)

Flash Lightning Studios — **FLSgames.com**

WebGL Three.js + Vite build. No AI gameplay — NeRF docs included as **rendering references only**.

## Quickstart
```bash
npm i
npm run dev
# open http://localhost:5173
```
or build:
```bash
npm run build && npm run preview
```

## Controls
- **Drop Ball**: spawns a ball at top center.
- **Spawn Amarion**: spawns a bonus orb (red/blue/gold/shadow).
- Buckets along the bottom apply multipliers and update the HUD.
- Particles, basic collisions & damping are implemented in JS.
- Shaders & post FX are placeholders (glow / pulse).

## Notes
- All `assets/sounds/*.txt` are placeholders — replace with audio files named the same.
- PNGs are placeholders; replace with production art using the same filenames.
- NeRF/graphics references are provided in `/docs`.
