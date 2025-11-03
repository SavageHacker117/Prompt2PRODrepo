# Assets to add (placeholders currently in /public)

Drop your final art/audio into the following paths (keep filenames), then rebuild.

## Textures (in `/public/textures`)

- `mat_color.jpg` — Boxing canvas/mat albedo
- `mat_normal.jpg` — Mat normal map
- `rope_diffuse.jpg` — Ring rope texture
- `seat_diffuse.jpg` — Stadium seating texture / tiling strip
- *(optional)* `env.hdr` — Arena/environment map for reflections (if you add it, we can wire PMREM)

## Audio (in `/public/audio`)

- `crowd_base.mp3` — Looped crowd bed (low murmur)
- `crowd_cheer.mp3` — Layered cheer that ramps with intensity
- `crowd_boo.mp3` — Boo layer (used on fouls or one-sided fights)
- `pa_intro.mp3` — Announcer intro sting / voice
- `bell_ding.mp3` — Round bell

> Format: MP3 or WAV at 44.1kHz is fine. Current code uses `.mp3` names.

## Models (optional, later)

Place in `/public/models` and we’ll load via `GLTFLoader`:

- `fighter_player.glb`, `fighter_cpu.glb` — Skinned rigs with punch/block/walk clips
- `referee.glb`, `ring_girl.glb`, `photographer.glb` — Simple looped animations
- `camera_crane.glb` — For atmosphere shots

## Screens / Media (optional)

- `/public/media/jumbotron.mp4` — Replay or crowd-cam loop to map on LED screens

---

### Notes

- The app already runs with simple “magic boxes” fighters, a working ring with animated ropes, and a background stadium + crowds.
- Missing audio will *not* crash — it’s handled gracefully. Replace the empty files with real assets to enable sound.
- Textures are tiny placeholders (1×1) so nothing 404s during dev.
