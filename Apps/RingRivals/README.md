# Ring Rivals — an FLSgames.com production (built with GPT-5 Thinking)

## Quick start
```bash
npm i
npm run dev
# open http://localhost:5173, pick an arena, Start Match
Controls
W / A / S / D – move

J – jab  K – cross

L – block I – weave

B – toggle bright exposure N – toggle bloom

` (backtick) – open/close Dev Console

Dev Console (type help to see these)
help – list commands and examples

reset – reset the round (recenters fighters, restores health)

time <0.1..2> – timescale (e.g., time 0.4 slow-mo)

cam fight|sweep|corners – switch camera intent

fov <number> – set camera FOV (e.g., fov 60)

arena stadium|gym|cyber – switch arena theme

hp player <0..1> – set player health (UI only for testing)

hp cpu <0..1> – set CPU health (UI only for testing)

ko player|cpu – force KO outcome

bloom on|off – toggle bloom

exposure <number> – set ACES exposure (e.g., exposure 1.6)

crowd <0..1> – set crowd intensity (visual/audio)

debug camera on|off – show/hide camera debug overlay

Console lives in src/debug/console and the grammar in src/debug/grammar.
Add new verbs by extending coreCommands.js + grammar tokens.

What’s included
⚡️ Three.js renderer with ACES tone-mapping + bloom

🥊 Player & CPU boxers with collision separation (no stacking)

🧠 Round flow: gate → countdown → bell → timer → next round (with health reset)

📸 Camera controller: cinematic sweeps + fight follow, step-bob & hit shake

🎛️ Fancy multi-layer health bars with delayed damage trail + low-HP pulse

👥 Instanced/billboard crowd with intensity-reactive audio

💡 Stadium lighting rig & animated ring ropes

🧪 In-game Dev Console for rapid iteration

Build for deploy
bash
Copy code
npm run build
npm run preview
# deploy the contents of /dist to any static host
Structure
css
Copy code
src/
  audio/            ArenaAudio…
  camera/           CameraController, CameraDebugger
  core/             StateManager
  debug/
    console/        DevConsole + commands
    grammar/        tokens, grammar, examples
  fight/            FightLogic (rounds, hits)
  fighters/         Boxer, BoxerAI, Referee (WIP)
  fx/               ImpactFX
  powerups/         PowerUp, PowerUpSpawner
  scene/            RingScene, CrowdManager
  ui/               UIManager