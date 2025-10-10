// Centralized asset manifest for animation sequences (exact filenames from your tree)
// All paths are relative to your Vite public root (served from project root).
// If you serve from /, use paths starting with /assets/...
// Adjust BASE if you host under a subpath.
export const BASE = "";

// Helper to join
const p = (s) => `${BASE}${s}`;

export const ASSETS = {
  // Particles — Power-Up Orb (12 frames)
  power_up_orb: [
    p('/assets/images/particles/power_up_orb/power_up_orb_f01_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f02_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f03_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f04_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f05_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f06_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f07_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f08_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f09_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f10_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f11_256.png'),
    p('/assets/images/particles/power_up_orb/power_up_orb_f12_256.png'),
  ],
  // Sparks (4 frames cycle)
  sparks: [
    p('/assets/images/particles/sparks/sparks_f01_256.png'),
    p('/assets/images/particles/sparks/sparks_f02_256.png'),
    p('/assets/images/particles/sparks/sparks_f03_256.png'),
    p('/assets/images/particles/sparks/sparks_f04_256.png'),
  ],
  // Pulse Trails (4 frames)
  pulse_trail: [
    p('/assets/images/particles/pulse_trails/pulse_trail_f01_256.png'),
    p('/assets/images/particles/pulse_trails/pulse_trail_f02_256.png'),
    p('/assets/images/particles/pulse_trails/pulse_trail_f03_256.png'),
    p('/assets/images/particles/pulse_trails/pulse_trail_f04_256.png'),
  ],
  // Impact Flash (3 frames)
  impact_flash: [
    p('/assets/images/effects/impact_flash/impact_flash_f01_256.png'),
    p('/assets/images/effects/impact_flash/impact_flash_f02_256.png'),
    p('/assets/images/effects/impact_flash/impact_flash_f03_256.png'),
  ],
  // Shockwave Dome (4 frames)
  shockwave_dome: [
    p('/assets/images/effects/shockwave_dome/shockwave_dome_f01_256.png'),
    p('/assets/images/effects/shockwave_dome/shockwave_dome_f02_256.png'),
    p('/assets/images/effects/shockwave_dome/shockwave_dome_f03_256.png'),
    p('/assets/images/effects/shockwave_dome/shockwave_dome_f04_256.png'),
  ],
  // Energy Ripple (3 frames)
  energy_ripple: [
    p('/assets/images/effects/energy_ripple/energy_ripple_f01_256.png'),
    p('/assets/images/effects/energy_ripple/energy_ripple_f02_256.png'),
    p('/assets/images/effects/energy_ripple/energy_ripple_f03_256.png'),
  ],
  // Energy Ring Pulse (3 frames)
  energy_ring_pulse: [
    p('/assets/images/effects/energy_ring_pulse/energy_ring_pulse_f01_256.png'),
    p('/assets/images/effects/energy_ring_pulse/energy_ring_pulse_f02_256.png'),
    p('/assets/images/effects/energy_ring_pulse/energy_ring_pulse_f03_256.png'),
  ],
  // UI buttons (static states)
  ui_button: {
    base:  p('/assets/images/ui/button_base_256.png'),
    hover: p('/assets/images/ui/button_hover_256.png'),
    down:  p('/assets/images/ui/button_pressed_256.png'),
  },
  // Core game sprites
  ball: p('/assets/images/balls/ball_256.png'),
  ball_trail: p('/assets/images/balls/ball_trail_256.png'),
  peg: p('/assets/images/pegs/peg_256.png'),
  peg_glow: p('/assets/images/pegs/peg_glow_256.png'),
  bucket: p('/assets/images/buckets/bucket_256.png'),
  bucket_gold: p('/assets/images/buckets/bucket_gold_256.png'),
  // Tokens
  amarions: {
    blue:  p('/assets/images/amarions/amarion_blue_256.png'),
    red:   p('/assets/images/amarions/amarion_red_256.png'),
    gold:  p('/assets/images/amarions/amarion_gold_256.png'),
    shadow:p('/assets/images/amarions/amarion_shadow_256.png'),
  }
};

export default ASSETS;
