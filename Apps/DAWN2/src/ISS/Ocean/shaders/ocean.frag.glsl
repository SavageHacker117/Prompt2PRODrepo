// src/ISS/Ocean/shaders/ocean.frag.glsl
precision highp float;
precision highp int;

#define PI 3.1415926535897932384626433832795

#ifndef WAVES_MAX
  #define WAVES_MAX 16
#endif

// ---- Shared uniforms (MUST match vertex) ----
uniform float uTime;
uniform vec3  uCameraPos;
uniform vec3  uSunDir;

uniform float uWaterLevel;
uniform float uShallowDepth;
uniform float uMaxDepth;

uniform highp int uWaveCount;
uniform vec2  uWaveDirs[WAVES_MAX];
uniform float uWaveAmplitudes[WAVES_MAX];
uniform float uWaveWavelengths[WAVES_MAX];
uniform float uWaveSteepness[WAVES_MAX];

// Appearance
uniform vec3  uShallowColor;
uniform vec3  uDeepColor;
uniform float uTurbidity;
uniform float uAbsorption;
uniform float uFoamIntensity;
uniform float uFoamThreshold;

// Env
#ifdef USE_ENVMAP
  uniform samplerCube uEnvMap;
  #ifdef ENVMAP_LOD
    uniform float uEnvLod;
  #endif
#endif

// Caustics
uniform sampler2D uCausticsMap;
uniform vec2      uCausticsCenter;
uniform float     uCausticsScale;
uniform float     uCausticsStrength;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vSunDir;
varying float vWaveSlope;
varying float vWaterHeight;

vec3 applyEnvSpecular(vec3 N, vec3 V) {
#ifdef USE_ENVMAP
  vec3 R = reflect(-V, N);
  #ifdef ENVMAP_LOD
    return textureCubeLodEXT(uEnvMap, R, clamp(uEnvLod, 0.0, 7.0)).rgb;
  #else
    return textureCube(uEnvMap, R).rgb;
  #endif
#else
  return vec3(0.04);
#endif
}

float foamFactor(float slope, float height) {
  float f = smoothstep(uFoamThreshold, uFoamThreshold + 0.8, slope + max(0.0, height*0.5));
  return clamp(f * uFoamIntensity, 0.0, 1.0);
}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(vSunDir);

  float NoV = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = pow(1.0 - NoV, 5.0) * 0.96 + 0.04;

  float depthAtten = clamp((uMaxDepth - uShallowDepth) / max(uMaxDepth, 0.001), 0.0, 1.0);
  vec3 waterBase = mix(uShallowColor, uDeepColor, depthAtten);

  float NoL = clamp(dot(N, L), 0.0, 1.0);
  vec3 diffuse = waterBase * (0.2 + 0.8 * NoL);

  vec3 spec = applyEnvSpecular(N, V);

  float ca = 0.0;
  if (uCausticsStrength > 0.0) {
    vec2 uvC = (vWorldPos.xz - uCausticsCenter) * uCausticsScale + 0.5;
    vec3 cTex = texture2D(uCausticsMap, uvC).rgb;
    ca = uCausticsStrength * dot(cTex, vec3(0.333));
  }

  float foam = foamFactor(vWaveSlope, vWaterHeight);

  vec3 color = diffuse + spec * fresnel;
  color = mix(color, vec3(1.0), foam);
  color += ca * 0.25;

  color *= exp(-uAbsorption);
  color = mix(color, vec3(0.0), clamp(uTurbidity * 0.05, 0.0, 0.4));

  gl_FragColor = vec4(color, 1.0);
}
