# DAWN2 – Runtime, Console, Perf & Editor Cheatsheet

This README documents the current **runtime controls**, **HUD**, **console grammars**, and the new **GPU / perf tools** you wired into DAWN2.

It’s meant to live alongside the code in `src/` so you can demo, onboard, or sanity-check scene budgets while you build out MMO-scale encounters.

---

## 1. Selection, Transforms & Play Mode

**Selection**

- **Ctrl + Left-click** in the viewport → select an actor, spawn gizmo, or any mesh.
- Selection walks up the parent chain and prefers:
  - `userData.pickRoot`
  - `userData.isActorRoot`
  - otherwise the highest mesh / group under `Scene`.

**Transform gizmo** (when implemented)

- **G** – Translate  
- **R** – Rotate  
- **S** – Scale  
- **Delete** – Remove selected actor roots / blocks from the scene.

**Play / Edit**

- **9** – Toggle **Play / Edit** mode.  
- In Play mode, the movement controller and runtime systems (mobs, ocean, etc.) tick normally.

---

## 2. HUD, Docks & Options (Esc)

The HUD is the React UI you see at the top-right (World / Spawns / Actors / Scene / Anim / Ocean).

### Layout & Docks

- Default layout:
  - **Scene** at the bottom dock.
  - **Anim / Actors / World** on the right dock.
- The dock layout is saved in localStorage under `hud-dock-layout-v4`.
- **Esc → Options → Reset Dock Layout** restores the default layout if things get weird.

### Options Modal (Esc)

Press **Esc** to open the Options modal.

#### UI section

- **Lock UI** – prevents dragging/resizing of HUD panes and splitters.
- **Compact UI** – tighter spacing, smaller fonts.
- **Show Debug Console** – toggles the in-game console overlay. This flag is persisted under `hud-ui-options-v1`.

#### Renderer (GPU) section

These controls send `ui:renderer` events that the main app listens for and apply directly to the `THREE.WebGLRenderer`:

- **Pixel Ratio**
  - `Auto` – uses `window.devicePixelRatio`.
  - `1`, `1.5`, `2` – fixed device pixel ratios.
  - Lower values = less fill-rate / VRAM usage, higher values = sharper image but more GPU load.

- **Shadows**
  - Checkbox: **Shadows on/off**
    - **Off** → `gl.shadowMap.enabled = false` (no shadow pass, big perf win).
    - **On** → `gl.shadowMap.enabled = true`.
  - Mode dropdown (when Shadows are on):
    - **PCF** → `THREE.PCFShadowMap`.
    - **PCF Soft** → `THREE.PCFSoftShadowMap` (slightly softer but a bit more cost).

- **Exposure**
  - Slider `0.2 → 2.0` mapped to `gl.toneMappingExposure`.
  - Useful for brightening dark scenes or toning down HDR lighting.

> These knobs are **always live** – you can drag the sliders while perf tools are running and watch the impact in the Perf HUD / `perf watch` output.

---

## 3. Debug Console & Log Bus

The console lives at `src/console/DebugConsole.tsx` and is backed by a small global log bus (`window.__log`).

### Opening / Closing

- **Esc → Options → Show Debug Console** – master on/off.  
- **Backtick** **`** – toggles the console overlay open/closed (when enabled).  
- Console is placed at the top left and can be used while the scene is running.

### Log Bus

Anything can push lines into the console log via:

```ts
window.__log.add("some text")
window.__log.clear()
window.__log.get()       // returns an array of lines
```

Each line is timestamped like `[19:38:44] message`.

### Copy Log Button

- The console has a **“Copy log”** button in the top-right.
- This copies the entire current log buffer to the clipboard as plain text.
- After copying, a line is added to the log:  
  `console: log copied to clipboard`.

### Console Commands Basics

Commands are registered via grammars using:

```ts
dbg.extend(name, handler, helpText)
```

Handlers receive `args: string[]` and can return either a string or an array of lines.

Special commands built into `DebugConsole`:

- `help` – lists all registered commands and their help text.
- `clear` – clears the console log.
- `log tail [n]` – prints the last `n` log lines (default ~30).
- `log clear` – clears the log.

Hotkeys wired in the console:

- **`** – toggle console overlay.  
- **H** – quick **bones toggle** for the active actor (same as `bones toggle`).

---

## 4. Core Grammars & Commands

Grammars live in `src/grammars/` and are registered in `src/grammars/index.ts` via `registerGrammars(dbg, engine, levels, extras)`.

Each grammar exposes a help entry. Typing `<name> help` usually prints all sub-commands.

### 4.1 World

- `world help` – full list of world commands.
- `world grid 1` – set grid size to 1m.
- `world clear` – clear world blocks.
- `world export` / `world import` – JSON I/O for the block world.
- `world rotate` – rotate the placement palette (same as **R** on the World panel).

### 4.2 Animation (`anim` / AnimationState)

- `anim help` – animation command help.
- `anim list` – list animation clips for the active actor.
- `anim play <clip>` – play clip by name on the active actor.
- `anim fade <clip> [time]` – smoothly blend into `clip` over `time` seconds.
- `anim loop on|off` – loop toggle.
- `anim speed <x>` – global playback speed.
- `anim weight <x>` – blend weight for layered animations.

Runtime movement bindings (when the movement controller is active):

- **W / A / S / D** – move the actor on XZ (walk).  
- **Right-mouse** – aim hold.  
- **Left-mouse** (while aiming) – fire (shoot).

### 4.3 Actors (`actor` grammar)

Helpers for managing actors (spawned GLBs, heroes, dinos, etc.). Typical verbs:

- `actor help` – show actor usage.
- `actor list` – list active actor ids.
- `actor select <id>` – set active actor by id.
- `actor scale <x>` – scale the active actor.
- `actor stats` – prints basic stats (skinned mesh count, bone count).

### 4.4 Bones (`bones` grammar)

`bones` controls the skeleton debug overlay for the active actor.

- `bones help` – show usage.
- `bones on` / `bones off` – show/hide the skeleton helper.
- `bones toggle` – flip the current state.
- `bones helper on|off|toggle` – control the overlay / x-ray helper mode.

The **H** hotkey is a shortcut to `bones toggle` on the current active actor.

### 4.5 Mobs (`mob` grammar)

A simple mob AI helper that turns an actor into a chasing mob, driven by the runtime mob system.

- `mob help` – show usage.
- `mob add` – mark the **active actor** as a mob that chases the player/hero.
- `mob list` – list current mobs with their positions.
- `mob clear` – clear the mob list (actors remain in the scene; only AI binding is removed).

> The mob system updates each tick and moves mobs toward the player root.  
> It’s designed to be extended with orbiting behavior, separation, and wave spawning logic (e.g. dino hordes).

### 4.6 Env / Pad / Puppet / Others

- `env` – script host / tiny program runner (e.g. `env list`, `env run <name>`, `env stop all`).
- `pad` – gamepad mapping and test utilities.
- `puppet` / related grammars – higher-level actor rigging & binding helpers (see individual files under `src/grammars/`).

---

## 5. Perf Tools & GPU Quality

DAWN2 now has two layers of perf tooling:

1. **Perf HUD** – a live snapshot overlay in the bottom-right of the viewport.  
2. **`perf` grammar** – console commands for quality presets & stats.

### 5.1 Perf HUD (bottom-right overlay)

Shows a live scene snapshot:

- **Tris** – approximate triangle count for the current scene graph.
- **Textures** – estimated texture memory usage in MB (RGBA8 approximation).
- **Draws** – total draw calls since the renderer was created (from `gl.info.render.calls`).
- **Meshes / Geom / Tex** – counts from `gl.info.memory.*`:
  - **Geom** – number of geometries.
  - **Tex** – number of textures.

Footer line:

> `live scene snapshot · try "perf watch" for console logging`

Use this overlay while spawning heroes/dinos to see how your content scales in real time.

### 5.2 `perf` grammar – commands

Type `perf help` in the console to see the full list.

#### `perf quality` – GPU quality presets

- `perf quality` – print the current quality preset.
- `perf quality low`
- `perf quality balanced`
- `perf quality high`

These presets are defined in `src/engine/perf.ts` and control:

- **Device pixel ratio** (render resolution)  
- **Main directional light shadow map size**  
- **Ocean LOD + caustics render target size** (if the Ocean ISS plugin is present)

**Presets**

- **low**
  - Pixel ratio: **1.0**
  - Shadow map: **1024 × 1024**
  - Ocean LOD: start **30**, fade **30**
  - Caustics: **256**
  - ✅ Good for **laptops** or when stress-testing hordes of mobs.

- **balanced** (default)
  - Pixel ratio: **1.25**
  - Shadow map: **1536 × 1536**
  - Ocean LOD: start **40**, fade **40**
  - Caustics: **512**
  - 👍 Good daily driver setting; nice balance of clarity vs cost.

- **high**
  - Pixel ratio: **window.devicePixelRatio** (typically 2.0 on HiDPI)
  - Shadow map: **2048 × 2048**
  - Ocean LOD: start **55**, fade **55**
  - Caustics: **1024**
  - 🔥 For screenshots / cinematic demos. Heavier on GPU.

The current preset is persisted in localStorage under:

```text
dawn2-quality-preset-v1
```

The engine exposes a small API for scripts/grammars:

```ts
engine.quality.current  // "low" | "balanced" | "high"
engine.quality.set(name: QualityPresetName)
```

When you call `perf quality high`, DAWN2 will:

1. Update `engine.quality.current`.  
2. Call `engine.quality.set("high")`, which in turn:
   - Adjusts pixel ratio and shadow map sizes on the renderer/light.
   - Reconfigures ocean LOD / caustics if the ocean plugin is installed.

#### `perf stats` – scene budget snapshot

- `perf stats` – estimates current scene complexity and prints to the **in-game console log**:

  - Triangle count (via `estimateMeshTris` on the scene root).  
  - Texture memory (via `estimateTextureMB`).  
  - `gl.info` summary: draw calls, texture count, geometry count.

Example output:

```text
tris       ≈ 1,382,536
textures   ≈ 514.6 MB (RGBA8 approx)
gl.info: 286330 draws, 89 textures, 420 geometries
```

Use this when you add or remove big hero assets to understand how heavy they are.

#### `perf watch` – continuous logging

- `perf watch` – start logging perf snapshots **to the browser DevTools console** once per second.
- `perf watch stop` – stop logging.

When you start it, you’ll also see a short summary in the in-game log:

```text
perf watch: started (logging to console every 1s)
initial — tris≈1,382,536, tex≈514.6MB, draws=286330
```

The ongoing stats are printed to the **browser console** (F12). This makes it easy to record metrics while playing and compare presets, mob counts, etc.

---

## 6. Mobs, Spawns & Waves (high level)

The current pieces in play:

- **Mob system** (via `mob` grammar) – attaches simple chase AI to actors.  
- **SpawnSystem** (`src/runtime/scene/SpawnSystem.ts`) – initializes spawn logic and hooks into the engine systems set.  
- **Perf tools** – let you watch what happens to triangles, textures and draw calls as you increase mob counts.

Typical workflow for building dino waves:

1. Spawn a hero and one or more dino actors from the **Actors** panel.  
2. Select a dino and run `mob add` to turn it into a chaser.  
3. Duplicate / spawn more dinos and run `mob add` again for each, or wire this up via the spawn system.  
4. Use **Perf HUD** and `perf stats` / `perf watch` to see how heavy the wave is.

Future extensions (design intent, not strictly required for runtime):

- **Spawn markers**: small GLB markers (e.g. skull + sword) with `userData.isSpawnMarker` & `userData.spawnId` to define enemy portals.  
- **Wave rules** per spawn: `maxAlive`, `respawnDelay`, `mob type`.  
- Triggered encounters that enable/disable spawners based on quests or world state.

---

## 7. Extending DAWN2

Everything is designed so you can bolt on more tools without touching the core loop:

- **Add a new grammar** – drop a file in `src/grammars/`, export `registerXGrammar`, and hook it from `src/grammars/index.ts`.  
- **Expose systems to the engine** – push update loops into `engine.systems` (a `Set`) and they’ll be ticked automatically from the R3F bridge.  
- **Hook into perf** – use `estimateMeshTris`, `estimateTextureMB`, and `getPerfSnapshot()` from `src/engine/perf.ts` to build additional overlays or analytics.

With PerfHUD + `perf` + the console log bus, you now have a closed loop:

> **Spawn → Animate → Chase → Measure → Tune quality → Repeat**

That’s the bridge from prototype “pile of hero assets” into **repeatable, MMO-scale scenes** with real budgets you can see and track in real time.
