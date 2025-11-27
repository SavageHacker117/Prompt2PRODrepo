import * as THREE from 'three';

export interface WaterAppearanceProfile {
  id: string;
  label: string;

  shallowColor: THREE.Color;
  deepColor: THREE.Color;

  turbidity: number;      // 0 = crystal, 1 = very murky
  absorption: number;     // how fast light dies with depth
  scattering: number;     // how milky / diffuse

  foamIntensity: number;  // 0..1
  foamThreshold: number;  // used to decide when foam shows up

  roughness: number;      // PBR
  metalness: number;      // PBR
}

export const WATER_PRESETS: Record<string, WaterAppearanceProfile> = {
  CrystalClear: {
    id: 'CrystalClear',
    label: 'Crystal Clear (Tropical)',
    shallowColor: new THREE.Color(0x31d6ff),
    deepColor: new THREE.Color(0x004477),
    turbidity: 0.1,
    absorption: 0.4,
    scattering: 0.6,
    foamIntensity: 0.4,
    foamThreshold: 0.7,
    roughness: 0.05,
    metalness: 0.0
  },
  AtlanticGreen: {
    id: 'AtlanticGreen',
    label: 'Nasty Atlantic Green',
    shallowColor: new THREE.Color(0x3f5f3a),
    deepColor: new THREE.Color(0x10251a),
    turbidity: 0.8,
    absorption: 0.7,
    scattering: 0.5,
    foamIntensity: 0.8,
    foamThreshold: 0.5,
    roughness: 0.12,
    metalness: 0.0
  }
};

export const DEFAULT_WATER_PROFILE = WATER_PRESETS.CrystalClear;
