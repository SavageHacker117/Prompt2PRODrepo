// src/ISS/Ocean/OceanPlugin.ts
import * as THREE from 'three'

import { WaveSystem } from './WaveSystem'
import { DEFAULT_WATER_PROFILE } from './OceanConfig'
import { createClipmapMesh } from './geometry/ClipmapMesh'
import { createDefaultGerstnerField } from './waves/GerstnerWaveField'

// GLSL (vite ?raw)
/// <reference types="vite/client" />
// @ts-ignore
import oceanVert from './shaders/ocean.vert.glsl?raw'
// @ts-ignore
import oceanFrag from './shaders/ocean.frag.glsl?raw'

// Optional caustics
import { CausticsPass } from './effects/CausticsPass'

export interface OceanPluginParams {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera

  enableCaustics?: boolean
  causticsSize?: number
  causticsWorldSize?: number

  envMap?: THREE.CubeTexture | null
  envLod?: number

  sunDirection?: THREE.Vector3
  waterLevelY?: number

  // LOD defaults (meters)
  lodStart?: number
  lodFade?: number
}

type PresetName = 'pond' | 'ocean'

export class OceanPlugin {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.Camera

  public material: THREE.ShaderMaterial
  public mesh: THREE.Mesh
  public waveSystem: WaveSystem
  private time = 0

  private caustics?: CausticsPass

  public baseWaveAmplitudes: Float32Array | null = null
  private currentPreset: PresetName = 'ocean'

  constructor(params: OceanPluginParams) {
    this.renderer = params.renderer
    this.scene = params.scene
    this.camera = params.camera

    const sunDir = (params.sunDirection ?? new THREE.Vector3(-0.3, 1.0, 0.2)).normalize()
    const waterY = params.waterLevelY ?? 0.0

    const isWebGL2 = (this.renderer.capabilities as any).isWebGL2 === true
    const hasTexLod =
      isWebGL2 || (this.renderer.extensions as any).get?.('EXT_shader_texture_lod') != null

    // Build material
    this.material = new THREE.ShaderMaterial({
      vertexShader: oceanVert,
      fragmentShader: oceanFrag,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      toneMapped: true,
      uniforms: {
        // time/camera
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() },
        uSunDir: { value: sunDir },

        // appearance / clarity
        uShallowColor: { value: DEFAULT_WATER_PROFILE.shallowColor.clone() },
        uDeepColor: { value: DEFAULT_WATER_PROFILE.deepColor.clone() },
        uTurbidity: { value: DEFAULT_WATER_PROFILE.turbidity },
        uAbsorption: { value: Math.max(DEFAULT_WATER_PROFILE.absorption, 0.0001) },
        uFoamIntensity: { value: DEFAULT_WATER_PROFILE.foamIntensity },
        uFoamThreshold: { value: DEFAULT_WATER_PROFILE.foamThreshold },

        // depth modeling
        uWaterLevel: { value: waterY },
        uShallowDepth: { value: 3.0 },
        uMaxDepth: { value: 30.0 },

        // distance-based LOD (meters)
        uLodStart: { value: params.lodStart ?? 25.0 },
        uLodFade: { value: params.lodFade ?? 80.0 },

        // waves (max 16; WaveSystem will fill these)
        uWaveCount: { value: 0 },
        uWaveDirs: { value: new Float32Array(16 * 2) },        // packed vec2[]
        uWaveAmplitudes: { value: new Float32Array(16) },
        uWaveWavelengths: { value: new Float32Array(16) },
        uWaveSteepness: { value: new Float32Array(16) },

        // env map (safe path; LOD hint is optional)
        uEnvMap: { value: params.envMap ?? null },
        uEnvLod: { value: params.envLod ?? 0.0 },

        // caustics (optional)
        uCausticsMap: { value: null },
        uCausticsCenter: { value: new THREE.Vector2(0, 0) },
        uCausticsScale: { value: 1 / 200.0 },
        uCausticsStrength: { value: 0.0 },
      },
    })

    // Defines: keep env-map path guarded and avoid LOD requirement on WebGL1
    this.material.defines = this.material.defines || {}
    if (params.envMap) {
      ;(this.material.defines as any).USE_ENVMAP = 1
      if (hasTexLod) (this.material.defines as any).ENVMAP_LOD = 1
    }

    // Reduce z-fighting with your ground, but keep depth testing robust
    this.material.side = THREE.DoubleSide;        // see from above & below
    this.material.polygonOffset = true;
    this.material.polygonOffsetFactor = -1;
    this.material.polygonOffsetUnits = -1;

    // Build water geometry/mesh
    this.mesh = createClipmapMesh(this.material)
    this.mesh.position.y = waterY
    this.mesh.frustumCulled = false
    this.mesh.userData.isWater = true
    this.scene.add(this.mesh)

    // Wave system (Gerstner default)
    const gerstner = createDefaultGerstnerField()
    this.waveSystem = new WaveSystem({
      appearance: DEFAULT_WATER_PROFILE,
      layers: [gerstner],
    })
    this.waveSystem.bindMaterial(this.material)

    // Cache base amps for preset scaling
    const amps = this.material.uniforms.uWaveAmplitudes?.value as Float32Array | undefined
    if (amps) this.baseWaveAmplitudes = new Float32Array(amps)

    // Optional caustics
    if (params.enableCaustics) {
      this.caustics = new CausticsPass({
        renderer: this.renderer,
        size: params.causticsSize ?? 512,
        worldSizeMeters: params.causticsWorldSize ?? 200,
      })
      this.material.uniforms.uCausticsStrength.value = 0.9
    }

    // Try a preflight compile once scene objects exist (helps surface shader mistakes early)
    try {
      this.renderer.compile(this.scene, this.camera)
    } catch (e) {
      console.warn('[sea] compile warning (shader will attempt to run anyway):', e)
    }
  }

  // ───────────────────── Public API (HUD/Console) ─────────────────────

  setVisible(on: boolean): void {
    this.mesh.visible = !!on
  }
  isVisible(): boolean {
    return this.mesh.visible
  }

  setWaterLevel(y: number): void {
    this.mesh.position.y = y
    this.material.uniforms.uWaterLevel.value = y
  }

  setPreset(preset: PresetName): void {
    if (!this.baseWaveAmplitudes) {
      this.currentPreset = preset
      return
    }
    const amps = this.material.uniforms.uWaveAmplitudes?.value as Float32Array | undefined
    if (!amps) {
      this.currentPreset = preset
      return
    }
    const scale = preset === 'pond' ? 0.25 : 1.0
    for (let i = 0; i < amps.length && i < this.baseWaveAmplitudes.length; i++) {
      amps[i] = this.baseWaveAmplitudes[i] * scale
    }
    this.currentPreset = preset
  }
  getPreset(): PresetName {
    return this.currentPreset
  }

  /** Optional helper for grammar/HUD */
  setLOD(start: number, fade: number): void {
    if (Number.isFinite(start)) this.material.uniforms.uLodStart.value = start
    if (Number.isFinite(fade)) this.material.uniforms.uLodFade.value = fade
  }

  /** Optional helper for grammar/HUD */
  setClarity(turbidity?: number, absorption?: number): void {
    if (Number.isFinite(turbidity as number)) this.material.uniforms.uTurbidity.value = turbidity!
    if (Number.isFinite(absorption as number))
      this.material.uniforms.uAbsorption.value = Math.max(absorption!, 0.0001)
  }

  /** Swap env map at runtime if needed */
  setEnvMap(env: THREE.CubeTexture | null, envLod = 0): void {
    this.material.uniforms.uEnvMap.value = env
    this.material.uniforms.uEnvLod.value = envLod
    this.material.defines = this.material.defines || {}
    if (env) {
      ;(this.material.defines as any).USE_ENVMAP = 1
    } else {
      delete (this.material.defines as any).USE_ENVMAP
      delete (this.material.defines as any).ENVMAP_LOD
    }
    this.material.needsUpdate = true
  }

  update(dt: number): void {
    this.time += dt
    this.waveSystem.update(dt)

    const u: any = this.material.uniforms
    u.uTime.value = this.time
    u.uCameraPos.value.copy(this.camera.position)

    if (this.caustics) {
      const center = new THREE.Vector2(this.camera.position.x, this.camera.position.z)
      this.caustics.update({
        time: this.time,
        centerXZ: center,
        sunDir: (u.uSunDir.value as THREE.Vector3),
        uniformsFromOcean: {
          uWaveCount: u.uWaveCount.value,
          uWaveDirs: u.uWaveDirs.value as Float32Array,
          uWaveAmplitudes: u.uWaveAmplitudes.value as Float32Array,
          uWaveWavelengths: u.uWaveWavelengths.value as Float32Array,
        },
      })
      u.uCausticsMap.value = this.caustics.texture
      u.uCausticsCenter.value.copy(center)
      u.uCausticsScale.value = 1.0 / this.caustics.worldSizeMeters
    }
  }

  /** Clean up GPU resources (call when removing the water system) */
  dispose(): void {
    try {
      this.scene.remove(this.mesh)
      this.mesh.geometry?.dispose()
      this.material.dispose()
      this.caustics?.dispose?.()
    } catch {}
  }

  /** Expose WaveSystem for debug / grammars. */
  get query() {
    return this.waveSystem
  }
}
