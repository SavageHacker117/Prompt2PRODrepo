// High-level helpers to play named effects
import { ASSETS } from './assets.js';

export const EFFECTS = {
  impactSmall: (mgr, pos, scale=1) => mgr.spawn(ASSETS.impact_flash, { fps: 24, loop: false, scale, position: pos, renderOrder: 20 }),
  shockwave:   (mgr, pos, scale=1.4) => mgr.spawn(ASSETS.shockwave_dome, { fps: 18, loop:false, scale, position: pos }),
  ripple:      (mgr, pos, scale=1.2) => mgr.spawn(ASSETS.energy_ripple, { fps: 16, loop:false, scale, position: pos }),
  ringPulse:   (mgr, pos, scale=1.0) => mgr.spawn(ASSETS.energy_ring_pulse, { fps: 16, loop:false, scale, position: pos }),
  sparks:      (mgr, pos, scale=0.9) => mgr.spawn(ASSETS.sparks, { fps: 20, loop:true, scale, position: pos }),
  trail:       (mgr, pos, scale=1.0) => mgr.spawn(ASSETS.pulse_trail, { fps: 18, loop:true, scale, position: pos }),
  powerOrb:    (mgr, pos, scale=0.9) => mgr.spawn(ASSETS.power_up_orb, { fps: 16, loop:true, scale, position: pos }),
};
