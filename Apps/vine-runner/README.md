# Vine Runner — Three.js + Vite

A tiny but mighty Three.js runner with a built-in “mini IDE” for animation clips, bone puppeting, controller mapping, editor gizmos, and video-skinned levels. Built live with GPT-5 Thinking.

https://flsgames.com (WIP demo brand)

---

## Quick Start

```bash
npm i
npm run dev
# open the local URL Vite prints
Build:

bash
Copy code
npm run build
npm run preview
What’s Inside
Gameplay & Scene
Player with smooth acceleration, jump/land, particles, bounds clamp.

Procedural obstacles (blocks, spikes, pits).

10-level loop with Pause / Game Over / Level Complete panels.

Camera controller with dolly wheel zoom, drag rotate, and pan.

Video-skinned floor / ceiling / side walls (mp4 tiles, no stretching).

Tap to Play cinematic intro overlay (assets/intro.mp4) with unmute + volume.

Input
Keyboard first (WASD/Arrows + Space), gamepad merge (left stick + A + Start).

Rebindable keys with a controller-mapping overlay.

Tools (the “mini IDE”)
Anim Panel – browse and play GLTF animation clips, blend, loop.

Scripts Panel – author bone offsets over time (JSON) to puppet any bone.

Controller Overlay – click controls to rebind keys.

Editor Tools – orbit/pan/zoom + transform gizmo (move/rotate/scale), snapping.

Debug Console – in-game CLI with grammars (anim, scripts, pad, core helpers).

Controls & Hotkeys
Player
Left / Right or A / D → strafe (Z).

Up / Down or W / S → forward/back intent (X).

Space → jump.

Esc → pause.

Camera (mouse)
Wheel → dolly zoom.

LMB drag → orbit rotate.

MMB / RMB drag → pan.

Editor Tools
W / E / R → gizmo: Translate / Rotate / Scale.

Q / Esc → detach gizmo.

L → toggle Local / World space.

Ctrl (hold) → snapping (move 0.5u / rotate 15° / scale 0.1).

Utility
I → toggle big wall ID labels (helps verify left/right/sky/floor).

K → toggle Anim Panel (handy if console says “not ready”).

Tap / Click on the intro pill to start. Use Unmute widget bottom-right.

Console Commands (open the in-game console and type help)
Core (from DebugConsole):

php-template
Copy code
help
pause, resume
hp <0..100>, heal <n>, damage <n>
level <i>, score <n>
anim grammar (Animation Panel)
nginx
Copy code
anim help
anim toggle                    # show/hide panel
anim list                      # available clips
anim play <name>               # play immediately
anim fade <name> [duration]    # crossfade to clip (default 0.25s)
anim stop [name]               # stop current or named clip
anim speed <0..3>              # mixer timeScale
anim weight <0..1>             # selected action effective weight
anim loop <on|off>             # set loop on the selected action
anim current                   # print selected clip name
scripts grammar (Bone puppeting)
python
Copy code
scripts help
scripts ui | toggle            # show/hide Scripts panel
scripts list                   # list scripts
scripts scan                   # scan scene for skeleton/bones
scripts bones [filter]         # list bone names (optional filter)
scripts start <name>           # run a script
scripts stop [name|all]        # stop a script or all scripts
scripts new <name>             # add a blank script
scripts del <name>             # delete script
scripts rename <old> <new>     # rename script
scripts suggest                # suggest target bone for a “wave”
scripts dock [on|off]          # dock/undock Anim panel (if supported)
pad grammar (Gamepad & overlay)
python
Copy code
pad help
pad map | show                 # show controller overlay
pad hide                       # hide overlay
pad info                       # dump active pad id/axes/buttons
Assets
Put a rigged GLB at assets/models/humanoid.glb with clips like idle/run/walk/jump.

If missing, a capsule placeholder is used so you can still run.

Optional: assets/models/rose.glb for another character test.

Particles: assets/textures/particle.png.

Intro video: assets/intro.mp4.

Video walls (examples):

bash
Copy code
assets/textures/tpk1/textures/videoWalls/
  LHwall.mp4, RHwall.mp4, 1Floor.mp4, 1Sky.mp4
Video Walls (debugging)
core/VideoSkins.js smart-places planes:

Prefers meshes containing these names:
Left → LHwall|LeftWall|Wall_L|Left
Right → RHwall|RightWall|Wall_R|Right
Floor → 1Floor|Floor|Ground
Sky → 1Sky|Sky|Ceiling|Ceil

If none are found, it falls back to computed corridor bounds.

Tiling is aspect-correct (16:9), mirrored as needed.

Press I to toggle giant labels so you can verify which wall is which.

Editor Tools (overview)
Orbit controls with damping (zoom/pan/rotate).

TransformControls gizmo on clicked meshes (filters out hidden/noSelect).

Snapping while holding Ctrl.

Toolbar buttons for Translate/Rotate/Scale, Local/World, Detach.

Project Structure
css
Copy code
assets/
  intro.mp4
  models/
    humanoid.glb (drop your rig here)
    rose.glb
  textures/
    particle.png
  ui/
    xbox_controller.png
core/
  (Engine, HUD, Input, GamepadInput, CameraController, VideoSkins, EditorTools, etc.)
grammar/
  animation.js
  pad.js
  puppet.js
prefabs/
  Player.js, Obstacle.js, DecorWalls.js
scripts/
  wave.js (example)
index.html
main.js
styles.css
vite.config.js
Troubleshooting
❗ Vite “Failed to resolve import … from grammar/puppet.js”
If you see something like:

pgsql
Copy code
Pre-transform error: Failed to resolve import "./core/Engine.js" from "grammar/puppet.js"
it means grammar/puppet.js is importing engine files. Don’t import engine files in grammar modules. Grammars are registered by grammar/index.js and receive the engine via parameters.

Fix (recommended): replace grammar/puppet.js with the version in this repo (below). It has no imports except the function export. (If you really must import, the relative path from grammar/ would be ../core/..., but again: avoid it.)

Also, if Vite gets confused after many edits:

bash
Copy code
rm -rf node_modules/.vite
npm run dev
❗ “Failed to resolve import './core/CameraController.js'”
Make sure the filename and import case match exactly.

Confirm the file exists at core/CameraController.js.

Restart npm run dev after heavy renames.

Call to Action — “Make It Grand”
To push this from prototype → mini-game vertical slice:

Hero anim polish

Replace placeholder GLB with a rig (idle, walk, run, jump, land, breathe).

Use the Anim Panel to tune blends; set default idle → walk → run thresholds.

Puppet passes

Add micro-motion scripts: spine breathe, wrist swing, head look, foot tilt.

Use scripts suggest to pick good bones, keep values small and tasteful.

IK & attachments

Optional: Hand IK for props (vine, weapon). Attach objects to bones after load.

SFX & music

Add jump/land/bump sounds, looped ambience. Tie Unmute widget to global mix.

Level art pass

Replace corridor with jungle set pieces. Keep video walls for stylized vibes or swap to static PBR materials for perf.

Gameplay ramps

Timed gates, moving platforms, coin arcs, pickups that feed the HUD score.

Save/Load

LocalStorage for best time, last level, bindings (already used for keymap).

License
You own your assets and game logic. Three.js is MIT. Keep third-party assets in their original licenses.
