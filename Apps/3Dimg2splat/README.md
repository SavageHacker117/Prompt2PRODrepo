SPLATS 2 WEB — 3D Open World Block Builder

A procedural voxel sandbox that runs entirely in the browser (Three.js + WebGL).
Streamed chunks, instanced meshes, build tools (place/remove), hotbar palette, blueprints, mini-map, save/load, and an optional splat-asset pipeline.

https://user-images…
 (drop your demo video link here)

Quick start
# Node 18+ recommended
npm i
npm run dev


Open the URL shown by Vite (usually http://localhost:5173).

If you see a blank page, check the console (F12) for missing asset paths (see Troubleshooting).

Production build
npm run build
npm run preview

Controls

Cameras

1 = Orbit • 2 = First-person • 3 = Fly
(or click the buttons on the top-left toolbar)

Build / Edit

Left-click → place a block

Right-click → remove a block

Number keys 1–0 → select hotbar slot/material

A translucent ghost cube previews snap position

Modes

O = Edit mode • P = Play mode

UI

Backtick ` (the key under Esc) → toggle dev console

M → toggle gamepad overlay (if a controller is connected)

Save/Load/Export

Top-left toolbar: Save, Load, Export JSON (world state)

UI at a glance

World Menu (right)
Prompt input, Seed again, Splat textures (Toggle / LOD), Time of day, and Export splat JSONs.

World Controls (right)
Sea level and Height offset sliders, Rebuild.

Palette (bottom-left)
Click to choose a material. Hotbar also mirrors 1–0.

Blueprints (bottom-center)
Drop prebuilt shapes (small house, round tower, tree).

Mini-map (bottom-right)
View of terrain footprint.

Tip: If you place a block while pointing at water, the engine snaps placement to the terrain surface + 1 so you can build above the shoreline.

Dev console & commands

Press **** (backtick) to open the small in-game console. Commands are defined in src/grammar/debugCmds.js`.

help                         – list commands
seed <text>                  – regenerate world using the prompt grammar
lod <low|med|high>           – set splat LOD tier (texture detail)
rose.bake                    – convert /assets/modelsGLB/rose.glb → rose.splats.json
rose.spawn                   – (placeholder) spawn a baked splat if you wire a loader
weather <clear|rain|snow>    – set weather (if module present)
time <HH:MM>                 – set day-night clock (e.g., time 18:30)
ui <on|off>                  – show/hide the UI root
prof                         – toggle frametime/FPS overlay


seed ... uses the prompt grammar to produce a structured world spec, then rebuilds the height/biomes pipeline.

lod ... toggles the runtime texture pack used by the materials library.

rose.bake bakes a GLB into Gaussian splats JSON and triggers a download (see next section).

Prompt grammar (cheat sheet)

The grammar favors plain English with keywords. Unknown words are ignored.

Examples:

seed steep mountains NE-SW with 2 rivers, west coast
seed rolling plains with one river, sea 10, snow caps
seed desert with dunes E-W, sea 4, cliffs, oases


Supported hints:

Landforms: mountains, plains, hills, desert, dunes, cliffs, valley

Rivers: with <N> rivers

Coast: west coast, east coast, north coast, south coast, NE/SW flow hints

Sea level: sea <number> (overrides current UI sea level)

Optional: snow caps, rocky, lush, etc. (best-effort mapping)

You can always tweak Sea level and Height offset in World Controls after seeding.

Splat asset pipeline

This project can render Gaussian splat icons/textures at runtime and export them as .splat.json.

Toggle: World Menu → Splat textures → Toggle

LOD: Low / Medium / High in the same menu

Baking a GLB into splats

Put a model at: public/assets/modelsGLB/rose.glb (or adjust the path in debugCmds.js).

Open the dev console (```).

Run: rose.bake
→ Generates and downloads rose.splats.json.

(The rose.spawn command is a placeholder—wire your loader in splats/SplatCatalog.js to add it to the scene.)

World sizes & performance

The engine streams chunks around the camera (32×32×H), so the world feels endless.

Switch cameras (Orbit/FPS/Fly) depending on the scene.

Use LOD (Low/Medium/High) and Sea/Height sliders to tune perf.

Render-distance and world size presets (Small/Large/Endless) are on the roadmap.

Project structure (relevant bits)
src/
  main.js                     # app bootstrap & render loop
  styles/main.css             # UI styling
  controls/
    InputManager.js           # click place/remove, ghost preview, hotbar
    GamepadInput.js           # HID polling
    ControllerOverlay.js      # on-screen controller HUD
  world/
    WorldGenerator.js         # chunk streaming & instanced meshes
    MaterialLibrary.js
    WorldState.js             # save/load & undo/redo helpers
  terrain/pipeline/
    TerrainPipeline.js        # height → rivers → waterline → materials
    steps/
      HeightField.js
      Rivers.js               # gradient-descent river mask (carves)
      Water.js
      Biomes.js
  ui/
    UIManager.js              # palette/blueprints/minimap/toolbar
    PlayHUD.js
    WorldPanel.js             # sea level / height offset controls
    MainMenu.js               # prompt, seed again, splat toggles, export
  grammar/
    debugCmds.js              # dev console commands (seed, lod, rose.bake…)
    console.js                # minimal in-game console (backtick)
    userPromptsLang.js        # prompt → spec parser (keyword-based)
  splats/
    SplatBaker.js             # GLB → splats JSON

Troubleshooting

Vite overlay says a file can’t be resolved
Make sure the asset exists under public/ and the import path matches.
Example for baking: public/assets/modelsGLB/rose.glb.

Rivers warning:
[Rivers] skipped: invalid field interface means the river carver received an unexpected field shape. It falls back safely; reseed or check TerrainPipeline.js to ensure applyRivers(base.height, seed, params) is used.

Nothing happens on click
Click directly on the canvas (not on UI). Left-click places, right-click removes. If pointing at water, placement snaps to terrain surface.

Performance
Lower LOD (World Menu), reduce window size, or fly lower to stream fewer chunks.

License

MIT (or your preferred license).

That’s it—run npm run dev, hit backtick for the console, try:

seed steep mountains NE-SW with 2 rivers, west coast
lod high


…and build!