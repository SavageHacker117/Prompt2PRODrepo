# DAWN2 – Runtime Controls (Quick Guide)

## Selection & Transform
- **Ctrl + Left-click** on an actor or spawn gizmo to select.  
- **G** Translate • **R** Rotate • **S** Scale (gizmo mode).  
- **Delete** removes selected roots from the scene.  
- Selection “rooting” prefers objects with `userData.isActorRoot` or `userData.pickRoot`, otherwise the highest mesh/group under Scene.

## HUD / Docks
- Default layout: **Scene** at the bottom dock; **Anim / Actors / World** on the right dock.
- “**+ Dock** / **− Dock**” toggles the second dock; no more stuck/empty dock.
- **Esc** opens Options → *Reset Dock Layout* restores defaults.
- **9** toggles Play/Edit mode.

## Anim Panel
- Choose an animation, then **Play / Fade / Stop**.
- Speed / Weight sliders, **Loop** checkbox.
- **Movement: ON/OFF** — enables a simple WASD controller that moves the **currently selected actor**.

## World Panel
- Block palette (type/size/color), **Rotate**, **Clear**, **Export/Import** world JSON.
- **Reset World** clears blocks, groups, selection.

## Console Commands (common)
*(These mirror what you’ve bound in grammars; adapt to your actual verbs.)*
- `actor list` — list actor ids in scene.
- `spawn <url>` — spawn a GLB by URL (matches model list in Actors panel).
- `anim play "<clip>" on <actorId>` — play a clip on an actor.
- `bones on|off` — toggle bone debug.
- `transform scale=<num> on <actorId>` — quick scale helper.

## Tips
- The Interactor’s pick root is exposed at `__engine.pickRoot(object)` for debugging.
- Movement speed: `__engine.movement.setSpeed(3.0)`.

# DAWN2 — Runtime, Console & Editor Cheatsheet

## 🚀 Quick Start
- **Play/Edit**: press **9** to toggle.
- **Options**: press **Esc** → toggle UI lock/compact, renderer settings, and the **Show Debug Console** flag (persisted).
- **Select Actors**: **Ctrl + Left-click** a mesh. We climb parents to `userData.pickRoot` (stamped on spawn) and mark the actor root. **Ctrl-drag** moves along XZ.
- **Focus** selected actor from the Scene panel.

## 🧠 Key Anim Controls (AnimationState grammar)
- **W / A / S / D** → walk forward/left/back/right (switches to walk while any key held).
- **Right-mouse** → aim hold.
- **Left-mouse** (while aiming) → fire.  
(see `AnimationState.ts` for the bindings and clip map) :contentReference[oaicite:2]{index=2}

## 🧾 Console Commands

The console is extensible via “grammars”. Core sets include **world**, **animation**, **bones**, **puppet**, **pad**, **env**. Each grammar prints help if you type the base name or `help`.

### World
- `world help` — show actions (spawn blocks, clear, import/export, etc.) :contentReference[oaicite:3]{index=3}
- Examples:
  - `world grid 1` — set grid=1m
  - `world clear` — clear blocks
  - `world export` / `world import` — I/O (JSON)
  - `world rotate` — rotate placement palette (same as **R**) :contentReference[oaicite:4]{index=4}

### Animation
- `anim help` — list commands :contentReference[oaicite:5]{index=5}
- `anim list` — list clips
- `anim play <clip>` — play by name
- `anim fade <clip> [t]` — fade to clip over `t` seconds
- `anim loop on|off` — loop toggle
- `anim speed <x>` — global speed
- `anim weight <x>` — blend weight
  :contentReference[oaicite:6]{index=6}

### Bones
- `bones help` — bone debug/injection help
- `bones on|off` — toggle bone debug
- `bone inject <count>` — inject helpers
- `bone play` / `bone stop` — test wag/wave, etc.  
  (see `bones.ts`) 

### Puppet
- `actor help` — actor management
- `actor list` — list active actors
- `actor focus <id>` — focus camera on actor
- `actor delete <id>` — delete actor
  

### Pad
- `pad help` —  gamepad mapping/testing utilities (see `pad.ts`) 

### Env (script host integration)
- `env list` — running programs
- `env run <name>` — run a stored env program
- `env stop [name|all]` — stop programs  
  (programs come from `envScripts.v1` localStorage) :contentReference[oaicite:10]{index=10}

> Tip: the console itself is implemented in `console/DebugConsole.tsx`. You can extend grammars by calling `dbg.extend(name, handler, helpText)`; they’re registered in `grammars/index.ts` at app boot. :contentReference[oaicite:11]{index=11} :contentReference[oaicite:12]{index=12}

## 🧩 Spawns & Vendors (runtime/scene)
We’re introducing a few tiny runtime helpers (drop these files in `src/runtime/scene/`):
- `SpawnSystem.ts` — keeps a map of spawn points by tag (npc/player/vendor), respawn rules, and `bindToSpawn(actorId, spawnId)`.
- `NavAgent.ts` — set a nav target and walk there each tick (XZ lerp) — already stubbed.
- `TriggerZone.ts` — simple AABB trigger for interactions (wire to your Interactor).
- `Inventory.ts` — simple `add/remove/has`.
- `Vendor.ts` — minimal vendor surface.

> The Scene/HUD “Spawn” panel uses these to drop tagged spawn points and attach actors. From scripts/console you can then issue things like `actor focus <id>` and control animations.

## 🖱 Selection → Binding
- Select an actor (**Ctrl+LMB**). The Scene panel shows the active id; press **“Bind”** in your Binding panel to attach a serialized child (e.g., `AK`) to the active actor (Binding system lives under `src/tools/BindingSystem.ts`).  
  It looks up nodes by `actorId`/bone name and attaches them on demand. :contentReference[oaicite:13]{index=13}

---

## 🛠 Notes
- If you ever want to disable the console entirely, uncheck **Show Debug Console** in Options. The flag persists and is respected by the app on boot (the value is stored under `hud-ui-options-v1`). :contentReference[oaicite:14]{index=14}
- Renderer knobs (pixel ratio, shadows, exposure) are relayed to the R3F renderer via a custom `ui:renderer` event bus. :contentReference[oaicite:15]{index=15}
